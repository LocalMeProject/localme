namespace LocalMe.DataPlane.Network;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
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
            EnableMultipleHttp2Connections = true
        };
        _domesticClient = new HttpClient(domesticHandler);

        // International client tunnels via pure IPv4 TCP 443 TLS 1.3
        var intlHandler = new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(15),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
            MaxConnectionsPerServer = 100,
            EnableMultipleHttp2Connections = true
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

    public void Dispose()
    {
        _domesticClient.Dispose();
        _internationalClient.Dispose();
    }
}
