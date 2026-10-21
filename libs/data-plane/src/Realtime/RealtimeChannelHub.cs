namespace LocalMe.DataPlane.Realtime;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

public record RealtimeMessage(
    string EventId,
    string ProjectId,
    string Table,
    string Action, // "INSERT" | "UPDATE" | "DELETE" | "BROADCAST"
    object? Data,
    DateTimeOffset TimestampUtc
);

public class RealtimeChannelHub
{
    private sealed class ClientConnection
    {
        public string ConnectionId { get; } = Guid.NewGuid().ToString("N");
        public string ProjectId { get; }
        public WebSocket Socket { get; }
        public HashSet<string> SubscribedTables { get; } = new(StringComparer.OrdinalIgnoreCase);

        public ClientConnection(string projectId, WebSocket socket)
        {
            ProjectId = projectId;
            Socket = socket;
        }
    }

    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, ClientConnection>> _clientsByProject = new();

    public int GetActiveConnectionCount(string projectId)
    {
        return _clientsByProject.TryGetValue(projectId, out var clients) ? clients.Count : 0;
    }

    public async Task HandleWebSocketAsync(string projectId, WebSocket webSocket, CancellationToken cancellationToken = default)
    {
        var client = new ClientConnection(projectId, webSocket);
        var projectClients = _clientsByProject.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, ClientConnection>());
        projectClients[client.ConnectionId] = client;

        // Default subscription to all tables
        client.SubscribedTables.Add("*");

        var buffer = new byte[4096];

        try
        {
            // Send initial connection acknowledgement
            var welcome = new RealtimeMessage(
                EventId: Guid.NewGuid().ToString("N"),
                ProjectId: projectId,
                Table: "system",
                Action: "CONNECTED",
                Data: new { connectionId = client.ConnectionId, status = "active", message = "Connected to LocalMe Realtime Duplex Stream" },
                TimestampUtc: DateTimeOffset.UtcNow
            );
            await SendMessageToClientAsync(client, welcome, cancellationToken);

            while (webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closed by client", cancellationToken);
                    break;
                }

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var msgText = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    await HandleClientInboundMessageAsync(client, msgText);
                }
            }
        }
        catch (WebSocketException)
        {
            // Client abruptly disconnected
        }
        finally
        {
            projectClients.TryRemove(client.ConnectionId, out _);
        }
    }

    private static async Task HandleClientInboundMessageAsync(ClientConnection client, string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("action", out var actionProp))
            {
                var action = actionProp.GetString();
                if (action == "subscribe" && doc.RootElement.TryGetProperty("table", out var tableProp))
                {
                    var table = tableProp.GetString();
                    if (!string.IsNullOrWhiteSpace(table))
                    {
                        if (table != "*")
                        {
                            client.SubscribedTables.Remove("*");
                        }
                        client.SubscribedTables.Add(table);
                    }
                }
                else if (action == "unsubscribe" && doc.RootElement.TryGetProperty("table", out var unsubTable))
                {
                    var table = unsubTable.GetString();
                    if (!string.IsNullOrWhiteSpace(table))
                    {
                        client.SubscribedTables.Remove(table);
                    }
                }
                else if (action == "ping")
                {
                    var pong = new RealtimeMessage(
                        EventId: Guid.NewGuid().ToString("N"),
                        ProjectId: client.ProjectId,
                        Table: "system",
                        Action: "PONG",
                        Data: new { pong = true, timestampUtc = DateTimeOffset.UtcNow },
                        TimestampUtc: DateTimeOffset.UtcNow
                    );
                    await SendMessageToClientAsync(client, pong, CancellationToken.None);
                }
            }
        }
        catch
        {
            // Ignore malformed client text
        }
    }

    public async Task BroadcastTableEventAsync(string projectId, string table, string action, object? data)
    {
        if (!_clientsByProject.TryGetValue(projectId, out var clients) || clients.IsEmpty)
        {
            return;
        }

        var message = new RealtimeMessage(
            EventId: Guid.NewGuid().ToString("N"),
            ProjectId: projectId,
            Table: table,
            Action: action,
            Data: data,
            TimestampUtc: DateTimeOffset.UtcNow
        );

        var deadClients = new List<string>();

        foreach (var (_, client) in clients)
        {
            if (client.Socket.State != WebSocketState.Open)
            {
                deadClients.Add(client.ConnectionId);
                continue;
            }

            if (client.SubscribedTables.Contains("*") || client.SubscribedTables.Contains(table))
            {
                try
                {
                    await SendMessageToClientAsync(client, message, CancellationToken.None);
                }
                catch
                {
                    deadClients.Add(client.ConnectionId);
                }
            }
        }

        foreach (var id in deadClients)
        {
            clients.TryRemove(id, out _);
        }
    }

    private static async Task SendMessageToClientAsync(ClientConnection client, RealtimeMessage message, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(message);
        var bytes = Encoding.UTF8.GetBytes(json);
        await client.Socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, ct);
    }
}
