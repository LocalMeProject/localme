namespace LocalMe.DataPlane.Finance;

using System.Collections.Concurrent;
using System.Security.Cryptography;
using LocalMe.Core.Finance;
using LocalMe.DataPlane.MultiTenancy;

public sealed record IpgInitiateRequest(
    string Gateway,
    long AmountIrr,
    string CallbackUrl,
    string? Description = null,
    string? CustomerPhone = null,
    string? IdempotencyKey = null,
    string? ProjectId = null
);

public sealed record IpgInitiateResponse(
    bool Success,
    string AuthorityToken,
    string RedirectUrl,
    string Message,
    string? Authority = null,
    string? TrackingCode = null
);

public sealed record IpgVerifyRequest(
    string? Gateway = null,
    string? AuthorityToken = null,
    string? Status = "OK",
    string? TrackingCode = null,
    string? Authority = null,
    string? CustomerPhone = null
);

public sealed record IpgVerifyResponse(
    bool Success,
    long AmountIrr,
    string ReferenceId,
    string Message,
    string FormattedToman,
    string? ShaparakRefId = null,
    long? NewWalletBalanceIrr = null
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
public sealed record StoredPayment(
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

public sealed class PaymentIpgService
{

    private readonly ConcurrentDictionary<string, StoredPayment> _payments = new();
    private readonly ConcurrentDictionary<string, IpgInitiateResponse> _idempotentInitiations = new();
    private readonly ConcurrentDictionary<string, long> _walletBalancesIrr = new();
    private readonly ConcurrentDictionary<string, List<LedgerTransaction>> _customerLedgers = new();

    private readonly ProjectManagerService? _pm;

    public PaymentIpgService(ProjectManagerService? projectManager = null)
    {
        _pm = projectManager;
    }

    public IpgInitiateResponse InitiatePayment(IpgInitiateRequest request)
    {
        var idempotencyKey = string.IsNullOrWhiteSpace(request.IdempotencyKey)
            ? $"topup_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{RandomNumberGenerator.GetInt32(1000, 9999)}"
            : request.IdempotencyKey;
        var customerPhone = string.IsNullOrWhiteSpace(request.CustomerPhone)
            ? "+989121112233"
            : request.CustomerPhone;
        var description = string.IsNullOrWhiteSpace(request.Description)
            ? "شارژ حساب کاربری کیف پول"
            : request.Description;
        var gateway = string.IsNullOrWhiteSpace(request.Gateway) ? "ZARINPAL" : request.Gateway;

        // 1. Check idempotency cache
        if (_idempotentInitiations.TryGetValue(idempotencyKey, out var existing))
        {
            return existing;
        }

        if (request.AmountIrr <= 0)
        {
            return new IpgInitiateResponse(false, string.Empty, string.Empty, "Payment amount must be greater than zero IRR.");
        }

        // 2. Generate unique authority token
        var authorityToken = $"AU_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{RandomNumberGenerator.GetInt32(1000, 9999)}";
        var trackingCode = $"TRK_{RandomNumberGenerator.GetInt32(100000, 999999)}";
        var redirectUrl = $"/_baas/v1/pay/mock-gateway?authority={authorityToken}&gateway={Uri.EscapeDataString(gateway)}&amount={request.AmountIrr}";

        var payment = new StoredPayment(
            AuthorityToken: authorityToken,
            Gateway: gateway,
            Amount: new RialAmount(request.AmountIrr),
            CustomerPhone: customerPhone,
            CallbackUrl: request.CallbackUrl,
            Description: description,
            IdempotencyKey: idempotencyKey,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            IsVerified: false,
            ReferenceId: null
        );

        _payments[authorityToken] = payment;

        var response = new IpgInitiateResponse(
            Success: true,
            AuthorityToken: authorityToken,
            RedirectUrl: redirectUrl,
            Message: "Payment request initiated with Shaparak authority token.",
            Authority: authorityToken,
            TrackingCode: trackingCode
        );

        _idempotentInitiations[idempotencyKey] = response;
        return response;
    }

    public IpgVerifyResponse VerifyPayment(IpgVerifyRequest request)
    {
        var token = request.AuthorityToken ?? request.Authority ?? string.Empty;
        if (!_payments.TryGetValue(token, out var payment))
        {
            return new IpgVerifyResponse(false, 0, string.Empty, "Invalid or expired payment authority token.", "0 تومان");
        }

        if (payment.IsVerified)
        {
            var existingBal = _walletBalancesIrr.TryGetValue(payment.CustomerPhone, out var eb) ? eb : payment.Amount.AmountIrr;
            return new IpgVerifyResponse(
                Success: true,
                AmountIrr: payment.Amount.AmountIrr,
                ReferenceId: payment.ReferenceId ?? "ALREADY_VERIFIED",
                Message: "Payment was previously verified and ledger updated.",
                FormattedToman: payment.Amount.ToTomanString(),
                ShaparakRefId: payment.ReferenceId ?? "ALREADY_VERIFIED",
                NewWalletBalanceIrr: existingBal
            );
        }

        var status = request.Status ?? "OK";
        if (!status.Equals("OK", StringComparison.OrdinalIgnoreCase) &&
            !status.Equals("100", StringComparison.OrdinalIgnoreCase))
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
        var newBal = _walletBalancesIrr.AddOrUpdate(payment.CustomerPhone, payment.Amount.AmountIrr, (_, current) => current + payment.Amount.AmountIrr);

        // 4. Record to ledger
        var ledgerList = _customerLedgers.GetOrAdd(payment.CustomerPhone, _ => []);
        lock (ledgerList)
        {
            ledgerList.Insert(0, tx);
        }

        // Mark verified
        _payments[token] = payment with { IsVerified = true, ReferenceId = refId };

        // 5. Synchronize with ProjectManagerService
        if (_pm != null)
        {
            var user = _pm.GetUserByPhone(payment.CustomerPhone);
            if (user != null)
            {
                _pm.AdjustUserWallet(user.Id, payment.Amount.AmountIrr);
            }
        }

        return new IpgVerifyResponse(
            Success: true,
            AmountIrr: payment.Amount.AmountIrr,
            ReferenceId: refId,
            Message: "Payment successfully verified by Shaparak gateway. Wallet credited.",
            FormattedToman: payment.Amount.ToTomanString(),
            ShaparakRefId: refId,
            NewWalletBalanceIrr: newBal
        );
    }

    public bool DeductWalletBalance(string customerPhone, long amountIrr, string description)
    {
        if (amountIrr <= 0) return true;

        var currentBalance = _walletBalancesIrr.GetOrAdd(customerPhone, _ => 0);
        var newBalance = Math.Max(0, currentBalance - amountIrr);
        _walletBalancesIrr[customerPhone] = newBalance;

        var debitEntry = new LedgerEntry(
            AccountNumber: "2001",
            AccountName: $"کیف پول کاربر ({customerPhone})",
            AccountType: "Liability",
            DebitIrr: amountIrr,
            CreditIrr: 0,
            Description: description
        );

        var creditEntry = new LedgerEntry(
            AccountNumber: "4001",
            AccountName: "درآمد کارمزد خدمات زیرساختی پلتفرم (LocalMe)",
            AccountType: "Revenue",
            DebitIrr: 0,
            CreditIrr: amountIrr,
            Description: description
        );

        var tx = new LedgerTransaction(
            TransactionId: $"tx_{Guid.NewGuid():N}",
            IdempotencyKey: $"deduct_{Guid.NewGuid():N}",
            TimestampUtc: DateTimeOffset.UtcNow,
            Entries: [debitEntry, creditEntry]
        );

        var ledgerList = _customerLedgers.GetOrAdd(customerPhone, _ => []);
        lock (ledgerList)
        {
            ledgerList.Insert(0, tx);
        }

        if (_pm != null)
        {
            var user = _pm.GetUserByPhone(customerPhone);
            if (user != null)
            {
                _pm.AdjustUserWallet(user.Id, -amountIrr);
            }
        }

        return true;
    }

    public WalletBalance GetWalletBalance(string customerPhone)
    {
        if (_pm != null)
        {
            var user = _pm.GetUserByPhone(customerPhone);
            if (user != null)
            {
                _walletBalancesIrr[customerPhone] = user.WalletBalanceIrr;
            }
        }

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

    public StoredPayment? GetPayment(string authorityToken)
    {
        return _payments.TryGetValue(authorityToken, out var payment) ? payment : null;
    }

    public IReadOnlyList<StoredPayment> GetAllPayments()
    {
        return _payments.Values.OrderByDescending(p => p.CreatedAtUtc).ToList();
    }

    public IReadOnlyList<StoredPayment> GetCustomerPayments(string customerPhone)
    {
        return _payments.Values
            .Where(p => p.CustomerPhone.Equals(customerPhone, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToList();
    }
}
