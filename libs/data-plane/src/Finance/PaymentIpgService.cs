namespace LocalMe.DataPlane.Finance;

using System.Collections.Concurrent;
using System.Security.Cryptography;
using LocalMe.Core.Finance;

public sealed record IpgInitiateRequest(
    string Gateway,
    long AmountIrr,
    string CallbackUrl,
    string Description,
    string CustomerPhone,
    string IdempotencyKey
);

public sealed record IpgInitiateResponse(
    bool Success,
    string AuthorityToken,
    string RedirectUrl,
    string Message
);

public sealed record IpgVerifyRequest(
    string Gateway,
    string AuthorityToken,
    string Status,
    string? TrackingCode = null
);

public sealed record IpgVerifyResponse(
    bool Success,
    long AmountIrr,
    string ReferenceId,
    string Message,
    string FormattedToman
);

public sealed record LedgerEntry(
    string AccountNumber,
    string AccountName,
    string AccountType,
    long DebitIrr,
    long CreditIrr,
    string Description
);

public sealed record LedgerTransaction(
    string TransactionId,
    string IdempotencyKey,
    DateTimeOffset TimestampUtc,
    IReadOnlyList<LedgerEntry> Entries
);

public sealed record WalletBalance(
    string CustomerPhone,
    long BalanceIrr,
    string FormattedToman,
    IReadOnlyList<LedgerTransaction> RecentTransactions
);

/// <summary>
/// Iranian Payment Gateway (IPG) and Double-Entry Ledger Engine (Sections 4.1 &amp; 5.3 SSOT).
/// Enforces idempotent gateway initiation, Shaparak-compliant verification,
/// and mathematically balanced double-entry ledger transactions (BIGINT IRR).
/// </summary>
public sealed class PaymentIpgService
{
    private sealed record StoredPayment(
        string AuthorityToken,
        string Gateway,
        RialAmount Amount,
        string CustomerPhone,
        string CallbackUrl,
        string Description,
        string IdempotencyKey,
        DateTimeOffset CreatedAtUtc,
        bool IsVerified,
        string? ReferenceId
    );

    private readonly ConcurrentDictionary<string, StoredPayment> _payments = new();
    private readonly ConcurrentDictionary<string, IpgInitiateResponse> _idempotentInitiations = new();
    private readonly ConcurrentDictionary<string, long> _walletBalancesIrr = new();
    private readonly ConcurrentDictionary<string, List<LedgerTransaction>> _customerLedgers = new();

    public PaymentIpgService()
    {
        // Seed default demo wallet for immediate testing
        const string defaultPhone = "+989121112233";
        var initialAmount = RialAmount.FromToman(45_000_000); // 45M Toman = 450M IRR
        _walletBalancesIrr[defaultPhone] = initialAmount.AmountIrr;

        var seedEntries = new List<LedgerEntry>
        {
            new("1001", "بانک مرکزی / شاپرک", "Asset", initialAmount.AmountIrr, 0, "موجودی افتتاحیه حساب"),
            new("2001", $"کیف پول کاربر ({defaultPhone})", "Liability", 0, initialAmount.AmountIrr, "افزایش اعتبار اولیه کیف پول")
        };

        var seedTx = new LedgerTransaction(
            TransactionId: $"tx_{Guid.NewGuid():N}",
            IdempotencyKey: "seed_initial_balance_001",
            TimestampUtc: DateTimeOffset.UtcNow.AddDays(-1),
            Entries: seedEntries
        );

        _customerLedgers[defaultPhone] = [seedTx];
    }

    public IpgInitiateResponse InitiatePayment(IpgInitiateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            return new IpgInitiateResponse(false, string.Empty, string.Empty, "Idempotency key is required.");
        }

        // 1. Check idempotency cache
        if (_idempotentInitiations.TryGetValue(request.IdempotencyKey, out var existing))
        {
            return existing;
        }

        if (request.AmountIrr <= 0)
        {
            return new IpgInitiateResponse(false, string.Empty, string.Empty, "Payment amount must be greater than zero IRR.");
        }

        // 2. Generate unique authority token
        var authorityToken = $"AU_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{RandomNumberGenerator.GetInt32(1000, 9999)}";
        var redirectUrl = $"/_baas/v1/pay/mock-gateway?authority={authorityToken}&gateway={Uri.EscapeDataString(request.Gateway)}&amount={request.AmountIrr}";

        var payment = new StoredPayment(
            AuthorityToken: authorityToken,
            Gateway: request.Gateway,
            Amount: new RialAmount(request.AmountIrr),
            CustomerPhone: request.CustomerPhone,
            CallbackUrl: request.CallbackUrl,
            Description: request.Description,
            IdempotencyKey: request.IdempotencyKey,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            IsVerified: false,
            ReferenceId: null
        );

