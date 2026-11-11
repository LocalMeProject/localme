namespace LocalMe.DataPlane.Auth;

using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

public sealed record AuthTokenResponse(
    string AccessToken,
    string RefreshToken,
    string TokenType,
    int ExpiresInSeconds,
    string UserId,
    string Role
);

/// <summary>
/// Sovereign Ed25519 asymmetric JWT Token Service with per-project cryptographic key pairs.
/// Generates and verifies tokens adhering strictly to RFC 8032 and RFC 7519.
/// </summary>
public static class JwtTokenService
{
    private static readonly byte[] FallbackHmacSecret = Encoding.UTF8.GetBytes(
        Environment.GetEnvironmentVariable("LOCALME_JWT_SECRET") ?? "localme-secure-platform-jwt-secret-key-384b!"
    );

    // Global platform root Ed25519 keypair for console and admin access
    private static readonly Lazy<Ed25519.KeyPair> RootKeyPair = new(() =>
    {
        var seed = SHA256.HashData(FallbackHmacSecret);
        return new Ed25519.KeyPair(Ed25519.GetPublicKey(seed), seed);
    });

    public static Ed25519.KeyPair GetRootKeyPair() => RootKeyPair.Value;

    public static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static byte[]? Base64UrlDecode(string input)
    {
        try
        {
            var output = input.Replace('-', '+').Replace('_', '/');
            switch (output.Length % 4)
            {
                case 2: output += "=="; break;
                case 3: output += "="; break;
            }
            return Convert.FromBase64String(output);
        }
        catch
        {
            return null;
        }
    }

    public static AuthTokenResponse GenerateSessionToken(
        string userId,
        string role = "authenticated",
        int expiresInSeconds = 86400,
        string? scopedProjectId = null,
        byte[]? privateKeySeed = null,
        string? projectSlug = null)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var exp = now + expiresInSeconds;
        var audSlug = projectSlug ?? scopedProjectId ?? "platform";

        var headerJson = """{"alg":"EdDSA","typ":"JWT"}""";
        var payloadObj = new JsonObject
        {
            ["sub"] = userId,
            ["role"] = role,
            ["iss"] = "localme",
            ["aud"] = $"localme-{audSlug}",
            ["iat"] = now,
            ["exp"] = exp
        };

        if (!string.IsNullOrEmpty(scopedProjectId))
        {
            payloadObj["prj"] = scopedProjectId;
        }

        var headerB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(headerJson));
        var payloadB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadObj.ToJsonString()));
        var unsignedToken = $"{headerB64}.{payloadB64}";

        byte[] signingKey = privateKeySeed ?? RootKeyPair.Value.PrivateKey;
        byte[] sigBytes = Ed25519.Sign(signingKey, Encoding.UTF8.GetBytes(unsignedToken));
        var signatureB64 = Base64UrlEncode(sigBytes);

        var accessToken = $"{unsignedToken}.{signatureB64}";
        var refreshToken = $"rt_{Guid.NewGuid():N}_{Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant()}";

        return new AuthTokenResponse(
            AccessToken: accessToken,
            RefreshToken: refreshToken,
            TokenType: "Bearer",
            ExpiresInSeconds: expiresInSeconds,
            UserId: userId,
            Role: role);
    }

    public static (bool Valid, string? UserId, string? Role) ValidateToken(string token, byte[]? publicKey = null)
    {
        var (valid, userId, role, _) = ValidateTokenWithScope(token, publicKey);
        return (valid, userId, role);
    }

    public static (bool Valid, string? UserId, string? Role, string? ScopedProjectId) ValidateTokenWithScope(string token, byte[]? publicKey = null)
    {
        if (string.IsNullOrWhiteSpace(token)) return (false, null, null, null);

        // Normalize legacy prefix
        var cleanToken = token.StartsWith("ey.localme.", StringComparison.OrdinalIgnoreCase)
            ? token["ey.localme.".Length..]
            : token;

        var parts = cleanToken.Split('.');
        if (parts.Length != 3) return (false, null, null, null);

        var headerB64 = parts[0];
        var payloadB64 = parts[1];
        var sigB64 = parts[2];

        try
        {
            var headerBytes = Base64UrlDecode(headerB64);
            var payloadBytes = Base64UrlDecode(payloadB64);
            var sigBytes = Base64UrlDecode(sigB64);

            if (headerBytes == null || payloadBytes == null || sigBytes == null)
            {
                return (false, null, null, null);
            }

            var headerJson = Encoding.UTF8.GetString(headerBytes);
            var headerNode = JsonNode.Parse(headerJson) as JsonObject;
            var alg = headerNode?["alg"]?.ToString();

            var unsignedToken = $"{headerB64}.{payloadB64}";
            var unsignedBytes = Encoding.UTF8.GetBytes(unsignedToken);

            bool isValidSignature = false;
            if (string.Equals(alg, "EdDSA", StringComparison.OrdinalIgnoreCase) || string.Equals(alg, "Ed25519", StringComparison.OrdinalIgnoreCase))
            {
                byte[] verifyKey = publicKey ?? RootKeyPair.Value.PublicKey;
                isValidSignature = Ed25519.Verify(verifyKey, unsignedBytes, sigBytes);
                // Also fallback to root public key if project key failed
                if (!isValidSignature && publicKey != null)
                {
                    isValidSignature = Ed25519.Verify(RootKeyPair.Value.PublicKey, unsignedBytes, sigBytes);
                }
            }
            else if (string.Equals(alg, "HS256", StringComparison.OrdinalIgnoreCase))
            {
                // Backward-compatible fallback for HS256 tokens during migration
                using var hmac = new HMACSHA256(FallbackHmacSecret);
                var expectedSig = hmac.ComputeHash(unsignedBytes);
                isValidSignature = CryptographicOperations.FixedTimeEquals(expectedSig, sigBytes);
            }

            if (!isValidSignature) return (false, null, null, null);

            var payloadJson = Encoding.UTF8.GetString(payloadBytes);
            var payloadNode = JsonNode.Parse(payloadJson) as JsonObject;
            if (payloadNode == null) return (false, null, null, null);

            var exp = payloadNode["exp"]?.GetValue<long>() ?? 0;
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (exp > 0 && now > exp)
            {
                return (false, null, null, null); // Expired token
            }

            var nbf = payloadNode["nbf"]?.GetValue<long>() ?? 0;
            if (nbf > 0 && now < nbf - 60)
            {
                return (false, null, null, null); // Token not yet active (nbf)
            }

            var userId = payloadNode["sub"]?.ToString();
            var role = payloadNode["role"]?.ToString() ?? "authenticated";
            var scopedProjectId = payloadNode["prj"]?.ToString();

            return (true, userId, role, scopedProjectId);
        }
        catch
        {
            return (false, null, null, null);
        }
    }
}
