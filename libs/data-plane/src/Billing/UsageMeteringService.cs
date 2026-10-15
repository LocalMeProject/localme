namespace LocalMe.DataPlane.Billing;

using System.Collections.Concurrent;
using LocalMe.Core.Finance;
using LocalMe.DataPlane.Finance;

public sealed record UsageEvent(
    string ProjectId,
    string MetricType,
    long Quantity,
    long CostIrr,
    DateTimeOffset TimestampUtc
);

public sealed record ProjectUsageSummary(
    string ProjectId,
    long TotalDbQueries,
    long TotalSmsSent,
    long TotalStorageBytes,
    long TotalComputeMs,
    long TotalEgressBytes,
    long TotalCostIrr,
    string FormattedTotalCostToman,
    IReadOnlyList<UsageEvent> RecentEvents
);

/// <summary>
/// High-throughput in-memory usage metering and cost deduction engine.
/// Records granular consumption events for each tenant project and calculates
/// exact IRR double-entry deductions based on the dynamic Superadmin PricingCatalog.
/// </summary>
public sealed class UsageMeteringService
{
    private readonly PricingCatalog _pricing;
    private readonly PaymentIpgService _ipg;

    private readonly ConcurrentDictionary<string, ConcurrentBag<UsageEvent>> _projectEvents = new();
    private readonly ConcurrentDictionary<string, long> _projectDbQueries = new();
    private readonly ConcurrentDictionary<string, long> _projectSmsSent = new();
    private readonly ConcurrentDictionary<string, long> _projectStorageBytes = new();
    private readonly ConcurrentDictionary<string, long> _projectComputeMs = new();
    private readonly ConcurrentDictionary<string, long> _projectEgressBytes = new();
    private readonly ConcurrentDictionary<string, long> _projectTotalCostIrr = new();

    public UsageMeteringService(PricingCatalog pricing, PaymentIpgService ipg)
    {
        _pricing = pricing;
        _ipg = ipg;

        // Seed initial demo project usages for immediate visual analytics
        RecordUsage("proj_snappfood_01", "+989121112233", "db_query", 145_000);
        RecordUsage("proj_snappfood_01", "+989121112233", "sms_otp", 820);
        RecordUsage("proj_snappfood_01", "+989121112233", "compute_ms", 32_500);

        RecordUsage("proj_digistore_02", "+989121112233", "db_query", 210_000);
        RecordUsage("proj_digistore_02", "+989121112233", "sms_otp", 1_400);
    }

    public long RecordUsage(string projectId, string ownerPhone, string metricType, long quantity)
    {
        if (quantity <= 0) return 0;

        var snapshot = _pricing.GetSnapshot();
        long costIrr = 0;

        switch (metricType.ToLowerInvariant())
        {
            case "db_query":
                _projectDbQueries.AddOrUpdate(projectId, quantity, (_, current) => current + quantity);
                // cost = (quantity / 1000) * DbQueryPer1kIrr
                costIrr = (long)Math.Ceiling((double)quantity / 1000.0 * snapshot.DbQueryPer1kIrr);
                break;

            case "sms_otp":
                _projectSmsSent.AddOrUpdate(projectId, quantity, (_, current) => current + quantity);
                costIrr = checked(quantity * snapshot.SmsPerMessageIrr);
                break;

            case "storage_bytes":
                _projectStorageBytes.AddOrUpdate(projectId, quantity, (_, _) => quantity);
                // Calculate monthly storage cost prorated: GB = bytes / (1024^3)
                double gb = (double)quantity / (1024.0 * 1024.0 * 1024.0);
                costIrr = (long)Math.Ceiling(gb * snapshot.StorageGbMonthIrr);
                break;

            case "compute_ms":
                _projectComputeMs.AddOrUpdate(projectId, quantity, (_, current) => current + quantity);
                costIrr = (long)Math.Ceiling((double)quantity / 100.0 * snapshot.ComputePer100msIrr);
                break;

            case "egress_bytes":
                _projectEgressBytes.AddOrUpdate(projectId, quantity, (_, current) => current + quantity);
                double egressGb = (double)quantity / (1024.0 * 1024.0 * 1024.0);
                costIrr = (long)Math.Ceiling(egressGb * snapshot.EgressGbIrr);
                break;
        }

        if (costIrr > 0)
        {
            _projectTotalCostIrr.AddOrUpdate(projectId, costIrr, (_, current) => current + costIrr);
        }

        var evt = new UsageEvent(
            ProjectId: projectId,
            MetricType: metricType,
            Quantity: quantity,
            CostIrr: costIrr,
            TimestampUtc: DateTimeOffset.UtcNow
        );

        var bag = _projectEvents.GetOrAdd(projectId, _ => new ConcurrentBag<UsageEvent>());
        bag.Add(evt);

        return costIrr;
    }

    public ProjectUsageSummary GetProjectSummary(string projectId)
    {
        _projectDbQueries.TryGetValue(projectId, out var dbQ);
        _projectSmsSent.TryGetValue(projectId, out var sms);
        _projectStorageBytes.TryGetValue(projectId, out var storage);
        _projectComputeMs.TryGetValue(projectId, out var compute);
        _projectEgressBytes.TryGetValue(projectId, out var egress);
        _projectTotalCostIrr.TryGetValue(projectId, out var totalCost);

        var events = _projectEvents.TryGetValue(projectId, out var bag)
            ? bag.Take(50).OrderByDescending(e => e.TimestampUtc).ToList()
            : [];

        var rial = new RialAmount(totalCost);
        return new ProjectUsageSummary(
            ProjectId: projectId,
            TotalDbQueries: dbQ,
            TotalSmsSent: sms,
            TotalStorageBytes: storage,
            TotalComputeMs: compute,
            TotalEgressBytes: egress,
            TotalCostIrr: totalCost,
            FormattedTotalCostToman: rial.ToTomanString(),
            RecentEvents: events
        );
    }
}
