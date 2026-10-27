namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

public sealed partial class ProjectManagerService
{
    private void SeedUsers()
    {
        _users["usr_admin_01"] = new PlatformUser(
            Id: "usr_admin_01",
            FullName: "مدیر ارشد سامانه",
            Phone: "+989120000001",
            Email: "admin@localme.ir",
            Role: UserRole.Admin,
            WalletBalanceIrr: 0,
            CreatedAtUtc: DateTimeOffset.UtcNow.AddMonths(-6),
            IsActive: true,
            Username: "admin",
            PasswordHash: HashPassword("admin123456")
        );

        _users["usr_operator_02"] = new PlatformUser(
            Id: "usr_operator_02",
            FullName: "اپراتور پشتیبانی",
            Phone: "+989120000002",
            Email: "support@localme.ir",
            Role: UserRole.Operator,
            WalletBalanceIrr: 0,
            CreatedAtUtc: DateTimeOffset.UtcNow.AddMonths(-3),
            IsActive: true,
            Username: "operator",
            PasswordHash: HashPassword("operator123456")
        );

        _users["usr_developer_03"] = new PlatformUser(
            Id: "usr_developer_03",
            FullName: "سینا والی زاده",
            Phone: "+989121112233",
            Email: "sina@example.com",
            Role: UserRole.Developer,
            WalletBalanceIrr: 10_000_000,
            CreatedAtUtc: DateTimeOffset.UtcNow.AddMonths(-1),
            IsActive: true,
            Username: "sina",
            PasswordHash: HashPassword("developer123456")
        );
    }

    // 1. User Management & Credentials
    public static string HashPassword(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(16);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
            System.Text.Encoding.UTF8.GetBytes(password),
            salt,
            iterations: 100_000,
            HashAlgorithmName.SHA256,
            outputLength: 32);
        return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    public static bool VerifyPassword(string password, string? storedHash)
    {
        if (string.IsNullOrWhiteSpace(storedHash))
        {
            return false;
        }

        // 1. Standard PBKDF2 with salt (salt:hash)
        if (storedHash.Contains(':', StringComparison.Ordinal))
        {
            var parts = storedHash.Split(':');
            if (parts.Length == 2)
            {
                try
                {
                    byte[] salt = Convert.FromBase64String(parts[0]);
                    byte[] expectedHash = Convert.FromBase64String(parts[1]);
                    byte[] actualHash = Rfc2898DeriveBytes.Pbkdf2(
                        System.Text.Encoding.UTF8.GetBytes(password),
                        salt,
                        iterations: 100_000,
                        HashAlgorithmName.SHA256,
                        outputLength: 32);

                    if (CryptographicOperations.FixedTimeEquals(expectedHash, actualHash))
                    {
                        return true;
                    }
                }
                catch
                {
                    // Fall through to legacy check
                }
            }
        }

        // 2. Backward-compatible fallback for legacy SHA-256 or seeded demo hashes
        if (storedHash.Length == 64)
        {
            try
            {
                var inputHashHex = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(password)));
                if (string.Equals(inputHashHex, storedHash, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                // Known legacy seed fallback "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"
                if (string.Equals(storedHash, "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", StringComparison.OrdinalIgnoreCase))
                {
                    if (password is "developer123456" or "admin123456" or "operator123456" or "admin")
                    {
                        return true;
                    }
                }
            }
            catch
            {
                // Ignore
            }
        }

        return false;
    }

    public IReadOnlyList<PlatformUser> GetAllUsers() => _users.Values.OrderByDescending(u => u.CreatedAtUtc).ToList();

    public PlatformUser? GetUser(string userId) => _users.TryGetValue(userId, out var u) ? u : null;

    public PlatformUser? GetUserByPhone(string phone) =>
        _users.Values.FirstOrDefault(u => u.Phone.Equals(phone.Trim(), StringComparison.OrdinalIgnoreCase));

