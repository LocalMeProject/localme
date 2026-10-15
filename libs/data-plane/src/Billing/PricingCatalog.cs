namespace LocalMe.DataPlane.Billing;

using System.Text.Json.Serialization;

/// <summary>
/// Superadmin-configurable BaaS pricing catalog and system operational variables.
/// All monetary values are strictly in Iranian Rial (IRR) 64-bit integer units.
/// </summary>
public sealed class PricingCatalog
{
    private readonly object _lock = new();

    public long DbQueryPer1kIrr { get; private set; } = 100; // 100 IRR per 1,000 DB queries (10 Toman)
    public long StorageGbMonthIrr { get; private set; } = 500; // 500 IRR per GB/month (50 Toman)
    public long SmsPerMessageIrr { get; private set; } = 800; // 800 IRR per dispatched SMS OTP (80 Toman)
    public long ComputePer100msIrr { get; private set; } = 10; // 10 IRR per 100ms compute (1 Toman)
    public long EgressGbIrr { get; private set; } = 2_000; // 2,000 IRR per GB network egress (200 Toman)

    public bool MaintenanceMode { get; private set; }
    public long MinWalletTopupIrr { get; private set; } = 100_000; // 10,000 Toman minimum top-up
    public long InitialFreeCreditIrr { get; private set; } = 5_000_000; // 500,000 Toman welcome credit
    public DateTimeOffset LastUpdatedAtUtc { get; private set; } = DateTimeOffset.UtcNow;
    public string LastUpdatedBy { get; private set; } = "system_superadmin";

    public PricingCatalogSnapshot GetSnapshot()
    {
        lock (_lock)
        {
            return new PricingCatalogSnapshot(
                DbQueryPer1kIrr: DbQueryPer1kIrr,
                StorageGbMonthIrr: StorageGbMonthIrr,
                SmsPerMessageIrr: SmsPerMessageIrr,
                ComputePer100msIrr: ComputePer100msIrr,
                EgressGbIrr: EgressGbIrr,
                MaintenanceMode: MaintenanceMode,
                MinWalletTopupIrr: MinWalletTopupIrr,
                InitialFreeCreditIrr: InitialFreeCreditIrr,
                LastUpdatedAtUtc: LastUpdatedAtUtc,
                LastUpdatedBy: LastUpdatedBy
            );
        }
    }

    public void UpdatePricing(UpdatePricingRequest request, string adminUser = "superadmin")
    {
        lock (_lock)
        {
            if (request.DbQueryPer1kIrr.HasValue) DbQueryPer1kIrr = Math.Max(0, request.DbQueryPer1kIrr.Value);
            if (request.StorageGbMonthIrr.HasValue) StorageGbMonthIrr = Math.Max(0, request.StorageGbMonthIrr.Value);
            if (request.SmsPerMessageIrr.HasValue) SmsPerMessageIrr = Math.Max(0, request.SmsPerMessageIrr.Value);
            if (request.ComputePer100msIrr.HasValue) ComputePer100msIrr = Math.Max(0, request.ComputePer100msIrr.Value);
            if (request.EgressGbIrr.HasValue) EgressGbIrr = Math.Max(0, request.EgressGbIrr.Value);
            if (request.MaintenanceMode.HasValue) MaintenanceMode = request.MaintenanceMode.Value;
            if (request.MinWalletTopupIrr.HasValue) MinWalletTopupIrr = Math.Max(0, request.MinWalletTopupIrr.Value);
            if (request.InitialFreeCreditIrr.HasValue) InitialFreeCreditIrr = Math.Max(0, request.InitialFreeCreditIrr.Value);

            LastUpdatedAtUtc = DateTimeOffset.UtcNow;
            LastUpdatedBy = adminUser;
        }
    }
}

public sealed record PricingCatalogSnapshot(
    long DbQueryPer1kIrr,
    long StorageGbMonthIrr,
    long SmsPerMessageIrr,
    long ComputePer100msIrr,
    long EgressGbIrr,
    bool MaintenanceMode,
    long MinWalletTopupIrr,
    long InitialFreeCreditIrr,
    DateTimeOffset LastUpdatedAtUtc,
    string LastUpdatedBy
);

public sealed record UpdatePricingRequest(
    long? DbQueryPer1kIrr = null,
    long? StorageGbMonthIrr = null,
    long? SmsPerMessageIrr = null,
    long? ComputePer100msIrr = null,
    long? EgressGbIrr = null,
    bool? MaintenanceMode = null,
    long? MinWalletTopupIrr = null,
    long? InitialFreeCreditIrr = null
);
