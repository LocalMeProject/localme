namespace LocalMe.Server.Routes;

using System;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.MultiTenancy;

public static class BaasHostingWebhookRoutes
{
    public static void MapBaasHostingWebhookRoutes(this WebApplication app)
    {
        // GitHub / GitLab Git Push Webhook Auto-Deployment Endpoint
        app.MapPost("/_baas/v1/{projectId}/hosting/deploy/webhook", async (string projectId, HttpRequest req, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "پروژه یافت نشد." });
            if (!pm.IsServiceEnabled(projectId, "hosting"))
                return Results.Json(new { error = "سرویس میزبانی وب برای این پروژه فعال نیست." }, statusCode: 403);

            JsonObject? body = null;
            try
            {
                body = await req.ReadFromJsonAsync<JsonObject>();
            }
            catch
            {
                // Ignore parsing errors for empty or ping requests
            }

            // Extract branch name from GitHub / GitLab payload
            var refStr = body?["ref"]?.ToString() ?? "refs/heads/main";
            var branch = refStr.StartsWith("refs/heads/", StringComparison.Ordinal) ? refStr[11..] : refStr;

            // Extract commit SHA
            var headCommit = body?["head_commit"]?.AsObject();
            var commitSha = headCommit?["id"]?.ToString()
                ?? body?["after"]?.ToString()
                ?? body?["checkout_sha"]?.ToString()
                ?? Guid.NewGuid().ToString("N")[..8];

            var commitMsg = headCommit?["message"]?.ToString() ?? "استقرار خودکار از طریق وبهوک گیت";

            // Create deployment record
            var deployment = pm.CreateDeployment(
                projectId: projectId,
                branch: branch,
                commitSha: commitSha[..Math.Min(commitSha.Length, 8)]
            );

            pm.AddProjectLog(
                projectId,
                "hosting",
                "INFO",
                $"استقرار خودکار نسخه وب از شاخه {branch} (کامیت: {commitSha[..Math.Min(commitSha.Length, 7)]}): {commitMsg}",
                statusCode: 200
            );

            return Results.Ok(new
            {
                success = true,
                message = $"استقرار خودکار با موفقیت انجام شد و نسخه جدید فعال گردید.",
                deployment = new
                {
                    id = deployment.Id,
                    branch = deployment.Branch,
                    commitSha = deployment.CommitSha,
                    status = deployment.Status,
                    domain = deployment.Domain,
                    previewUrl = deployment.PreviewUrl,
                    deployedAtUtc = deployment.DeployedAtUtc
                }
            });
        });
    }
}