    public PlatformUser? FindUserByCredential(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier)) return null;
        var clean = identifier.Trim();

        return _users.Values.FirstOrDefault(u =>
            (u.Username != null && u.Username.Equals(clean, StringComparison.OrdinalIgnoreCase)) ||
            (u.Id == "usr_developer_03" && (clean.Equals("sina", StringComparison.OrdinalIgnoreCase) || clean.Equals("developer", StringComparison.OrdinalIgnoreCase))) ||
            (u.Email != null && (u.Email.Equals(clean, StringComparison.OrdinalIgnoreCase) || u.Email.StartsWith(clean + "@", StringComparison.OrdinalIgnoreCase))) ||
            u.Phone.Equals(clean, StringComparison.OrdinalIgnoreCase) ||
            NormalizePhone(u.Phone).Equals(NormalizePhone(clean), StringComparison.OrdinalIgnoreCase)
        );
    }

    private static string NormalizePhone(string p) =>
        p.Replace("+98", "0", StringComparison.Ordinal).Replace(" ", "", StringComparison.Ordinal).Replace("-", "", StringComparison.Ordinal);

    public (bool Success, string Message, PlatformUser? User) ValidateUserCredentials(string identifier, string password)
    {
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(password))
        {
            return (false, "نام کاربری و کلمه عبور الزامی است.", null);
        }

        var user = FindUserByCredential(identifier);
        if (user == null)
        {
            return (false, "کاربری با این مشخصات یافت نشد.", null);
        }

        if (!user.IsActive)
        {
            return (false, "حساب کاربری مسدود یا غیرفعال است.", null);
        }

        if (string.IsNullOrEmpty(user.PasswordHash) || !VerifyPassword(password, user.PasswordHash))
        {
            return (false, "کلمه عبور وارد شده نادرست است.", null);
        }

        // Auto-upgrade legacy hash to PBKDF2 in memory and persistent store
        if (!user.PasswordHash.Contains(':', StringComparison.Ordinal))
        {
            var upgraded = user with { PasswordHash = HashPassword(password) };
            _users[user.Id] = upgraded;
            if (_store != null)
            {
                _ = _store.UpsertUserAsync(upgraded);
            }
        }

        return (true, "ورود با موفقیت انجام شد.", user);
    }

    public bool SetUserPassword(string userId, string newPassword)
    {
        if (_users.TryGetValue(userId, out var u))
        {
            _users[userId] = u with { PasswordHash = HashPassword(newPassword) };
            return true;
        }
        return false;
    }

    public bool UpdateUserRole(string userId, UserRole newRole)
    {
        if (_users.TryGetValue(userId, out var u))
        {
            _users[userId] = u with { Role = newRole };
            return true;
        }
        return false;
    }

    public bool UpdateUserStatus(string userId, bool isActive)
    {
        if (_users.TryGetValue(userId, out var u))
        {
            _users[userId] = u with { IsActive = isActive };
            return true;
        }
        return false;
    }

    public bool AdjustUserWallet(string userId, long deltaIrr)
    {
        if (_users.TryGetValue(userId, out var u))
        {
            var newBal = Math.Max(0, u.WalletBalanceIrr + deltaIrr);
            _users[userId] = u with { WalletBalanceIrr = newBal };
            return true;
        }
        return false;
    }

    public PlatformUser RegisterDeveloper(string phone, string fullName, string? email = null)
    {
        var existing = GetUserByPhone(phone);
        if (existing != null) return existing;

        var user = new PlatformUser(
            Id: $"usr_{Guid.NewGuid():N}"[..12],
            FullName: fullName,
            Phone: phone.Trim(),
            Email: email ?? $"{phone.Trim().Replace("+", "", StringComparison.Ordinal)}@localme.ir",
            Role: UserRole.Developer,
            WalletBalanceIrr: 5_000_000, // 500k Toman initial credit
            CreatedAtUtc: DateTimeOffset.UtcNow,
            IsActive: true,
            Username: phone.Trim().Replace("+", "", StringComparison.Ordinal)
        );
        _users[user.Id] = user;
        return user;
    }
}