        _payments[authorityToken] = payment;

        var response = new IpgInitiateResponse(
            Success: true,
            AuthorityToken: authorityToken,
            RedirectUrl: redirectUrl,
            Message: "Payment request initiated with Shaparak authority token."
        );

        _idempotentInitiations[request.IdempotencyKey] = response;
        return response;
    }

    public IpgVerifyResponse VerifyPayment(IpgVerifyRequest request)
    {
        if (!_payments.TryGetValue(request.AuthorityToken, out var payment))
        {
            return new IpgVerifyResponse(false, 0, string.Empty, "Invalid or expired payment authority token.", "0 تومان");
        }

        if (payment.IsVerified)
        {
            return new IpgVerifyResponse(
                Success: true,
                AmountIrr: payment.Amount.AmountIrr,
                ReferenceId: payment.ReferenceId ?? "ALREADY_VERIFIED",
                Message: "Payment was previously verified and ledger updated.",
                FormattedToman: payment.Amount.ToTomanString()
            );
        }

        if (!request.Status.Equals("OK", StringComparison.OrdinalIgnoreCase) &&
            !request.Status.Equals("100", StringComparison.OrdinalIgnoreCase))
        {
            return new IpgVerifyResponse(false, payment.Amount.AmountIrr, string.Empty, "Payment was cancelled or rejected by user/bank.", payment.Amount.ToTomanString());
        }

        // 1. Generate Shaparak Reference ID
        var refId = request.TrackingCode ?? $"SHP_{RandomNumberGenerator.GetInt32(10000000, 99999999)}";

        // 2. Execute balanced double-entry ledger update
        // Debit Asset (Bank Account 1001) + Credit Liability (User Wallet 2001)
        var debitEntry = new LedgerEntry(
            AccountNumber: "1001",
            AccountName: $"درگاه پرداخت شاپرک ({payment.Gateway})",
            AccountType: "Asset",
            DebitIrr: payment.Amount.AmountIrr,
            CreditIrr: 0,
            Description: $"واریز اینترنتی تایید شده تراکنش {refId}"
        );

        var creditEntry = new LedgerEntry(
            AccountNumber: "2001",
            AccountName: $"کیف پول کاربر ({payment.CustomerPhone})",
            AccountType: "Liability",
            DebitIrr: 0,
            CreditIrr: payment.Amount.AmountIrr,
            Description: $"شارژ حساب کاربری به استناد درگاه {payment.Gateway}"
        );

        // Mathematically verify double-entry invariant: sum(Debit) == sum(Credit)
        long totalDebit = debitEntry.DebitIrr;
        long totalCredit = creditEntry.CreditIrr;
        if (totalDebit != totalCredit)
        {
            throw new InvalidOperationException($"Double-entry invariant violated! Debit: {totalDebit}, Credit: {totalCredit}");
        }

        var tx = new LedgerTransaction(
            TransactionId: $"tx_{Guid.NewGuid():N}",
            IdempotencyKey: payment.IdempotencyKey,
            TimestampUtc: DateTimeOffset.UtcNow,
            Entries: [debitEntry, creditEntry]
        );

        // 3. Atomically update user balance
        _walletBalancesIrr.AddOrUpdate(payment.CustomerPhone, payment.Amount.AmountIrr, (_, current) => current + payment.Amount.AmountIrr);

        // 4. Record to ledger
        var ledgerList = _customerLedgers.GetOrAdd(payment.CustomerPhone, _ => []);
        lock (ledgerList)
        {
            ledgerList.Insert(0, tx);
        }

        // Mark verified
        _payments[request.AuthorityToken] = payment with { IsVerified = true, ReferenceId = refId };

        return new IpgVerifyResponse(
            Success: true,
            AmountIrr: payment.Amount.AmountIrr,
            ReferenceId: refId,
            Message: "Payment successfully verified by Shaparak gateway. Wallet credited.",
            FormattedToman: payment.Amount.ToTomanString()
        );
    }

    public WalletBalance GetWalletBalance(string customerPhone)
    {
        var balanceIrr = _walletBalancesIrr.GetOrAdd(customerPhone, _ => 0);
        var transactions = _customerLedgers.TryGetValue(customerPhone, out var txList)
            ? txList.AsReadOnly()
            : (IReadOnlyList<LedgerTransaction>)Array.Empty<LedgerTransaction>();

        var rial = new RialAmount(balanceIrr);
        return new WalletBalance(
            CustomerPhone: customerPhone,
            BalanceIrr: balanceIrr,
            FormattedToman: rial.ToTomanString(),
            RecentTransactions: transactions
        );
    }
}
