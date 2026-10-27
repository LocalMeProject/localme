namespace LocalMe.DataPlane.Finance;

using System;
using System.Collections.Generic;
using System.Linq;

public sealed record PaymentReportQuery(
    string? ProjectId = null,
    string? Gateway = null,
    string? Status = null, // "ALL", "VERIFIED", "PENDING", "FAILED"
    string? SearchTerm = null,
    DateTimeOffset? FromDateUtc = null,
    DateTimeOffset? ToDateUtc = null,
    long? MinAmountIrr = null,
    long? MaxAmountIrr = null,
    string? SortBy = "date", // "date", "amount", "status", "gateway"
    string? SortDir = "desc", // "asc", "desc"
    string? GroupBy = null, // "gateway", "status"
    int Page = 1,
    int PageSize = 20
);

public sealed record PaymentSummaryOverview(
    int TotalCount,
    int VerifiedCount,
    int PendingCount,
    long TotalVolumeIrr,
    long TotalVolumeToman,
    long VerifiedVolumeIrr,
    long VerifiedVolumeToman,
    double SuccessRatePercent,
    long AverageTicketToman,
    IReadOnlyDictionary<string, int> CountByGateway,
    IReadOnlyDictionary<string, long> VolumeByGatewayToman,
    IReadOnlyDictionary<string, int> CountByStatus
);

public sealed record PaymentReportResult(
    IReadOnlyList<StoredPayment> Items,
    int TotalItems,
    int Page,
    int PageSize,
    int TotalPages,
    PaymentSummaryOverview Summary
);

public static class PaymentReportEngine
{
    public static PaymentReportResult ExecuteReport(IEnumerable<StoredPayment> source, PaymentReportQuery query)
    {
        var items = source.AsQueryable();

        // 1. Scoped Project Filter
        if (!string.IsNullOrWhiteSpace(query.ProjectId))
        {
            items = items.Where(p => string.Equals(p.ProjectId, query.ProjectId, StringComparison.OrdinalIgnoreCase) || p.ProjectId == null);
        }

        // 2. Gateway Filter
        if (!string.IsNullOrWhiteSpace(query.Gateway) && !query.Gateway.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            items = items.Where(p => string.Equals(p.Gateway, query.Gateway, StringComparison.OrdinalIgnoreCase));
        }

        // 3. Status Filter
        if (!string.IsNullOrWhiteSpace(query.Status) && !query.Status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            if (query.Status.Equals("VERIFIED", StringComparison.OrdinalIgnoreCase) || query.Status.Equals("SUCCESS", StringComparison.OrdinalIgnoreCase))
            {
                items = items.Where(p => p.IsVerified);
            }
            else if (query.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
            {
                items = items.Where(p => !p.IsVerified);
            }
        }

        // 4. Search Filter (Authority, ReferenceId, CustomerPhone, Description)
        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var term = query.SearchTerm.Trim();
            items = items.Where(p =>
                p.AuthorityToken.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                (p.ReferenceId != null && p.ReferenceId.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                p.CustomerPhone.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                p.Description.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        // 5. Date Range Filter
        if (query.FromDateUtc.HasValue)
        {
            items = items.Where(p => p.CreatedAtUtc >= query.FromDateUtc.Value);
        }
        if (query.ToDateUtc.HasValue)
        {
            items = items.Where(p => p.CreatedAtUtc <= query.ToDateUtc.Value);
        }

        // 6. Amount Range Filter
        if (query.MinAmountIrr.HasValue)
        {
            items = items.Where(p => p.Amount.AmountIrr >= query.MinAmountIrr.Value);
        }
        if (query.MaxAmountIrr.HasValue)
        {
            items = items.Where(p => p.Amount.AmountIrr <= query.MaxAmountIrr.Value);
        }

        var filteredList = items.ToList();

        // Compute Overview Summary
        var totalCount = filteredList.Count;
        var verifiedCount = filteredList.Count(p => p.IsVerified);
        var pendingCount = totalCount - verifiedCount;
        var totalVolumeIrr = filteredList.Sum(p => p.Amount.AmountIrr);
        var totalVolumeToman = totalVolumeIrr / 10;
        var verifiedVolumeIrr = filteredList.Where(p => p.IsVerified).Sum(p => p.Amount.AmountIrr);
        var verifiedVolumeToman = verifiedVolumeIrr / 10;
        var successRate = totalCount > 0 ? Math.Round((double)verifiedCount / totalCount * 100.0, 1) : 0.0;
        var avgTicketToman = totalCount > 0 ? totalVolumeToman / totalCount : 0;

        var countByGateway = filteredList
            .GroupBy(p => p.Gateway.ToUpperInvariant())
            .ToDictionary(g => g.Key, g => g.Count());

        var volumeByGatewayToman = filteredList
            .GroupBy(p => p.Gateway.ToUpperInvariant())
            .ToDictionary(g => g.Key, g => g.Sum(p => p.Amount.AmountIrr) / 10);

        var countByStatus = new Dictionary<string, int>
        {
            ["VERIFIED"] = verifiedCount,
            ["PENDING"] = pendingCount
        };

        var summary = new PaymentSummaryOverview(
            TotalCount: totalCount,
            VerifiedCount: verifiedCount,
            PendingCount: pendingCount,
            TotalVolumeIrr: totalVolumeIrr,
            TotalVolumeToman: totalVolumeToman,
            VerifiedVolumeIrr: verifiedVolumeIrr,
            VerifiedVolumeToman: verifiedVolumeToman,
            SuccessRatePercent: successRate,
            AverageTicketToman: avgTicketToman,
            CountByGateway: countByGateway,
            VolumeByGatewayToman: volumeByGatewayToman,
            CountByStatus: countByStatus
        );

        // 7. Sort
        var isAsc = string.Equals(query.SortDir, "asc", StringComparison.OrdinalIgnoreCase);
        var sorted = (query.SortBy?.ToLowerInvariant()) switch
        {
            "amount" => isAsc ? filteredList.OrderBy(p => p.Amount.AmountIrr) : filteredList.OrderByDescending(p => p.Amount.AmountIrr),
            "status" => isAsc ? filteredList.OrderBy(p => p.IsVerified) : filteredList.OrderByDescending(p => p.IsVerified),
            "gateway" => isAsc ? filteredList.OrderBy(p => p.Gateway) : filteredList.OrderByDescending(p => p.Gateway),
            _ => isAsc ? filteredList.OrderBy(p => p.CreatedAtUtc) : filteredList.OrderByDescending(p => p.CreatedAtUtc)
        };

        // 8. Pagination
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 200);
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        if (totalPages == 0) totalPages = 1;

        var pagedItems = sorted.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new PaymentReportResult(
            Items: pagedItems,
            TotalItems: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages,
            Summary: summary
        );
    }
}
