namespace LocalMe.DataPlane.DynamicSql;

using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Nodes;

/// <summary>
/// Dynamic SQL REST Endpoint Middleware processor (Section 5.1 SSOT).
/// Provides PostgREST-compatible CRUD access with tenant schema isolation.
/// </summary>
public sealed class DynamicSqlHandler
{
    // In-memory tenant mock store for local standalone development
    private readonly ConcurrentDictionary<string, List<JsonObject>> _tenantTables = new();

    public DynamicSqlHandler()
    {
        // Seed initial tables for immediate local demonstration
        _tenantTables["products"] =
        [
            new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString(),
                ["title"] = "گوشی موبایل اپل مدل iPhone 16 Pro Max",
                ["price_irr"] = 980_000_000,
                ["stock"] = 14,
                ["category"] = "Electronics",
                ["created_at"] = DateTimeOffset.UtcNow.ToString("O")
            },
            new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString(),
                ["title"] = "لپ‌تاپ اپل مدل MacBook Pro 16 M4 Max",
                ["price_irr"] = 1_850_000_000,
                ["stock"] = 5,
                ["category"] = "Computers",
                ["created_at"] = DateTimeOffset.UtcNow.ToString("O")
            },
            new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString(),
                ["title"] = "هدفون بی‌سیم AirPods Pro 2",
                ["price_irr"] = 145_000_000,
                ["stock"] = 42,
                ["category"] = "Audio",
                ["created_at"] = DateTimeOffset.UtcNow.ToString("O")
            }
        ];

        _tenantTables["orders"] =
        [
            new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString(),
                ["customer_phone"] = "+989121112233",
                ["total_irr"] = 980_000_000,
                ["status"] = "COMPLETED",
                ["created_at"] = DateTimeOffset.UtcNow.AddHours(-2).ToString("O")
            }
        ];
    }

    public JsonArray QueryTable(string table, int limit = 50, string? filterCol = null, string? filterVal = null)
    {
        var safeTable = table.ToLowerInvariant().Trim();
        var rows = _tenantTables.GetOrAdd(safeTable, _ => []);

        IEnumerable<JsonObject> query = rows;
        if (!string.IsNullOrWhiteSpace(filterCol) && !string.IsNullOrWhiteSpace(filterVal))
        {
            query = query.Where(r => r[filterCol]?.ToString().Equals(filterVal, StringComparison.OrdinalIgnoreCase) == true);
        }

        var results = new JsonArray();
        foreach (var item in query.Take(limit))
        {
            results.Add(JsonNode.Parse(item.ToJsonString()));
        }

        return results;
    }

    public JsonObject InsertRow(string table, JsonObject payload)
    {
        var safeTable = table.ToLowerInvariant().Trim();
        var rows = _tenantTables.GetOrAdd(safeTable, _ => []);

        if (!payload.ContainsKey("id"))
        {
            payload["id"] = Guid.NewGuid().ToString();
        }

        if (!payload.ContainsKey("created_at"))
        {
            payload["created_at"] = DateTimeOffset.UtcNow.ToString("O");
        }

        rows.Add(payload);
        return payload;
    }

    public bool DeleteRow(string table, string id)
    {
        var safeTable = table.ToLowerInvariant().Trim();
        if (!_tenantTables.TryGetValue(safeTable, out var rows))
        {
            return false;
        }

        var countRemoved = rows.RemoveAll(r => r["id"]?.ToString() == id);
        return countRemoved > 0;
    }

    public IReadOnlyList<string> ListTables()
    {
        return _tenantTables.Keys.OrderBy(k => k).ToList();
    }
}
