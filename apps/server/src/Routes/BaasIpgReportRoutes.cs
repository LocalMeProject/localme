namespace LocalMe.Server.Routes;

using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.Finance;
using LocalMe.DataPlane.MultiTenancy;

public static class BaasIpgReportRoutes
{
    public static void MapBaasIpgReportRoutes(this WebApplication app)
    {
        app.MapGet("/_baas/v1/{projectId}/ipg/reports", (string projectId, HttpRequest req, PaymentIpgService ipg, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "ipg"))
                return Results.Json(new { error = "سرویس درگاه پرداخت برای این پروژه فعال نیست." }, statusCode: 403);

            var query = new PaymentReportQuery(
                ProjectId: projectId,
                Gateway: req.Query["gateway"].ToString(),
                Status: req.Query["status"].ToString(),
                SearchTerm: req.Query["query"].ToString(),
                FromDateUtc: DateTimeOffset.TryParse(req.Query["from"], out var from) ? from : null,
                ToDateUtc: DateTimeOffset.TryParse(req.Query["to"], out var to) ? to : null,
                MinAmountIrr: long.TryParse(req.Query["minAmount"], out var minA) ? minA : null,
                MaxAmountIrr: long.TryParse(req.Query["maxAmount"], out var maxA) ? maxA : null,
                SortBy: req.Query["sortBy"].ToString() is { Length: > 0 } sb ? sb : "date",
                SortDir: req.Query["sortDir"].ToString() is { Length: > 0 } sd ? sd : "desc",
                GroupBy: req.Query["groupBy"].ToString(),
                Page: int.TryParse(req.Query["page"], out var p) ? p : 1,
                PageSize: int.TryParse(req.Query["pageSize"], out var ps) ? ps : 20
            );

            var report = ipg.GetProjectPaymentReport(query);
            return Results.Json(report);
        });
    }
}
