namespace LocalMe.DataPlane.Auth;

using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

public sealed record CaptchaChallenge(string CaptchaId, string Svg, string CodeForTesting, int ExpiresInSeconds);

/// <summary>
/// Lightweight, dependency-free SVG Captcha engine for BaaS tenant projects.
/// Generates visual security challenges and verifies single-use tokens to protect against brute-force & bots.
/// </summary>
public sealed class CaptchaService
{
    private sealed record CaptchaEntry(string Code, DateTimeOffset ExpiresAt);
    private readonly ConcurrentDictionary<string, CaptchaEntry> _captchas = new();

    public CaptchaChallenge Generate(int length = 5, int ttlSeconds = 180)
    {
        // Periodic cleanup of expired tokens
        var now = DateTimeOffset.UtcNow;
        if (_captchas.Count > 200)
        {
            foreach (var (k, v) in _captchas)
            {
                if (now > v.ExpiresAt) _captchas.TryRemove(k, out _);
            }
        }

        const string chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        var sb = new StringBuilder();
        for (int i = 0; i < length; i++)
        {
            sb.Append(chars[RandomNumberGenerator.GetInt32(0, chars.Length)]);
        }
        var code = sb.ToString();
        var captchaId = $"cap_{Guid.NewGuid():N}";
        _captchas[captchaId] = new CaptchaEntry(code, now.AddSeconds(ttlSeconds));

        var width = 140;
        var height = 44;
        var svgBuilder = new StringBuilder();
        svgBuilder.Append(System.Globalization.CultureInfo.InvariantCulture, $"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" style="border-radius: 4px; background: #f8fafc; border: 1px solid #cbd5e1; user-select: none;">""");

        // Decorative noise lines
        for (int i = 0; i < 4; i++)
        {
            var x1 = RandomNumberGenerator.GetInt32(0, width);
            var y1 = RandomNumberGenerator.GetInt32(0, height);
            var x2 = RandomNumberGenerator.GetInt32(0, width);
            var y2 = RandomNumberGenerator.GetInt32(0, height);
            svgBuilder.Append(System.Globalization.CultureInfo.InvariantCulture, $"""<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#94a3b8" stroke-width="1" stroke-opacity="0.4" />""");
        }

        // Render characters with slight rotation jitter
        for (int i = 0; i < code.Length; i++)
        {
            var x = 16 + (i * 24);
            var y = 28 + RandomNumberGenerator.GetInt32(-3, 4);
            var rot = RandomNumberGenerator.GetInt32(-15, 16);
            svgBuilder.Append(System.Globalization.CultureInfo.InvariantCulture, $"""<text x="{x}" y="{y}" font-family="sans-serif" font-size="22" font-weight="bold" fill="#0f172a" transform="rotate({rot} {x} {y})">{code[i]}</text>""");
        }

        svgBuilder.Append("</svg>");

        return new CaptchaChallenge(captchaId, svgBuilder.ToString(), code, ttlSeconds);
    }

    public bool Verify(string captchaId, string inputCode)
    {
        if (string.IsNullOrWhiteSpace(captchaId) || string.IsNullOrWhiteSpace(inputCode)) return false;
        if (!_captchas.TryRemove(captchaId.Trim(), out var entry)) return false;
        if (DateTimeOffset.UtcNow > entry.ExpiresAt) return false;
        return string.Equals(entry.Code, inputCode.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
