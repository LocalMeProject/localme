namespace LocalMe.DataPlane.Network;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public enum EgressRegion
{
    Auto,
    DomesticIran,
    InternationalEurope
}

public sealed class OutboundEgressDispatcher : IDisposable
{
    private static readonly HashSet<string> KnownDomesticDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "shaparak.ir", "sep.ir", "samanepay.ir", "asanpardakht.ir", "sadadpsp.ir",
        "zarinpal.com", "pay.ir", "idpay.ir", "kavenegar.com", "ghasedak.me",
        "digikala.com", "snapp.ir", "torob.com", "divar.ir", "balad.ir", "neshan.org"
    };

    private static readonly HashSet<string> KnownInternationalDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "api.telegram.org", "api.openai.com", "fcm.googleapis.com", "discord.com",
        "api.stripe.com", "api.github.com", "api.anthropic.com", "registry.npmjs.org"
    };

    // Cache of resolved IP classifications
    private readonly ConcurrentDictionary<string, EgressRegion> _dnsCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly HttpClient _domesticClient;
    private readonly HttpClient _internationalClient;

    public OutboundEgressDispatcher(string? foreignEgressProxyUrl = null)
    {
        var domesticHandler = new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(15),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
            MaxConnectionsPerServer = 100,
            EnableMultipleHttp2Connections = true,
            AllowAutoRedirect = false,
            ConnectCallback = CreateSsrfGuardedConnectCallback()
        };
        _domesticClient = new HttpClient(domesticHandler);

        // International client tunnels via pure IPv4 TCP 443 TLS 1.3
        var intlHandler = new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(15),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
            MaxConnectionsPerServer = 100,
            EnableMultipleHttp2Connections = true,
            AllowAutoRedirect = false,
            ConnectCallback = CreateSsrfGuardedConnectCallback()
        };

        if (!string.IsNullOrWhiteSpace(foreignEgressProxyUrl) && Uri.TryCreate(foreignEgressProxyUrl, UriKind.Absolute, out var proxyUri))
        {
            intlHandler.Proxy = new WebProxy(proxyUri);
            intlHandler.UseProxy = true;
        }

        _internationalClient = new HttpClient(intlHandler);
    }

    public async Task<EgressRegion> ClassifyDestinationAsync(Uri uri, EgressRegion requestedOverride = EgressRegion.Auto)
    {
        if (requestedOverride != EgressRegion.Auto)
        {
            return requestedOverride;
        }

        var host = uri.Host.ToLowerInvariant();

        // 1. Fast catalog lookup
        foreach (var dom in KnownDomesticDomains)
        {
            if (host == dom || host.EndsWith("." + dom, StringComparison.OrdinalIgnoreCase))
            {
                return EgressRegion.DomesticIran;
            }
        }

        foreach (var dom in KnownInternationalDomains)
        {
            if (host == dom || host.EndsWith("." + dom, StringComparison.OrdinalIgnoreCase))
            {
                return EgressRegion.InternationalEurope;
            }
        }

        if (host.EndsWith(".ir", StringComparison.OrdinalIgnoreCase))
        {
            return EgressRegion.DomesticIran;
        }

        // 2. ASN / IP lookup cache
        if (_dnsCache.TryGetValue(host, out var cachedRegion))
        {
            return cachedRegion;
        }

        try
        {
            var addresses = await Dns.GetHostAddressesAsync(host);
            var isDomestic = false;

            foreach (var addr in addresses)
            {
                if (addr.AddressFamily == AddressFamily.InterNetwork)
                {
                    var b = addr.GetAddressBytes();
                    // Detect well-known Iranian national IP blocks (e.g., 185.143.*, 5.160.*, 2.144.*, 91.98.*)
                    if (b[0] == 185 && (b[1] == 143 || b[1] == 160 || b[1] == 208 || b[1] == 211 || b[1] == 239) ||
                        b[0] == 5 && (b[1] >= 160 && b[1] <= 163) ||
                        b[0] == 91 && (b[1] == 98 || b[1] == 99 || b[1] == 108 || b[1] == 232) ||
                        b[0] == 94 && (b[1] == 101 || b[1] == 182 || b[1] == 183) ||
                        b[0] == 2 && (b[1] >= 144 && b[1] <= 147))
                    {
                        isDomestic = true;
                        break;
                    }
                }
            }

            var detected = isDomestic ? EgressRegion.DomesticIran : EgressRegion.InternationalEurope;
            _dnsCache[host] = detected;
            return detected;
        }
        catch
        {
            // Fallback to domestic on resolution failure
            return EgressRegion.DomesticIran;
        }
    }

    public async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, EgressRegion requestedOverride = EgressRegion.Auto, CancellationToken ct = default)
    {
        var targetRegion = await ClassifyDestinationAsync(request.RequestUri!, requestedOverride);
        var client = targetRegion == EgressRegion.DomesticIran ? _domesticClient : _internationalClient;
        return await client.SendAsync(request, ct);
    }

    public static bool IsPrivateOrRestrictedIp(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip)) return true;

        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (ip.Equals(IPAddress.IPv6Any) ||
                ip.Equals(IPAddress.IPv6Loopback) ||
                ip.Equals(IPAddress.IPv6None) ||
                ip.IsIPv6LinkLocal ||
                ip.IsIPv6SiteLocal ||
                ip.IsIPv6Multicast)
            {
                return true;
            }

            var b = ip.GetAddressBytes();
            // Unique Local Addresses (fc00::/7)
            if ((b[0] & 0xFE) == 0xFC) return true;
            // IPv6 Documentation prefix (2001:db8::/32)
            if (b[0] == 0x20 && b[1] == 0x01 && b[2] == 0x0D && b[3] == 0xB8) return true;

            return false;
        }

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();

            // 0.0.0.0/8 (Current network)
            if (b[0] == 0) return true;

            // 10.0.0.0/8 (RFC 1918)
            if (b[0] == 10) return true;

            // 127.0.0.0/8 (Loopback)
            if (b[0] == 127) return true;

            // 100.64.0.0/10 (CGNAT / Shared Address Space - RFC 6598)
            if (b[0] == 100 && (b[1] & 0xC0) == 64) return true;

            // 169.254.0.0/16 (Link-Local / AWS/GCP/Azure Cloud Metadata 169.254.169.254)
            if (b[0] == 169 && b[1] == 254) return true;

            // 172.16.0.0/12 (RFC 1918)
            if (b[0] == 172 && (b[1] >= 16 && b[1] <= 31)) return true;

            // 192.168.0.0/16 (RFC 1918)
            if (b[0] == 192 && b[1] == 168) return true;

            // 224.0.0.0/4 (Multicast)
            if ((b[0] & 0xF0) == 224) return true;

            // 240.0.0.0/4 (Reserved)
            if ((b[0] & 0xF0) == 240) return true;

            // 255.255.255.255 (Broadcast)
            if (b[0] == 255 && b[1] == 255 && b[2] == 255 && b[3] == 255) return true;

            return false;
        }

        return true;
    }

    private static Func<SocketsHttpConnectionContext, CancellationToken, ValueTask<Stream>> CreateSsrfGuardedConnectCallback()
    {
        return async (context, ct) =>
        {
            var host = context.DnsEndPoint.Host;
            IPAddress[] addresses;
            if (IPAddress.TryParse(host, out var directIp))
            {
                addresses = [directIp];
            }
            else
            {
                addresses = await Dns.GetHostAddressesAsync(host, ct);
            }

            if (addresses.Length == 0)
            {
                throw new SocketException((int)SocketError.HostNotFound);
            }

            foreach (var addr in addresses)
            {
                if (IsPrivateOrRestrictedIp(addr))
                {
                    throw new InvalidOperationException($"SSRF Protection: Host '{host}' resolved to restricted IP address '{addr}'.");
                }
            }

            var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(addresses, context.DnsEndPoint.Port, ct);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch
            {
                socket.Dispose();
                throw;
            }
        };
    }

    public static async Task ValidateDestinationUriAsync(Uri uri, CancellationToken ct = default)
    {
        var host = uri.Host;
        if (IPAddress.TryParse(host, out var directIp))
        {
            if (IsPrivateOrRestrictedIp(directIp))
            {
                throw new InvalidOperationException($"SSRF Protection: Access to private or restricted IP address '{directIp}' is forbidden.");
            }
            return;
        }

        var addresses = await Dns.GetHostAddressesAsync(host, ct);
        if (addresses.Length == 0)
        {
            throw new SocketException((int)SocketError.HostNotFound);
        }

        foreach (var addr in addresses)
        {
            if (IsPrivateOrRestrictedIp(addr))
            {
                throw new InvalidOperationException($"SSRF Protection: Host '{host}' resolved to restricted IP address '{addr}'.");
            }
        }
    }

    public async Task<EgressFetchResult> EgressFetchAsync(
        string url,
        string method = "GET",
        IDictionary<string, string>? headers = null,
        string? body = null,
        int timeoutSeconds = 10,
        CancellationToken ct = default)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new ArgumentException($"Only HTTP and HTTPS URLs are supported: '{url}'.");
        }

        await ValidateDestinationUriAsync(uri, ct);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(timeoutSeconds, 1, 30)));

        var currentUri = uri;
        var currentMethod = new HttpMethod(method);
        int maxRedirects = 5;

        for (int hop = 0; hop <= maxRedirects; hop++)
        {
            var req = new HttpRequestMessage(currentMethod, currentUri);
            if (headers != null)
            {
                foreach (var (k, v) in headers)
                {
                    if (k.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    req.Headers.TryAddWithoutValidation(k, v);
                }
            }

            if (!string.IsNullOrEmpty(body) && (currentMethod == HttpMethod.Post || currentMethod == HttpMethod.Put || currentMethod == HttpMethod.Patch))
            {
                var contentType = headers != null && headers.TryGetValue("Content-Type", out var ctHeader) ? ctHeader : "application/json";
                req.Content = new StringContent(body, Encoding.UTF8, contentType);
            }

            var resp = await SendAsync(req, ct: cts.Token);

            if ((int)resp.StatusCode >= 300 && (int)resp.StatusCode <= 399 && resp.Headers.Location != null)
            {
                if (hop == maxRedirects)
                {
                    throw new InvalidOperationException("Too many redirects (maximum 5 hops allowed).");
                }

                var nextUri = new Uri(currentUri, resp.Headers.Location);
                if (nextUri.Scheme != Uri.UriSchemeHttp && nextUri.Scheme != Uri.UriSchemeHttps)
                {
                    throw new InvalidOperationException($"Invalid redirect scheme '{nextUri.Scheme}'.");
                }

                await ValidateDestinationUriAsync(nextUri, cts.Token);
                currentUri = nextUri;
                if (resp.StatusCode == HttpStatusCode.SeeOther)
                {
                    currentMethod = HttpMethod.Get;
                    body = null;
                }
                continue;
            }

            var responseBody = await resp.Content.ReadAsStringAsync(cts.Token);
            var headerDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var h in resp.Headers)
            {
                headerDict[h.Key] = string.Join(", ", h.Value);
            }
            foreach (var h in resp.Content.Headers)
            {
                headerDict[h.Key] = string.Join(", ", h.Value);
            }

            return new EgressFetchResult(
                Ok: resp.IsSuccessStatusCode,
                Status: (int)resp.StatusCode,
                StatusText: resp.ReasonPhrase ?? resp.StatusCode.ToString(),
                Headers: headerDict,
                Body: responseBody
            );
        }

        throw new InvalidOperationException("Unexpected redirect loop.");
    }

    public void Dispose()
    {
        _domesticClient.Dispose();
        _internationalClient.Dispose();
    }
}

public sealed record EgressFetchResult(
    bool Ok,
    int Status,
    string StatusText,
    IReadOnlyDictionary<string, string> Headers,
    string Body
);
