namespace LocalMe.DataPlane.Admin;

using LocalMe.Core.Finance;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.MultiTenancy;

public sealed record SuperadminSystemStats(
    int TotalProjects,
    int ActiveProjects,
    long TotalQueriesProcessed,
    long TotalSmsDispatched,
    long TotalPlatformRevenueIrr,
    string FormattedRevenueToman,
    PricingCatalogSnapshot Pricing,
    DateTimeOffset SystemUptimeUtc,
    string SovereignEgressNat
);

/// <summary>
/// Superadmin administrative control plane for platform-wide governance.
/// Enforces dynamic runtime reconfiguration of pricing catalogs, maintenance status,
/// and global tenancy oversight without server restarts.
/// </summary>
public sealed class SuperadminService
{
    private readonly PricingCatalog _pricing;
    private readonly ProjectManagerService _projectManager;
    private readonly UsageMeteringService _metering;
    private readonly DateTimeOffset _bootTimeUtc = DateTimeOffset.UtcNow;

    public SuperadminService(
        PricingCatalog pricing,
        ProjectManagerService projectManager,
        UsageMeteringService metering)
    {
        _pricing = pricing;
        _projectManager = projectManager;
        _metering = metering;
    }

    public SuperadminSystemStats GetSystemStats()
    {
        var projects = _projectManager.GetAllProjects();
        int active = projects.Count(p => p.Status.Equals("Active", StringComparison.OrdinalIgnoreCase));

        long totalQueries = 0;
        long totalSms = 0;
        long totalRevenue = 0;

        foreach (var p in projects)
        {
            var summary = _metering.GetProjectSummary(p.Id);
            totalQueries += summary.TotalDbQueries;
            totalSms += summary.TotalSmsSent;
            totalRevenue += summary.TotalCostIrr;
        }

        var rial = new RialAmount(totalRevenue);
        return new SuperadminSystemStats(
            TotalProjects: projects.Count,
            ActiveProjects: active,
            TotalQueriesProcessed: totalQueries,
            TotalSmsDispatched: totalSms,
            TotalPlatformRevenueIrr: totalRevenue,
            FormattedRevenueToman: rial.ToTomanString(),
            Pricing: _pricing.GetSnapshot(),
            SystemUptimeUtc: _bootTimeUtc,
            SovereignEgressNat: "2.180.12.94 (Static Domestic NAT Active)"
        );
    }

    public PricingCatalogSnapshot UpdatePricing(UpdatePricingRequest request, string adminUser = "superadmin")
    {
        _pricing.UpdatePricing(request, adminUser);
        return _pricing.GetSnapshot();
    }
}
