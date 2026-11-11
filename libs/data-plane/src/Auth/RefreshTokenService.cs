namespace LocalMe.DataPlane.Auth;

using System;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

public sealed record RefreshTokenRecord(
    string Id,
    string ProjectId,
    string UserId,
    string TokenHash,
    string FamilyId,
    bool Revoked,
    string? UserAgent,
    string? IpAddress,
    DateTimeOffset ExpiresAtUtc,
    DateTimeOffset CreatedAtUtc
);

/// <summary>
/// Refresh Token Rotation & Family Replay Detection Service (SSOT Section 5.2 & Milestone M2).
/// Validates and rotates refresh tokens via SHA-256 hash lookup.
/// Detects replayed refresh tokens and revokes the entire token family immediately.
/// </summary>
public sealed class RefreshTokenService
{
    // In-memory token store for test and development environments
    private readonly ConcurrentDictionary<string, RefreshTokenRecord> _tokensByHash = new();
    private readonly ConcurrentDictionary<string, ConcurrentBag<string>> _familyTokenHashes = new();

    public static string HashToken(string token)
    {
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim()));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static string GenerateTokenValue()
    {
        byte[] entropy = RandomNumberGenerator.GetBytes(32);
        return $"rt_{Convert.ToHexString(entropy).ToLowerInvariant()}";
    }

    public (string RawToken, RefreshTokenRecord Record) CreateToken(
        string projectId,
        string userId,
        string? familyId = null,
        string? userAgent = null,
        string? ipAddress = null,
        int lifetimeDays = 30)
    {
        string rawToken = GenerateTokenValue();
        string tokenHash = HashToken(rawToken);
        string famId = string.IsNullOrWhiteSpace(familyId) ? Guid.NewGuid().ToString("N") : familyId;

        var record = new RefreshTokenRecord(
            Id: $"tok_{Guid.NewGuid():N}"[..12],
            ProjectId: projectId,
            UserId: userId,
            TokenHash: tokenHash,
            FamilyId: famId,
            Revoked: false,
            UserAgent: userAgent,
            IpAddress: ipAddress,
            ExpiresAtUtc: DateTimeOffset.UtcNow.AddDays(lifetimeDays),
            CreatedAtUtc: DateTimeOffset.UtcNow
        );

        _tokensByHash[tokenHash] = record;
        _familyTokenHashes.GetOrAdd(famId, _ => new ConcurrentBag<string>()).Add(tokenHash);

        return (rawToken, record);
    }

    public (bool Success, string? Error, string? UserId, string? NewRawToken, RefreshTokenRecord? NewRecord) RotateToken(
        string projectId,
        string rawToken,
        string? userAgent = null,
        string? ipAddress = null)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
        {
            return (false, "توکن معتبر نمی‌باشد.", null, null, null);
        }

        string tokenHash = HashToken(rawToken);
        if (!_tokensByHash.TryGetValue(tokenHash, out var existing))
        {
            return (false, "توکن رفرش یافت نشد یا منقضی شده است.", null, null, null);
        }

        if (existing.ProjectId != projectId)
        {
            return (false, "توکن متعلق به این پروژه نمی‌باشد.", null, null, null);
        }

        // Family Replay Attack Detection: If token is already revoked, compromise detected!
        if (existing.Revoked)
        {
            RevokeFamily(existing.FamilyId);
            return (false, "حمله تکرار (Token Replay) تشخیص داده شد. تمامی توکن‌های خانواده ابطال گردید.", null, null, null);
        }

        if (DateTimeOffset.UtcNow > existing.ExpiresAtUtc)
        {
            return (false, "توکن رفرش منقضی شده است.", null, null, null);
        }

        // 1. Revoke the presented token (single-use rotation invariant with atomic CAS)
        var revokedOld = existing with { Revoked = true };
        if (!_tokensByHash.TryUpdate(tokenHash, revokedOld, existing))
        {
            if (_tokensByHash.TryGetValue(tokenHash, out var current) && current.Revoked)
            {
                RevokeFamily(existing.FamilyId);
                return (false, "حمله تکرار (Token Replay) تشخیص داده شد. تمامی توکن‌های خانواده ابطال گردید.", null, null, null);
            }
            return (false, "تداخل در چرخش همزمان توکن. لطفا دوباره تلاش فرمایید.", null, null, null);
        }

        // 2. Issue a new token in the same family
        var (newRawToken, newRecord) = CreateToken(
            projectId: projectId,
            userId: existing.UserId,
            familyId: existing.FamilyId,
            userAgent: userAgent ?? existing.UserAgent,
            ipAddress: ipAddress ?? existing.IpAddress
        );

        return (true, null, existing.UserId, newRawToken, newRecord);
    }

    public void RevokeFamily(string familyId)
    {
        if (_familyTokenHashes.TryGetValue(familyId, out var hashes))
        {
            foreach (var hash in hashes)
            {
                if (_tokensByHash.TryGetValue(hash, out var tok))
                {
                    _tokensByHash[hash] = tok with { Revoked = true };
                }
            }
        }
    }

    public bool RevokeToken(string rawToken)
    {
        string tokenHash = HashToken(rawToken);
        if (_tokensByHash.TryGetValue(tokenHash, out var tok))
        {
            _tokensByHash[tokenHash] = tok with { Revoked = true };
            return true;
        }
        return false;
    }
}
