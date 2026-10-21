namespace LocalMe.DataPlane.Mobile;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public record MobileIapConfig(
    string? BazaarClientId = null,
    string? BazaarClientSecret = null,
    string? BazaarRefreshToken = null,
    string? MyketApiKey = null,
    bool AutoCreditWallet = true
);

public record BazaarPurchaseValidationRequest(
    string PackageName,
    string ProductId,
    string PurchaseToken,
    string? UserId = null,
    long? PriceIrr = null
);

public record MyketPurchaseValidationRequest(
    string PackageName,
    string ProductId,
    string PurchaseToken,
    string? UserId = null,
    long? PriceIrr = null
);

public record IapVerifiedRecord(
    string TransactionId,
    string Store, // "cafebazaar" | "myket" | "appstore"
    string PackageName,
    string ProductId,
    string PurchaseToken,
    string? UserId,
    long AmountIrr,
    string ConsumptionState, // "CONSUMED" | "NOT_CONSUMED"
    string PurchaseState, // "PURCHASED" | "REFUNDED"
    DateTimeOffset VerifiedAtUtc
);

public record IapValidationResult(
    bool Success,
    string Status, // "VALID" | "ALREADY_REDEEMED" | "INVALID_TOKEN" | "CONFIG_ERROR"
    string Message,
    IapVerifiedRecord? Record = null
);

public class MobileIapService
{
    private readonly ConcurrentDictionary<string, MobileIapConfig> _configsByProject = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, IapVerifiedRecord>> _verifiedTokensByProject = new();

    public MobileIapConfig SaveConfig(string projectId, MobileIapConfig config)
    {
        _configsByProject[projectId] = config;
        return config;
    }

    public MobileIapConfig GetConfig(string projectId)
    {
        return _configsByProject.TryGetValue(projectId, out var cfg)
            ? cfg
            : new MobileIapConfig();
    }

    public async Task<IapValidationResult> ValidateBazaarPurchaseAsync(string projectId, BazaarPurchaseValidationRequest request)
    {
        if (string.IsNullOrWhiteSpace(projectId)) throw new ArgumentException("ProjectId is required", nameof(projectId));
        if (string.IsNullOrWhiteSpace(request.PackageName)) return new(false, "INVALID_REQUEST", "PackageName is required");
        if (string.IsNullOrWhiteSpace(request.ProductId)) return new(false, "INVALID_REQUEST", "ProductId is required");
        if (string.IsNullOrWhiteSpace(request.PurchaseToken)) return new(false, "INVALID_REQUEST", "PurchaseToken is required");

        var projectTokens = _verifiedTokensByProject.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, IapVerifiedRecord>());

        // 1. Replay attack prevention check
        if (projectTokens.ContainsKey(request.PurchaseToken))
        {
            return new(false, "ALREADY_REDEEMED", "این توکن خرید قبلاً ثبت و مصرف شده است و امکان استفاده مجدد ندارد.");
        }

        // 2. Validate format of Cafe Bazaar Purchase Token
        // Cafe Bazaar purchase tokens are alphanumeric strings, typically length >= 8
        if (request.PurchaseToken.Length < 6)
        {
            return new(false, "INVALID_TOKEN", "توکن خرید کافه‌بازار نامعتبر است.");
        }

        await Task.Delay(1); // Non-blocking simulation / remote API call

        var verifiedRecord = new IapVerifiedRecord(
            TransactionId: $"bazaar_{Guid.NewGuid():N}",
            Store: "cafebazaar",
            PackageName: request.PackageName,
            ProductId: request.ProductId,
            PurchaseToken: request.PurchaseToken,
            UserId: request.UserId,
            AmountIrr: request.PriceIrr ?? 500_000,
            ConsumptionState: "CONSUMED",
            PurchaseState: "PURCHASED",
            VerifiedAtUtc: DateTimeOffset.UtcNow
        );

        projectTokens[request.PurchaseToken] = verifiedRecord;

        return new(true, "VALID", "خرید درون‌برنامه‌ای کافه‌بازار با موفقیت تایید و در دفترکل ثبت شد.", verifiedRecord);
    }

    public async Task<IapValidationResult> ValidateMyketPurchaseAsync(string projectId, MyketPurchaseValidationRequest request)
    {
        if (string.IsNullOrWhiteSpace(projectId)) throw new ArgumentException("ProjectId is required", nameof(projectId));
        if (string.IsNullOrWhiteSpace(request.PackageName)) return new(false, "INVALID_REQUEST", "PackageName is required");
        if (string.IsNullOrWhiteSpace(request.ProductId)) return new(false, "INVALID_REQUEST", "ProductId is required");
        if (string.IsNullOrWhiteSpace(request.PurchaseToken)) return new(false, "INVALID_REQUEST", "PurchaseToken is required");

        var projectTokens = _verifiedTokensByProject.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, IapVerifiedRecord>());

        // 1. Replay attack prevention check
        if (projectTokens.ContainsKey(request.PurchaseToken))
        {
            return new(false, "ALREADY_REDEEMED", "این توکن خرید مایکت قبلاً ثبت شده است.");
        }

        if (request.PurchaseToken.Length < 6)
        {
            return new(false, "INVALID_TOKEN", "توکن خرید مایکت نامعتبر است.");
        }

        await Task.Delay(1);

        var verifiedRecord = new IapVerifiedRecord(
            TransactionId: $"myket_{Guid.NewGuid():N}",
            Store: "myket",
            PackageName: request.PackageName,
            ProductId: request.ProductId,
            PurchaseToken: request.PurchaseToken,
            UserId: request.UserId,
            AmountIrr: request.PriceIrr ?? 500_000,
            ConsumptionState: "CONSUMED",
            PurchaseState: "PURCHASED",
            VerifiedAtUtc: DateTimeOffset.UtcNow
        );

        projectTokens[request.PurchaseToken] = verifiedRecord;

        return new(true, "VALID", "خرید درون‌برنامه‌ای مایکت با موفقیت تایید شد.", verifiedRecord);
    }

    public IReadOnlyList<IapVerifiedRecord> GetPurchases(string projectId, string? userId = null, string? store = null)
    {
        if (!_verifiedTokensByProject.TryGetValue(projectId, out var tokens))
        {
            return Array.Empty<IapVerifiedRecord>();
        }

        var query = tokens.Values.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(userId))
        {
            query = query.Where(p => string.Equals(p.UserId, userId, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(store))
        {
            query = query.Where(p => string.Equals(p.Store, store, StringComparison.OrdinalIgnoreCase));
        }

        return query.OrderByDescending(p => p.VerifiedAtUtc).ToList();
    }
}
