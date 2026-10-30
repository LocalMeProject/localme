namespace LocalMe.Infrastructure.Storage;

using System.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using LocalMe.DataPlane.MultiTenancy;
using Npgsql;
using StackExchange.Redis;

public sealed partial class PostgreSqlProjectStore : IProjectStore, IAsyncDisposable
{
    private readonly string _pgConnectionString;
    private readonly string _redisConnectionString;
    private NpgsqlDataSource? _dataSource;
    public NpgsqlDataSource? DataSource => _dataSource;
    private ConnectionMultiplexer? _redis;
    private IDatabase? _redisDb;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private const string LocalFallbackPostgres = "Host=127.0.0.1;Port=5432;Database=lerd;Username=postgres;Password=lerd;SSL Mode=Prefer;Trust Server Certificate=true;";
    private const string LocalFallbackRedis = "127.0.0.1:6379,defaultDatabase=0,abortConnect=false";

    public static string NormalizePostgresConnectionString(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString)) return connectionString;
        var trimmed = connectionString.Trim();
        if (trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var uri = new Uri(trimmed);
                var userInfo = uri.UserInfo.Split(':');
                var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
                var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
                var database = uri.AbsolutePath.TrimStart('/');
                var port = uri.Port > 0 ? uri.Port : 5432;
                var sslMode = trimmed.Contains("sslmode=require", StringComparison.OrdinalIgnoreCase)
                    ? "SSL Mode=Require;Trust Server Certificate=true;"
                    : (trimmed.Contains("sslmode=disable", StringComparison.OrdinalIgnoreCase)
                        ? "SSL Mode=Disable;"
                        : "SSL Mode=Prefer;Trust Server Certificate=true;");
                return $"Host={uri.Host};Port={port};Username={username};Password={password};Database={database};{sslMode}";
            }
            catch
            {
                return connectionString;
            }
        }
        return connectionString;
    }

    public static string NormalizeRedisConnectionString(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString)) return connectionString;
        var trimmed = connectionString.Trim();
        if (trimmed.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var uri = new Uri(trimmed);
                var userInfo = uri.UserInfo.Split(':');
                var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : (userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "");
                var port = uri.Port > 0 ? uri.Port : 6379;
                var dbStr = uri.AbsolutePath.TrimStart('/');
                var dbIndex = int.TryParse(dbStr, out var d) ? d : 0;
                var ssl = trimmed.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase);
                return $"{uri.Host}:{port},password={password},defaultDatabase={dbIndex},abortConnect=false,ssl={ssl}";
            }
            catch
            {
                return connectionString;
            }
        }
        return connectionString;
    }

    public PostgreSqlProjectStore(string? pgConnectionString = null, string? redisConnectionString = null)
    {
        _pgConnectionString = NormalizePostgresConnectionString(!string.IsNullOrWhiteSpace(pgConnectionString)
            ? pgConnectionString
            : (Environment.GetEnvironmentVariable("LOCALME_POSTGRES_URL")
               ?? Environment.GetEnvironmentVariable("LOCALME_POSTGRES_CONNECTION")
               ?? Environment.GetEnvironmentVariable("DATABASE_URL")
               ?? LocalFallbackPostgres));

        _redisConnectionString = NormalizeRedisConnectionString(!string.IsNullOrWhiteSpace(redisConnectionString)
            ? redisConnectionString
            : (Environment.GetEnvironmentVariable("LOCALME_REDIS_URL")
               ?? Environment.GetEnvironmentVariable("LOCALME_REDIS_CONNECTION")
               ?? Environment.GetEnvironmentVariable("REDIS_URL")
               ?? LocalFallbackRedis));
    }

    public async Task InitializeAsync()
    {
        if (_dataSource == null)
        {
            var dataSourceBuilder = new NpgsqlDataSourceBuilder(_pgConnectionString);
            _dataSource = dataSourceBuilder.Build();
        }

        if (_redis == null)
        {
            try
            {
                var options = ConfigurationOptions.Parse(_redisConnectionString);
                options.AbortOnConnectFail = false;
                options.ConnectTimeout = 4000;
                _redis = await ConnectionMultiplexer.ConnectAsync(options);
                _redisDb = _redis.GetDatabase(options.DefaultDatabase ?? 0);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LocalMe.Redis] Warning: Redis connection failed ({ex.Message}). Continuing with PostgreSQL.");
            }
        }

        // Verify and apply migrations if needed
        await using var cmd = _dataSource.CreateCommand("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects';");
        var count = Convert.ToInt64(await cmd.ExecuteScalarAsync(), System.Globalization.CultureInfo.InvariantCulture);
        if (count == 0)
        {
            string? sql = null;
            var migrationCandidates = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "Migrations", "004_PlatformPersistence.sql"),
                Path.Combine(Directory.GetCurrentDirectory(), "libs", "infrastructure", "src", "Migrations", "004_PlatformPersistence.sql"),
                Path.Combine(AppContext.BaseDirectory, "../../../libs/infrastructure/src/Migrations/004_PlatformPersistence.sql")
            };

            foreach (var candidate in migrationCandidates)
            {
                if (File.Exists(candidate))
                {
                    sql = await File.ReadAllTextAsync(candidate);
                    break;
                }
            }

            if (!string.IsNullOrWhiteSpace(sql))
            {
                await using var migCmd = _dataSource.CreateCommand(sql);
                await migCmd.ExecuteNonQueryAsync();
            }
        }

        // Ensure finance, mobile push & IAP, and billing tables exist
        const string auxiliaryTablesSql = @"
            CREATE TABLE IF NOT EXISTS payment_transactions (
                id VARCHAR(64) PRIMARY KEY,
                authority_token VARCHAR(128) UNIQUE NOT NULL,
                gateway VARCHAR(64) NOT NULL,
                amount_irr BIGINT NOT NULL,
                customer_phone VARCHAR(32) NOT NULL,
                callback_url TEXT NOT NULL,
                description TEXT,
                idempotency_key VARCHAR(128) NOT NULL,
                is_verified BOOLEAN NOT NULL DEFAULT FALSE,
                reference_id VARCHAR(128),
                project_id VARCHAR(64),
                created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_pmt_tx_auth ON payment_transactions(authority_token);
            CREATE INDEX IF NOT EXISTS idx_pmt_tx_phone ON payment_transactions(customer_phone);

            CREATE TABLE IF NOT EXISTS customer_ledgers (
                id VARCHAR(64) PRIMARY KEY,
                customer_phone VARCHAR(32) NOT NULL,
                transaction_id VARCHAR(64) NOT NULL,
                idempotency_key VARCHAR(128) NOT NULL,
                entries_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_cust_ledgers_ph ON customer_ledgers(customer_phone, timestamp_utc DESC);

            CREATE TABLE IF NOT EXISTS customer_wallets (
                customer_phone VARCHAR(32) PRIMARY KEY,
                balance_irr BIGINT NOT NULL DEFAULT 0,
                updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS project_push_devices (
                device_id VARCHAR(128) NOT NULL,
                project_id VARCHAR(64) NOT NULL,
                push_token TEXT NOT NULL,
                platform VARCHAR(32) NOT NULL,
                provider VARCHAR(32) NOT NULL,
                user_id VARCHAR(128),
                tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                app_version VARCHAR(64),
                device_model VARCHAR(128),
                registered_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (project_id, device_id)
            );

            CREATE TABLE IF NOT EXISTS project_push_configs (
                project_id VARCHAR(64) PRIMARY KEY,
                fcm_server_key TEXT,
                apns_key_id VARCHAR(64),
                apns_team_id VARCHAR(64),
                apns_bundle_id VARCHAR(128),
                apns_auth_token TEXT,
                najva_api_token TEXT,
                pushy_api_key TEXT,
                enable_domestic_fallback BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS project_iap_configs (
                project_id VARCHAR(64) PRIMARY KEY,
                bazaar_client_id VARCHAR(128),
                bazaar_client_secret VARCHAR(256),
                bazaar_refresh_token TEXT,
                myket_api_key VARCHAR(256),
                auto_credit_wallet BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS project_iap_records (
                transaction_id VARCHAR(64) PRIMARY KEY,
                project_id VARCHAR(64) NOT NULL,
                store VARCHAR(32) NOT NULL,
                package_name VARCHAR(256) NOT NULL,
                product_id VARCHAR(128) NOT NULL,
                purchase_token TEXT NOT NULL,
                user_id VARCHAR(128),
                amount_irr BIGINT NOT NULL,
                consumption_state VARCHAR(32) NOT NULL,
                purchase_state VARCHAR(32) NOT NULL,
                verified_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (project_id, purchase_token)
            );

            CREATE TABLE IF NOT EXISTS billing_usage_records (
                id VARCHAR(64) PRIMARY KEY,
                project_id VARCHAR(64) NOT NULL,
                metric_type VARCHAR(64) NOT NULL,
                quantity BIGINT NOT NULL,
                cost_irr BIGINT NOT NULL,
                recorded_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );";
        try
        {
            await using var auxCmd = _dataSource.CreateCommand(auxiliaryTablesSql);
            await auxCmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Auxiliary table initialization notice: {ex.Message}");
        }

        // Seed or heal baseline platform users
        var adminHash = ProjectManagerService.HashPassword("admin123456");
        var operatorHash = ProjectManagerService.HashPassword("operator123456");
        var developerHash = ProjectManagerService.HashPassword("developer123456");

        const string seedSql = @"
            INSERT INTO platform_users (id, full_name, phone, email, username, password_hash, role, wallet_balance_irr, is_active, created_at_utc)
            VALUES 
            ('usr_admin_01', 'مدیر ارشد سامانه', '+989120000001', 'admin@localme.ir', 'admin', @adminHash, 'Admin', 0, true, NOW()),
            ('usr_operator_02', 'اپراتور پشتیبانی', '+989120000002', 'support@localme.ir', 'operator', @operatorHash, 'Operator', 0, true, NOW()),
            ('usr_developer_03', 'سینا والی زاده', '+989121112233', 'sina@example.com', 'sina', @developerHash, 'Developer', 0, true, NOW())
            ON CONFLICT (id) DO UPDATE SET 
                username = EXCLUDED.username,
                password_hash = CASE WHEN platform_users.password_hash NOT LIKE '%:%' THEN EXCLUDED.password_hash ELSE platform_users.password_hash END,
                is_active = true;";
        await using var seedCmd = _dataSource.CreateCommand(seedSql);
        seedCmd.Parameters.AddWithValue("adminHash", adminHash);
        seedCmd.Parameters.AddWithValue("operatorHash", operatorHash);
        seedCmd.Parameters.AddWithValue("developerHash", developerHash);
        await seedCmd.ExecuteNonQueryAsync();
    }

    // 1. Platform Users
    public async Task<List<PlatformUser>> LoadUsersAsync()
    {
        await EnsureInitializedAsync();
        var list = new List<PlatformUser>();
        const string sql = "SELECT id, full_name, phone, email, username, password_hash, role, wallet_balance_irr, is_active, created_at_utc FROM platform_users ORDER BY created_at_utc DESC;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            Enum.TryParse<UserRole>(reader.GetString(6), true, out var role);
            list.Add(new PlatformUser(
                Id: reader.GetString(0),
                FullName: reader.GetString(1),
                Phone: reader.GetString(2),
                Email: reader.GetString(3),
                Username: reader.IsDBNull(4) ? null : reader.GetString(4),
                PasswordHash: reader.IsDBNull(5) ? null : reader.GetString(5),
                Role: role,
                WalletBalanceIrr: reader.GetInt64(7),
                IsActive: reader.GetBoolean(8),
                CreatedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(9), DateTimeKind.Utc)
            ));
        }
        return list;
    }

    public async Task UpsertUserAsync(PlatformUser user)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO platform_users (id, full_name, phone, email, username, password_hash, role, wallet_balance_irr, is_active, created_at_utc)
            VALUES (@id, @fn, @ph, @em, @un, @pwd, @role, @bal, @act, @ca)
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                username = EXCLUDED.username,
                password_hash = COALESCE(EXCLUDED.password_hash, platform_users.password_hash),
                role = EXCLUDED.role,
                wallet_balance_irr = EXCLUDED.wallet_balance_irr,
                is_active = EXCLUDED.is_active;";

        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", user.Id);
        cmd.Parameters.AddWithValue("fn", user.FullName);
        cmd.Parameters.AddWithValue("ph", user.Phone);
        cmd.Parameters.AddWithValue("em", user.Email);
        cmd.Parameters.AddWithValue("un", (object?)user.Username ?? DBNull.Value);
        cmd.Parameters.AddWithValue("pwd", (object?)user.PasswordHash ?? DBNull.Value);
        cmd.Parameters.AddWithValue("role", user.Role.ToString());
        cmd.Parameters.AddWithValue("bal", user.WalletBalanceIrr);
        cmd.Parameters.AddWithValue("act", user.IsActive);
        cmd.Parameters.AddWithValue("ca", user.CreatedAtUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    // 2. Projects
    public async Task<List<BaasProject>> LoadProjectsAsync()
    {
        await EnsureInitializedAsync();
        var list = new List<BaasProject>();
        const string sql = "SELECT id, name, slug, description, owner_id, owner_phone, region, status, password_hash, has_password, services_json, created_at_utc, updated_at_utc FROM projects ORDER BY created_at_utc DESC;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var servicesJson = reader.IsDBNull(10) ? "{}" : reader.GetString(10);
            Dictionary<string, ServiceConfig> services;
            try
            {
                services = JsonSerializer.Deserialize<Dictionary<string, ServiceConfig>>(
                    servicesJson,
                    JsonOptions) ?? [];
            }
            catch
            {
                services = [];
            }

            list.Add(new BaasProject(
                Id: reader.GetString(0),
                Name: reader.GetString(1),
                Slug: reader.GetString(2),
                Description: reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                OwnerId: reader.GetString(4),
                OwnerPhone: reader.GetString(5),
                Region: reader.GetString(6),
                Status: reader.GetString(7),
                PasswordHash: reader.IsDBNull(8) ? null : reader.GetString(8),
                HasPassword: !reader.IsDBNull(9) && reader.GetBoolean(9),
                Services: services,
                CreatedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(11), DateTimeKind.Utc),
                UpdatedAtUtc: reader.IsDBNull(12) ? null : DateTime.SpecifyKind(reader.GetDateTime(12), DateTimeKind.Utc)
            ));
        }
        return list;
    }

    public async Task UpsertProjectAsync(BaasProject project)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO projects (id, name, slug, description, owner_id, owner_phone, region, status, password_hash, has_password, services_json, created_at_utc, updated_at_utc)
            VALUES (@id, @name, @slug, @desc, @oid, @oph, @reg, @st, @pwd, @hp, @srv::jsonb, @ca, @ua)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                slug = EXCLUDED.slug,
                description = EXCLUDED.description,
                status = EXCLUDED.status,
                password_hash = EXCLUDED.password_hash,
                has_password = EXCLUDED.has_password,
                services_json = EXCLUDED.services_json,
                updated_at_utc = EXCLUDED.updated_at_utc;";

        var servicesJson = JsonSerializer.Serialize(project.Services);
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", project.Id);
        cmd.Parameters.AddWithValue("name", project.Name);
        cmd.Parameters.AddWithValue("slug", project.Slug);
        cmd.Parameters.AddWithValue("desc", (object?)project.Description ?? string.Empty);
        cmd.Parameters.AddWithValue("oid", project.OwnerId);
        cmd.Parameters.AddWithValue("oph", project.OwnerPhone);
        cmd.Parameters.AddWithValue("reg", project.Region);
        cmd.Parameters.AddWithValue("st", project.Status);
        cmd.Parameters.AddWithValue("pwd", (object?)project.PasswordHash ?? DBNull.Value);
        cmd.Parameters.AddWithValue("hp", project.HasPassword);
        cmd.Parameters.AddWithValue("srv", servicesJson);
        cmd.Parameters.AddWithValue("ca", project.CreatedAtUtc);
        cmd.Parameters.AddWithValue("ua", (object?)project.UpdatedAtUtc ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync();

        if (_redisDb != null)
        {
            try
            {
                await _redisDb.StringSetAsync($"localme:project:{project.Slug}", project.Id, TimeSpan.FromDays(7));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LocalMe.Redis] Cache write non-blocking failure: {ex.Message}");
            }
        }
    }

    public async Task DeleteProjectAsync(string projectId)
    {
        await EnsureInitializedAsync();
        const string sql = "DELETE FROM projects WHERE id = @id;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", projectId);
        await cmd.ExecuteNonQueryAsync();
    }

    // 3. Shetab IPG Configs
    public async Task<Dictionary<string, IpgMerchantConfig>> LoadIpgConfigsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, IpgMerchantConfig>();
        const string sql = "SELECT project_id, terminal_id, merchant_key, default_psp, enforce_card_mask, is_sandbox, config_data FROM project_ipg_configs;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(0);
            var termId = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
            var mKey = reader.IsDBNull(2) ? string.Empty : reader.GetString(2);
            var psp = reader.IsDBNull(3) ? "ZARINPAL" : reader.GetString(3);
            var mask = !reader.IsDBNull(4) && reader.GetBoolean(4);
            var sandbox = !reader.IsDBNull(5) && reader.GetBoolean(5);
            var configJson = reader.IsDBNull(6) ? "{}" : reader.GetString(6);

            JsonDocument? doc = null;
            try { doc = JsonDocument.Parse(configJson); }
            catch (Exception ex)
            {
                Console.WriteLine($"[LocalMe.Store] Failed to parse IPG config JSON: {ex.Message}");
            }

            using (doc)
            {
                string? mellatTerm = doc?.RootElement.TryGetProperty("mellatTerminalId", out var p1) == true && p1.ValueKind == JsonValueKind.String ? p1.GetString() : null;
                string? mellatUser = doc?.RootElement.TryGetProperty("mellatUserName", out var p2) == true && p2.ValueKind == JsonValueKind.String ? p2.GetString() : null;
                string? mellatPass = doc?.RootElement.TryGetProperty("mellatUserPassword", out var p3) == true && p3.ValueKind == JsonValueKind.String ? p3.GetString() : null;
                string? mellatPayer = doc?.RootElement.TryGetProperty("mellatPayerId", out var p4) == true && p4.ValueKind == JsonValueKind.String ? p4.GetString() : null;

                string? sepTerm = doc?.RootElement.TryGetProperty("sepTerminalId", out var p5) == true && p5.ValueKind == JsonValueKind.String ? p5.GetString() : null;
                string? sepMerch = doc?.RootElement.TryGetProperty("sepMerchantId", out var p6) == true && p6.ValueKind == JsonValueKind.String ? p6.GetString() : null;
                string? sepCell = doc?.RootElement.TryGetProperty("sepCellNumber", out var p7) == true && p7.ValueKind == JsonValueKind.String ? p7.GetString() : null;

                string? zarinMerch = doc?.RootElement.TryGetProperty("zarinpalMerchantId", out var p8) == true && p8.ValueKind == JsonValueKind.String ? p8.GetString() : null;
                bool? zarinGate = doc?.RootElement.TryGetProperty("zarinpalIsZarinGate", out var p9) == true && (p9.ValueKind == JsonValueKind.True || p9.ValueKind == JsonValueKind.False) ? p9.GetBoolean() : null;
                bool? zarinSand = doc?.RootElement.TryGetProperty("zarinpalSandbox", out var p10) == true && (p10.ValueKind == JsonValueKind.True || p10.ValueKind == JsonValueKind.False) ? p10.GetBoolean() : null;

                string? sadadMerch = doc?.RootElement.TryGetProperty("sadadMerchantId", out var p11) == true && p11.ValueKind == JsonValueKind.String ? p11.GetString() : null;
                string? sadadTerm = doc?.RootElement.TryGetProperty("sadadTerminalId", out var p12) == true && p12.ValueKind == JsonValueKind.String ? p12.GetString() : null;
                string? sadadKey = doc?.RootElement.TryGetProperty("sadadTerminalKey", out var p13) == true && p13.ValueKind == JsonValueKind.String ? p13.GetString() : null;

                dict[prjId] = new IpgMerchantConfig(
                    TerminalId: termId,
                    MerchantKey: mKey,
                    DefaultPsp: psp,
                    EnforceShetabCardMask: mask,
                    IsSandbox: sandbox,
                    MellatTerminalId: mellatTerm,
                    MellatUserName: mellatUser,
                    MellatUserPassword: mellatPass,
                    MellatPayerId: mellatPayer,
                    SepTerminalId: sepTerm,
                    SepMerchantId: sepMerch,
                    SepCellNumber: sepCell,
                    ZarinpalMerchantId: zarinMerch,
                    ZarinpalIsZarinGate: zarinGate,
                    ZarinpalSandbox: zarinSand,
                    SadadMerchantId: sadadMerch,
                    SadadTerminalId: sadadTerm,
                    SadadTerminalKey: sadadKey
                );
            }
        }
        return dict;
    }

    public async Task SaveIpgConfigAsync(string projectId, IpgMerchantConfig config)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_ipg_configs (project_id, terminal_id, merchant_key, default_psp, enforce_card_mask, is_sandbox, config_data, updated_at_utc)
            VALUES (@pid, @tid, @mk, @psp, @mask, @sb, @cfg::jsonb, NOW())
            ON CONFLICT (project_id) DO UPDATE SET
                terminal_id = EXCLUDED.terminal_id,
                merchant_key = EXCLUDED.merchant_key,
                default_psp = EXCLUDED.default_psp,
                enforce_card_mask = EXCLUDED.enforce_card_mask,
                is_sandbox = EXCLUDED.is_sandbox,
                config_data = EXCLUDED.config_data,
                updated_at_utc = NOW();";

        var extraData = new
        {
            mellatTerminalId = config.MellatTerminalId,
            mellatUserName = config.MellatUserName,
            mellatUserPassword = config.MellatUserPassword,
            mellatPayerId = config.MellatPayerId,
            sepTerminalId = config.SepTerminalId,
            sepMerchantId = config.SepMerchantId,
            sepCellNumber = config.SepCellNumber,
            zarinpalMerchantId = config.ZarinpalMerchantId,
            zarinpalIsZarinGate = config.ZarinpalIsZarinGate,
            zarinpalSandbox = config.ZarinpalSandbox,
            sadadMerchantId = config.SadadMerchantId,
            sadadTerminalId = config.SadadTerminalId,
            sadadTerminalKey = config.SadadTerminalKey
        };
        var extraJson = JsonSerializer.Serialize(extraData);

        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("tid", (object?)config.TerminalId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("mk", (object?)config.MerchantKey ?? DBNull.Value);
        cmd.Parameters.AddWithValue("psp", config.DefaultPsp);
        cmd.Parameters.AddWithValue("mask", config.EnforceShetabCardMask);
        cmd.Parameters.AddWithValue("sb", config.IsSandbox);
        cmd.Parameters.AddWithValue("cfg", extraJson);
        await cmd.ExecuteNonQueryAsync();
    }

    // 4. Collaborators
    public async Task<Dictionary<string, List<ProjectCollaborator>>> LoadCollaboratorsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<ProjectCollaborator>>();
        const string sql = "SELECT id, project_id, full_name, email_or_phone, role, status, added_at_utc FROM project_collaborators ORDER BY added_at_utc ASC;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(1);
            if (!dict.TryGetValue(prjId, out var list))
            {
                list = [];
                dict[prjId] = list;
            }
            list.Add(new ProjectCollaborator(
                Id: reader.GetString(0),
                FullName: reader.GetString(2),
                EmailOrPhone: reader.GetString(3),
                Role: reader.GetString(4),
                Status: reader.GetString(5),
                AddedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc)
            ));
        }
        return dict;
    }

    public async Task SaveCollaboratorAsync(string projectId, ProjectCollaborator collaborator)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_collaborators (id, project_id, full_name, email_or_phone, role, status, added_at_utc)
            VALUES (@id, @pid, @fn, @ep, @role, @st, @added)
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email_or_phone = EXCLUDED.email_or_phone,
                role = EXCLUDED.role,
                status = EXCLUDED.status;";

        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", collaborator.Id);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("fn", collaborator.FullName);
        cmd.Parameters.AddWithValue("ep", collaborator.EmailOrPhone);
        cmd.Parameters.AddWithValue("role", collaborator.Role);
        cmd.Parameters.AddWithValue("st", collaborator.Status);
        cmd.Parameters.AddWithValue("added", collaborator.AddedAtUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteCollaboratorAsync(string projectId, string collaboratorId)
    {
        await EnsureInitializedAsync();
        const string sql = "DELETE FROM project_collaborators WHERE project_id = @pid AND id = @cid;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("cid", collaboratorId);
        await cmd.ExecuteNonQueryAsync();
    }

    // 5. Compliance Configs
    public async Task<Dictionary<string, ComplianceConfig>> LoadComplianceConfigsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, ComplianceConfig>();
        const string sql = "SELECT project_id, enamad_token, enamad_symbol_code, samandehi_code, android_package_name, android_sha256, apple_team_id, apple_app_bundle_id, updated_at_utc FROM project_compliance_configs;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            dict[reader.GetString(0)] = new ComplianceConfig(
                EnamadToken: reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                EnamadSymbolCode: reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                SamandehiCode: reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                AndroidPackageName: reader.IsDBNull(4) ? string.Empty : reader.GetString(4),
                AndroidSha256Fingerprint: reader.IsDBNull(5) ? string.Empty : reader.GetString(5),
                AppleTeamId: reader.IsDBNull(6) ? string.Empty : reader.GetString(6),
                AppleAppBundleId: reader.IsDBNull(7) ? string.Empty : reader.GetString(7),
                UpdatedAtUtc: reader.IsDBNull(8) ? DateTimeOffset.UtcNow : DateTime.SpecifyKind(reader.GetDateTime(8), DateTimeKind.Utc)
            );
        }
        return dict;
    }

    public async Task SaveComplianceConfigAsync(string projectId, ComplianceConfig config)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_compliance_configs (project_id, enamad_token, enamad_symbol_code, samandehi_code, android_package_name, android_sha256, apple_team_id, apple_app_bundle_id, updated_at_utc)
            VALUES (@pid, @et, @esc, @sc, @apn, @asha, @ati, @abi, NOW())
            ON CONFLICT (project_id) DO UPDATE SET
                enamad_token = EXCLUDED.enamad_token,
                enamad_symbol_code = EXCLUDED.enamad_symbol_code,
                samandehi_code = EXCLUDED.samandehi_code,
                android_package_name = EXCLUDED.android_package_name,
                android_sha256 = EXCLUDED.android_sha256,
                apple_team_id = EXCLUDED.apple_team_id,
                apple_app_bundle_id = EXCLUDED.apple_app_bundle_id,
                updated_at_utc = NOW();";

        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("et", (object?)config.EnamadToken ?? DBNull.Value);
        cmd.Parameters.AddWithValue("esc", (object?)config.EnamadSymbolCode ?? DBNull.Value);
        cmd.Parameters.AddWithValue("sc", (object?)config.SamandehiCode ?? DBNull.Value);
        cmd.Parameters.AddWithValue("apn", (object?)config.AndroidPackageName ?? DBNull.Value);
        cmd.Parameters.AddWithValue("asha", (object?)config.AndroidSha256Fingerprint ?? DBNull.Value);
        cmd.Parameters.AddWithValue("ati", (object?)config.AppleTeamId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("abi", (object?)config.AppleAppBundleId ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task WipeAllProjectDataAsync()
    {
        await EnsureInitializedAsync();
        const string sql = @"
            DELETE FROM projects;
            TRUNCATE TABLE 
                payment_transactions,
                payments,
                customer_ledgers,
                customer_wallets,
                billing_usage_records,
                project_push_devices,
                project_push_configs,
                project_iap_configs,
                project_iap_records,
                project_table_records,
                project_auth_users,
                project_collaborators,
                project_ipg_configs,
                project_compliance_configs,
                project_deployments,
                project_domains,
                project_buckets,
                project_storage_files,
                project_functions,
                project_logs
            CASCADE;
            DELETE FROM platform_users WHERE id NOT IN ('usr_admin_01', 'usr_operator_02', 'usr_developer_03');
            UPDATE platform_users SET wallet_balance_irr = 0;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await cmd.ExecuteNonQueryAsync();

        if (_redis != null)
        {
            try
            {
                var endpoints = _redis.GetEndPoints();
                foreach (var ep in endpoints)
                {
                    var srv = _redis.GetServer(ep);
                    if (srv.IsConnected)
                    {
                        var keys = srv.Keys(pattern: "localme:*").ToArray();
                        if (keys.Length > 0 && _redisDb != null)
                        {
                            await _redisDb.KeyDeleteAsync(keys);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LocalMe.Store] Redis wipe warning: {ex.Message}");
            }
        }
    }

    private async Task EnsureInitializedAsync()
    {
        if (_dataSource == null)
        {
            await InitializeAsync();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_dataSource != null)
        {
            await _dataSource.DisposeAsync();
        }
        if (_redis != null)
        {
            await _redis.DisposeAsync();
        }
    }
}
