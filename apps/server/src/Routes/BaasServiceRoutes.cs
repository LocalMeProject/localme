namespace LocalMe.Server.Routes;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Compliance;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.Finance;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Storage;

public static class BaasServiceRoutes
{
    public static void MapBaasServiceRoutes(this WebApplication app)
    {
        // 1. Multi-Tenant Project Relational Data, Dynamic DB & SQL Routes
        app.MapBaasDatabaseRoutes();

        // 7. Multi-Tenant Project Storage Buckets & Files
        app.MapGet("/_baas/v1/{projectId}/storage/buckets", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "storage");
            if (!allowed) return err!;
            return Results.Json(pm.GetProjectBuckets(project!.Id));
        });

        app.MapGet("/_baas/v1/projects/{projectId}/buckets", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "storage");
            if (!allowed) return err!;
            return Results.Json(pm.GetProjectBuckets(project!.Id));
        });

        app.MapPost("/_baas/v1/{projectId}/storage/buckets", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "storage");
            if (!allowed) return err!;

            var name = body["name"]?.ToString() ?? "default-bucket";
            var isPublic = body["is_public"]?.GetValue<bool>() ?? false;
            var bucket = pm.CreateBucket(project!.Id, name, isPublic);
            return Results.Json(bucket);
        });

        app.MapPost("/_baas/v1/projects/{projectId}/buckets", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "storage");
            if (!allowed) return err!;

            var name = body["name"]?.ToString() ?? "default-bucket";
            var isPublic = body["is_public"]?.GetValue<bool>() ?? false;
            var bucket = pm.CreateBucket(project!.Id, name, isPublic);
            return Results.Json(bucket);
        });

        app.MapGet("/_baas/v1/{projectId}/storage/{bucket}/files", (string projectId, string bucket, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "storage");
            if (!allowed) return err!;
            return Results.Json(pm.GetBucketFiles(project!.Id, bucket));
        });

        app.MapPost("/_baas/v1/{projectId}/storage/{bucket}/upload", async (string projectId, string bucket, HttpRequest request, ProjectManagerService pm, IBlobStorageAdapter storage, UsageMeteringService metering) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(request.HttpContext, pm, projectId, serviceRequired: "storage");
            if (!allowed) return err!;

            string fileName;
            string contentType;
            long sizeBytes;

            if (request.HasFormContentType && request.Form.Files.Count > 0)
            {
                var formFile = request.Form.Files[0];
                fileName = Path.GetFileName(formFile.FileName);
                contentType = string.IsNullOrWhiteSpace(formFile.ContentType) ? "application/octet-stream" : formFile.ContentType;
                sizeBytes = formFile.Length;

                await using var stream = formFile.OpenReadStream();
                await storage.PutObjectAsync($"{project!.Id}/{bucket}", fileName, stream, contentType);
            }
            else
            {
                fileName = request.Headers["X-File-Name"].ToString() is { Length: > 0 } fn
                    ? Path.GetFileName(fn)
                    : $"file_{Guid.NewGuid():N}"[..8] + ".bin";
                contentType = string.IsNullOrWhiteSpace(request.ContentType)
                    ? "application/octet-stream"
                    : request.ContentType;

                await using var bodyStream = request.Body;
                await storage.PutObjectAsync($"{project!.Id}/{bucket}", fileName, bodyStream, contentType);
                sizeBytes = request.ContentLength ?? 1024 * 64;
            }

            metering.RecordUsage(project!.Id, project.OwnerPhone, "storage_mb", Math.Max(1, (int)(sizeBytes / (1024 * 1024))));
            var file = pm.UploadBucketFile(project.Id, bucket, fileName, contentType, sizeBytes);
            return Results.Json(file);
        });

        app.MapGet("/_baas/v1/{projectId}/storage/{bucket}/{*fileName}", async (string projectId, string bucket, string fileName, HttpContext ctx, IBlobStorageAdapter storage, ProjectManagerService pm) =>
        {
            var targetPrj = pm.GetProject(projectId) ?? pm.GetProjectBySlug(projectId);
            if (targetPrj == null) return Results.NotFound(new { error = "Project not found" });

            // Check if bucket is public
            var bucketObj = pm.GetProjectBuckets(targetPrj.Id).FirstOrDefault(b => b.Name.Equals(bucket, StringComparison.OrdinalIgnoreCase));
            if (bucketObj == null || !bucketObj.IsPublic)
            {
                var (allowed, _, _, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "storage");
                if (!allowed) return err!;
            }

            var cleanFileName = Path.GetFileName(fileName);
            var stream = await storage.GetObjectAsync($"{targetPrj.Id}/{bucket}", cleanFileName);
            if (stream == null)
            {
                stream = await storage.GetObjectAsync(bucket, cleanFileName);
            }

            if (stream == null)
            {
                return Results.NotFound(new { error = "File not found" });
            }

            var files = pm.GetBucketFiles(targetPrj.Id, bucket);
            var meta = files.FirstOrDefault(f => f.FileName.Equals(cleanFileName, StringComparison.OrdinalIgnoreCase));
            var contentType = meta?.ContentType ?? "application/octet-stream";

            return Results.File(stream, contentType, cleanFileName);
        });

        app.MapDelete("/_baas/v1/{projectId}/storage/buckets/{bucket}", (string projectId, string bucket, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "storage");
            if (!allowed) return err!;

            var deleted = pm.DeleteBucket(project!.Id, bucket);
            return deleted ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "Bucket not found" });
        });

        app.MapDelete("/_baas/v1/{projectId}/storage/{bucket}/{*fileName}", (string projectId, string bucket, string fileName, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "storage");
            if (!allowed) return err!;

            var deleted = pm.DeleteBucketFile(project!.Id, bucket, fileName);
            return deleted ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "File not found" });
        });

        // 8. Multi-Tenant Project Edge Functions
        app.MapGet("/_baas/v1/{projectId}/functions", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;
            return Results.Json(pm.GetProjectFunctions(project!.Id));
        });

        app.MapGet("/_baas/v1/projects/{projectId}/functions", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;
            return Results.Json(pm.GetProjectFunctions(project!.Id));
        });

        app.MapGet("/_baas/v1/{projectId}/functions/{funcSlug}", (string projectId, string funcSlug, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var func = pm.GetProjectFunction(project!.Id, funcSlug);
            return func != null ? Results.Json(func) : Results.NotFound(new { error = "Function not found" });
        });

        app.MapPost("/_baas/v1/{projectId}/functions", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var name = body["name"]?.ToString() ?? "New Function";
            var slug = body["slug"]?.ToString();
            var script = body["script"]?.ToString() ?? "function handler(req) { return { status: 'ok' }; } handler(context);";
            var func = pm.DeployFunction(project!.Id, name, script, slug);
            return Results.Json(func);
        });

        app.MapPost("/_baas/v1/projects/{projectId}/functions", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var name = body["name"]?.ToString() ?? "New Function";
            var slug = body["slug"]?.ToString();
            var script = body["script"]?.ToString() ?? "function handler(req) { return { status: 'ok' }; } handler(context);";
            var func = pm.DeployFunction(project!.Id, name, script, slug);
            return Results.Json(func);
        });

        app.MapPut("/_baas/v1/{projectId}/functions/{funcSlug}", (string projectId, string funcSlug, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var name = body["name"]?.ToString();
            var script = body["script"]?.ToString() ?? "";
            var updated = pm.UpdateFunction(project!.Id, funcSlug, name, script);
            return updated != null ? Results.Json(updated) : Results.NotFound(new { error = "Function not found" });
        });

        app.MapDelete("/_baas/v1/{projectId}/functions/{funcSlug}", (string projectId, string funcSlug, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var deleted = pm.DeleteFunction(project!.Id, funcSlug);
            return deleted ? Results.Ok(new { success = true }) : Results.NotFound();
        });

        // Live Function Execution Governor (Supports both /invoke and /exec)
        Func<string, string, HttpRequest, ProjectManagerService, JintScriptHost, UsageMeteringService, Task<IResult>> runEdgeFunction =
            async (projectId, funcSlug, request, pm, host, metering) =>
            {
                var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(request.HttpContext, pm, projectId, serviceRequired: "functions");
                if (!allowed) return err!;

                var func = pm.GetProjectFunctions(project!.Id).FirstOrDefault(f => f.Slug.Equals(funcSlug, StringComparison.OrdinalIgnoreCase));
                if (func == null) return Results.NotFound(new { error = $"Function '{funcSlug}' not found." });

                using var reader = new StreamReader(request.Body);
                var rawBody = await reader.ReadToEndAsync();

                string? inputJson = null;
                string script = func.Script;

                if (!string.IsNullOrWhiteSpace(rawBody))
                {
                    try
                    {
                        var parsed = JsonNode.Parse(rawBody);
                        if (parsed is JsonObject reqObj && reqObj.ContainsKey("inputJson"))
                        {
                            inputJson = reqObj["inputJson"]?.ToString();
                        }
                        else
                        {
                            inputJson = rawBody;
                        }
                    }
                    catch
                    {
                        inputJson = rawBody;
                    }
                }

                var result = host.ExecuteScript(new ScriptExecutionRequest(
                    Script: script,
                    InputJson: inputJson,
                    TimeoutSeconds: 5
                ));

                metering.RecordUsage(project.Id, project.OwnerPhone, "compute_ms", Math.Max(10, result.ExecutionTimeMs));
                return Results.Json(result);
            };

        app.MapPost("/_baas/v1/{projectId}/functions/{funcSlug}/invoke", runEdgeFunction);
        app.MapPost("/_baas/v1/{projectId}/functions/{funcSlug}/exec", runEdgeFunction);

        // 9.1 Sovereign Iranian Developer Platform Studios
        // Hosting & Deployments
        app.MapGet("/_baas/v1/{projectId}/hosting/deployments", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "hosting");
            if (!allowed) return err!;
            return Results.Json(pm.GetDeployments(project!.Id));
        });

        app.MapPost("/_baas/v1/{projectId}/hosting/deployments", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "hosting");
            if (!allowed) return err!;

            var branch = body["branch"]?.ToString() ?? "main";
            var commitSha = body["commit_sha"]?.ToString() ?? $"sha_{Guid.NewGuid():N}"[..7];
            var domain = body["domain"]?.ToString();
            var dep = pm.CreateDeployment(project!.Id, branch, commitSha, domain);
            pm.AddProjectLog(project.Id, "hosting", "INFO", $"استقرار نسخه جدید روی دامنه {dep.Domain} ثبت گردید.", dep.Id, 200, 150);
            return Results.Json(dep);
        });

        app.MapGet("/_baas/v1/{projectId}/hosting/domains", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "hosting");
            if (!allowed) return err!;
            return Results.Json(pm.GetDomains(project!.Id));
        });

        app.MapPost("/_baas/v1/{projectId}/hosting/domains", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "hosting");
            if (!allowed) return err!;

            var domain = body["domain"]?.ToString() ?? "";
            if (string.IsNullOrWhiteSpace(domain)) return Results.BadRequest(new { error = "Domain name is required" });
            var dom = pm.AddDomain(project!.Id, domain);
            return Results.Json(dom);
        });

        app.MapPost("/_baas/v1/{projectId}/hosting/domains/verify", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "hosting");
            if (!allowed) return err!;

            var domain = body["domain"]?.ToString() ?? "";
            var verified = pm.VerifyDomain(project!.Id, domain);
            return verified != null ? Results.Json(verified) : Results.NotFound(new { error = "Domain not found" });
        });

        app.MapDelete("/_baas/v1/{projectId}/hosting/domains/{domain}", (string projectId, string domain, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "hosting");
            if (!allowed) return err!;

            var deleted = pm.DeleteDomain(project!.Id, domain);
            return deleted ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "Domain not found" });
        });

        app.MapPost("/_baas/v1/{projectId}/hosting/domains/{domain}/ssl", (string projectId, string domain, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "hosting");
            if (!allowed) return err!;

            var verified = pm.VerifyDomain(project!.Id, domain);
            return verified != null
                ? Results.Ok(new { success = true, domain = verified, message = "گواهی امنیتی Let's Encrypt با موفقیت صادر و فعال گردید." })
                : Results.NotFound(new { error = "Domain not found" });
        });

        // Shetab IPG Merchant Studio
        app.MapGet("/_baas/v1/{projectId}/ipg/config", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "ipg");
            if (!allowed) return err!;
            return Results.Json(pm.GetIpgConfig(project!.Id));
        });

        app.MapPost("/_baas/v1/{projectId}/ipg/config", (string projectId, IpgMerchantConfig config, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "ipg");
            if (!allowed) return err!;

            var psp = config.DefaultPsp.ToUpperInvariant();
            var errors = new List<string>();

            switch (psp)
            {
                case "BEHPARDAKHT":
                    if (string.IsNullOrWhiteSpace(config.MellatTerminalId) || !long.TryParse(config.MellatTerminalId.Trim(), out _))
                        errors.Add("کد پایانه به‌پرداخت ملت باید عددی و معتبر باشد.");
                    if (string.IsNullOrWhiteSpace(config.MellatUserName))
                        errors.Add("نام کاربری وب‌سرویس به‌پرداخت ملت الزامی است.");
                    if (string.IsNullOrWhiteSpace(config.MellatUserPassword))
                        errors.Add("کلمه عبور وب‌سرویس به‌پرداخت ملت الزامی است.");
                    break;

                case "SEP":
                    if (string.IsNullOrWhiteSpace(config.SepTerminalId) || config.SepTerminalId.Trim().Length < 6)
                        errors.Add("کد پایانه سامان‌کیش (سپ) باید حداقل ۶ تا ۸ رقم باشد.");
                    if (string.IsNullOrWhiteSpace(config.SepMerchantId))
                        errors.Add("کد پذیرنده یا کلمه عبور درگاه سامان‌کیش الزامی است.");
                    break;

                case "ZARINPAL":
                    if (string.IsNullOrWhiteSpace(config.ZarinpalMerchantId) || config.ZarinpalMerchantId.Trim().Length != 36)
                        errors.Add("کد مرچنت زرین‌پال باید فرمت استاندارد ۳۶ کاراکتری UUID باشد (مانند: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).");
                    break;

                case "SADAD":
                    if (string.IsNullOrWhiteSpace(config.SadadMerchantId))
                        errors.Add("شماره پذیرنده سداد بانک ملی الزامی است.");
                    if (string.IsNullOrWhiteSpace(config.SadadTerminalId))
                        errors.Add("شماره ترمینال سداد بانک ملی الزامی است.");
                    if (string.IsNullOrWhiteSpace(config.SadadTerminalKey))
                        errors.Add("کلید متقارن (Terminal Key) سداد الزامی است.");
                    break;

                case "IDPAY":
                    if (string.IsNullOrWhiteSpace(config.IdpayApiKey))
                        errors.Add("کلید اختصاصی API درگاه آیدی‌پی (X-API-KEY) الزامی است.");
                    break;

                case "PAYPING":
                    if (string.IsNullOrWhiteSpace(config.PaypingToken))
                        errors.Add("توکن دسترسی درگاه پی‌پینگ (Bearer Token) الزامی است.");
                    break;
            }

            if (errors.Count > 0)
            {
                return Results.BadRequest(new { error = string.Join(" ", errors), validationErrors = errors });
            }

            var updated = pm.UpdateIpgConfig(project!.Id, config);
            return Results.Json(updated);
        });

        app.MapGet("/_baas/v1/{projectId}/ipg/transactions", (string projectId, HttpContext ctx, PaymentIpgService ipg, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "ipg");
            if (!allowed) return err!;
            var projectTxs = ipg.GetProjectPayments(project!.Id);
            return Results.Json(projectTxs);
        });

        // Iranian Compliance Hub
        app.MapGet("/_baas/v1/{projectId}/compliance", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "compliance");
            if (!allowed) return err!;
            return Results.Json(pm.GetCompliance(project!.Id));
        });

        app.MapPost("/_baas/v1/{projectId}/compliance", (string projectId, ComplianceConfig config, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "compliance");
            if (!allowed) return err!;
            var updated = pm.UpdateCompliance(project!.Id, config);
            return Results.Json(updated);
        });

        // Live Log Streaming & Telemetry
        app.MapGet("/_baas/v1/{projectId}/logs", (string projectId, HttpRequest req, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(req.HttpContext, pm, projectId);
            if (!allowed) return err!;

            var limit = int.TryParse(req.Query["limit"], out var l) ? Math.Clamp(l, 1, 200) : 50;
            var service = req.Query["service"].ToString();
            var level = req.Query["level"].ToString();
            return Results.Json(pm.GetProjectLogs(project!.Id, limit, service, level));
        });

        app.MapPost("/_baas/v1/{projectId}/logs", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId);
            if (!allowed) return err!;

            var service = body["service"]?.ToString() ?? "app";
            var level = body["level"]?.ToString() ?? "INFO";
            var msg = body["message"]?.ToString() ?? "";
            var trace = body["trace_id"]?.ToString();
            var entry = pm.AddProjectLog(project!.Id, service, level, msg, trace);
            return Results.Json(entry);
        });
    }
}
