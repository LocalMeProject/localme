namespace LocalMe.DataPlane.Admin;

using LocalMe.Core.Finance;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.MultiTenancy;

public sealed record TicketReply(
    string Id,
    string SenderName,
    string SenderRole, // "Admin", "Operator", "User"
    string Message,
    DateTimeOffset CreatedAtUtc
);

public sealed record SupportTicket(
    string Id,
    string CustomerPhone,
    string Subject,
    string Message,
    string Status, // "Open", "Investigating", "Resolved", "Closed"
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<TicketReply> Replies
);

public sealed record SuperadminSystemStats(
    int TotalUsers,
    int TotalProjects,
    int ActiveProjects,
    long TotalQueriesProcessed,
    long TotalSmsDispatched,
    long TotalPlatformRevenueIrr,
    string FormattedRevenueToman,
    PricingCatalogSnapshot Pricing,
    DateTimeOffset SystemUptimeUtc,
    string SovereignEgressNat,
    IReadOnlyList<SupportTicket> RecentTickets
);

/// <summary>
/// Superadmin & Operator administrative control plane.
/// SuperAdmins have full god-like access to pricing, users, and system variables.
/// Operators have sub-admin access to support tickets, user lists, and platform reports.
/// </summary>
public sealed class SuperadminService
{
    private readonly PricingCatalog _pricing;
    private readonly ProjectManagerService _projectManager;
    private readonly UsageMeteringService _metering;
    private readonly PlatformConfigurationService? _configService;
    private readonly DateTimeOffset _bootTimeUtc = DateTimeOffset.UtcNow;
    private readonly List<SupportTicket> _tickets = [];

    public SuperadminService(
        PricingCatalog pricing,
        ProjectManagerService projectManager,
        UsageMeteringService metering,
        PlatformConfigurationService? configService = null)
    {
        _pricing = pricing;
        _projectManager = projectManager;
        _metering = metering;
        _configService = configService;
    }

    public SuperadminSystemStats GetSystemStats()
    {
        var users = _projectManager.GetAllUsers();
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
        var egressNat = _configService?.GetConfig().SovereignEgressNat ?? "2.180.12.94 (Static Domestic NAT Active)";
        return new SuperadminSystemStats(
            TotalUsers: users.Count,
            TotalProjects: projects.Count,
            ActiveProjects: active,
            TotalQueriesProcessed: totalQueries,
            TotalSmsDispatched: totalSms,
            TotalPlatformRevenueIrr: totalRevenue,
            FormattedRevenueToman: rial.ToTomanString(),
            Pricing: _pricing.GetSnapshot(),
            SystemUptimeUtc: _bootTimeUtc,
            SovereignEgressNat: egressNat,
            RecentTickets: _tickets.AsReadOnly()
        );
    }

    public IReadOnlyList<SupportTicket> GetAllTickets()
    {
        lock (_tickets)
        {
            return _tickets.AsReadOnly();
        }
    }

    public SupportTicket? GetTicket(string ticketId)
    {
        lock (_tickets)
        {
            return _tickets.Find(t => t.Id == ticketId);
        }
    }

    public SupportTicket CreateTicket(string customerPhone, string subject, string message, string? id = null)
    {
        lock (_tickets)
        {
            var ticket = new SupportTicket(
                Id: string.IsNullOrWhiteSpace(id) ? $"tkt_{Guid.NewGuid():N}"[..8] : id.Trim(),
                CustomerPhone: customerPhone,
                Subject: subject,
                Message: message,
                Status: "Open",
                CreatedAtUtc: DateTimeOffset.UtcNow,
                Replies: [new TicketReply($"rep_{Guid.NewGuid():N}"[..8], customerPhone, "User", message, DateTimeOffset.UtcNow)]
            );
            _tickets.Add(ticket);
            return ticket;
        }
    }

    public bool AddTicketReply(string ticketId, string senderName, string senderRole, string message, string? newStatus = null)
    {
        lock (_tickets)
        {
            var idx = _tickets.FindIndex(t => t.Id == ticketId);
            if (idx < 0) return false;

            var ticket = _tickets[idx];
            var replies = new List<TicketReply>(ticket.Replies)
            {
                new(
                    Id: $"rep_{Guid.NewGuid():N}"[..10],
                    SenderName: senderName,
                    SenderRole: senderRole,
                    Message: message.Trim(),
                    CreatedAtUtc: DateTimeOffset.UtcNow
                )
            };

            var status = string.IsNullOrWhiteSpace(newStatus) ? ticket.Status : newStatus.Trim();
            _tickets[idx] = ticket with { Replies = replies.AsReadOnly(), Status = status };
            return true;
        }
    }

    public PricingCatalogSnapshot UpdatePricing(UpdatePricingRequest request, string adminUser = "superadmin")
    {
        _pricing.UpdatePricing(request, adminUser);
        return _pricing.GetSnapshot();
    }

    public PlatformConfig GetPlatformConfig() => _configService?.GetConfig() ?? new PlatformConfig();

    public PlatformConfig UpdatePlatformConfig(PlatformConfig newConfig, string adminUser = "superadmin")
    {
        return _configService?.UpdateConfig(newConfig, adminUser) ?? newConfig;
    }

    public bool UpdateTicketStatus(string ticketId, string status)
    {
        lock (_tickets)
        {
            var idx = _tickets.FindIndex(t => t.Id == ticketId);
            if (idx >= 0)
            {
                _tickets[idx] = _tickets[idx] with { Status = status };
                return true;
            }
            return false;
        }
    }
}
