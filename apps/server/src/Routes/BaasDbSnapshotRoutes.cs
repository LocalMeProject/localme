namespace LocalMe.Server.Routes;

using System;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.MultiTenancy;

public static class BaasDbSnapshotRoutes
{
    public static void MapBaasDbSnapshotRoutes(this WebApplication app)
    {
        app.MapPost("/_baas/v1/{projectId}/db/snapshots", (string projectId, JsonObject? body, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نیست." }, statusCode: 403);

            var type = body?["type"]?.ToString() ?? "دستی فوری";
            var snapshot = pm.CreateDatabaseSnapshot(projectId, type);
            return Results.Ok(new
            {
                success = true,
                snapshot = new
                {
                    id = snapshot.Id,
                    type = snapshot.Type,
                    sizeBytes = snapshot.SizeBytes,
                    status = snapshot.Status,
                    createdAtUtc = snapshot.CreatedAtUtc
                }
            });
        });

        app.MapGet("/_baas/v1/{projectId}/db/snapshots", (string projectId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نیست." }, statusCode: 403);

            var snapshots = pm.GetDatabaseSnapshots(projectId);
            return Results.Json(snapshots.Select(s => new
            {
                id = s.Id,
                type = s.Type,
                sizeBytes = s.SizeBytes,
                status = s.Status,
                createdAtUtc = s.CreatedAtUtc
            }));
        });

        app.MapGet("/_baas/v1/{projectId}/db/snapshots/{snapshotId}/download", (string projectId, string snapshotId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نیست." }, statusCode: 403);

            var snapshot = pm.GetDatabaseSnapshot(projectId, snapshotId);
            if (snapshot == null) return Results.NotFound(new { error = "اسنپ‌شات یافت نشد." });

            var bytes = System.Text.Encoding.UTF8.GetBytes(snapshot.DataJson);
            return Results.File(bytes, "application/json", $"{snapshotId}.json");
        });
    }
}
