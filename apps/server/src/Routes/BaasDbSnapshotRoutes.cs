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
        app.MapPost("/_baas/v1/{projectId}/db/snapshots", async (string projectId, JsonObject? body, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نیست." }, statusCode: 403);

            var type = body?["type"]?.ToString() ?? "دستی فوری";
            var snapshot = await pm.CreateDatabaseSnapshotAsync(projectId, type);
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

        app.MapPost("/_baas/v1/{projectId}/db/snapshots/{snapshotId}/restore", async (string projectId, string snapshotId, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نیست." }, statusCode: 403);

            var ok = await pm.RestoreDatabaseSnapshotAsync(projectId, snapshotId);
            if (!ok) return Results.BadRequest(new { error = "بازیابی اسنپ‌شات با خطا مواجه شد یا اسنپ‌شات معتبر نیست." });

            return Results.Ok(new { success = true, message = $"اسنپ‌شات {snapshotId} با موفقیت بازیابی شد." });
        });

        app.MapDelete("/_baas/v1/{projectId}/db/snapshots/{snapshotId}", (string projectId, string snapshotId, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نیست." }, statusCode: 403);

            var deleted = pm.DeleteDatabaseSnapshot(projectId, snapshotId);
            return deleted
                ? Results.Ok(new { success = true, snapshotId })
                : Results.NotFound(new { error = "اسنپ‌شات یافت نشد یا حذف ناموفق بود." });
        });

        // 6. Universal Project Portability (.localmepack Archive Export, Import & Restore)
        app.MapPost("/_baas/v1/{projectId}/archive/export", async (string projectId, HttpContext ctx, ProjectArchiveService archiveService) =>
        {
            var compress = !ctx.Request.Query.ContainsKey("format") || ctx.Request.Query["format"].ToString().Equals("gzip", StringComparison.OrdinalIgnoreCase);
            try
            {
                var bytes = await archiveService.ExportProjectArchiveAsync(projectId, compress);
                var filename = $"{projectId}_{DateTimeOffset.UtcNow:yyyyMMddHHmmss}." + (compress ? "localmepack" : "json");
                var contentType = compress ? "application/gzip" : "application/json";
                return Results.File(bytes, contentType, filename);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        app.MapPost("/_baas/v1/projects/import", async (HttpRequest request, ProjectArchiveService archiveService) =>
        {
            try
            {
                Stream stream;
                if (request.HasFormContentType && request.Form.Files.Count > 0)
                {
                    stream = request.Form.Files[0].OpenReadStream();
                }
                else
                {
                    stream = request.Body;
                }

                var archive = await ProjectArchiveService.ReadArchiveStreamAsync(stream);
                var modeStr = request.Query["mode"].ToString();
                var mode = modeStr.Equals("merge", StringComparison.OrdinalIgnoreCase) ? ArchiveRestoreMode.RestoreMerge : ArchiveRestoreMode.CloneAsNew;
                var conflictStr = request.Query["conflict"].ToString();
                var conflict = conflictStr.Equals("overwrite", StringComparison.OrdinalIgnoreCase) ? MergeConflictPolicy.Overwrite : MergeConflictPolicy.Skip;

                var options = new ArchiveImportOptions(
                    Mode: mode,
                    ConflictPolicy: conflict,
                    NewProjectName: request.Query["name"].ToString() is { Length: > 0 } n ? n : null,
                    NewProjectSlug: request.Query["slug"].ToString() is { Length: > 0 } s ? s : null
                );

                var imported = await archiveService.ImportArchiveAsync(archive, options);
                return Results.Ok(new
                {
                    success = true,
                    mode = options.Mode.ToString(),
                    project = new
                    {
                        imported.Id,
                        imported.Name,
                        imported.Slug,
                        imported.Region,
                        imported.Status
                    }
                });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        app.MapPost("/_baas/v1/{projectId}/archive/restore", async (string projectId, HttpRequest request, ProjectArchiveService archiveService) =>
        {
            try
            {
                Stream stream;
                if (request.HasFormContentType && request.Form.Files.Count > 0)
                {
                    stream = request.Form.Files[0].OpenReadStream();
                }
                else
                {
                    stream = request.Body;
                }

                var archive = await ProjectArchiveService.ReadArchiveStreamAsync(stream);
                var modeStr = request.Query["mode"].ToString();
                var mode = modeStr.Equals("merge", StringComparison.OrdinalIgnoreCase) ? ArchiveRestoreMode.RestoreMerge : ArchiveRestoreMode.RestoreOverwrite;
                var conflictStr = request.Query["conflict"].ToString();
                var conflict = conflictStr.Equals("overwrite", StringComparison.OrdinalIgnoreCase) ? MergeConflictPolicy.Overwrite : MergeConflictPolicy.Skip;

                var options = new ArchiveImportOptions(
                    Mode: mode,
                    ConflictPolicy: conflict,
                    TargetProjectId: projectId
                );

                var restored = await archiveService.ImportArchiveAsync(archive, options);
                return Results.Ok(new
                {
                    success = true,
                    mode = options.Mode.ToString(),
                    project = new
                    {
                        restored.Id,
                        restored.Name,
                        restored.Slug,
                        restored.Region,
                        restored.Status
                    }
                });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });
    }
}
