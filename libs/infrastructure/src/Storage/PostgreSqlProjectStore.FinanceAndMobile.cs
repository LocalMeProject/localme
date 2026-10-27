namespace LocalMe.Infrastructure.Storage;

using System;
using System.Collections.Generic;
using System.Data;
using System.Text.Json;
using LocalMe.Core.Finance;
using LocalMe.DataPlane.Finance;
using LocalMe.DataPlane.Mobile;
using Npgsql;

public sealed partial class PostgreSqlProjectStore
{
    // 13. Payments & Double-Entry Ledger
    public async Task<List<StoredPayment>> LoadPaymentsAsync()
    {
        await EnsureInitializedAsync();
        var list = new List<StoredPayment>();
        const string sql = @"SELECT authority_token, gateway, amount_irr, customer_phone, callback_url, description, idempotency_key, is_verified, reference_id, project_id, created_at_utc 
                             FROM payment_transactions ORDER BY created_at_utc DESC;";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new StoredPayment(
                    AuthorityToken: reader.GetString(0),
                    Gateway: reader.GetString(1),
                    Amount: new RialAmount(reader.GetInt64(2)),
                    CustomerPhone: reader.GetString(3),
                    CallbackUrl: reader.GetString(4),
                    Description: reader.IsDBNull(5) ? string.Empty : reader.GetString(5),
                    IdempotencyKey: reader.GetString(6),
                    CreatedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(10), DateTimeKind.Utc),
                    IsVerified: reader.GetBoolean(7),
                    ReferenceId: reader.IsDBNull(8) ? null : reader.GetString(8),
                    ProjectId: reader.IsDBNull(9) ? null : reader.GetString(9)
                ));
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to load payments: {ex.Message}");
        }
        return list;
    }

    public async Task SavePaymentAsync(StoredPayment payment)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO payment_transactions (id, authority_token, gateway, amount_irr, customer_phone, callback_url, description, idempotency_key, is_verified, reference_id, project_id, created_at_utc)
            VALUES (@id, @auth, @gw, @amt, @ph, @cb, @desc, @ik, @ver, @ref, @pid, @ca)
            ON CONFLICT (authority_token) DO UPDATE SET
                is_verified = EXCLUDED.is_verified,
                reference_id = EXCLUDED.reference_id,
                description = EXCLUDED.description;";

        var id = $"pmt_{payment.AuthorityToken}";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            cmd.Parameters.AddWithValue("id", id);
            cmd.Parameters.AddWithValue("auth", payment.AuthorityToken);
            cmd.Parameters.AddWithValue("gw", payment.Gateway);
            cmd.Parameters.AddWithValue("amt", payment.Amount.AmountIrr);
            cmd.Parameters.AddWithValue("ph", payment.CustomerPhone);
            cmd.Parameters.AddWithValue("cb", payment.CallbackUrl);
            cmd.Parameters.AddWithValue("desc", (object?)payment.Description ?? DBNull.Value);
            cmd.Parameters.AddWithValue("ik", payment.IdempotencyKey);
            cmd.Parameters.AddWithValue("ver", payment.IsVerified);
            cmd.Parameters.AddWithValue("ref", (object?)payment.ReferenceId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("pid", (object?)payment.ProjectId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("ca", payment.CreatedAtUtc.UtcDateTime);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to save payment {payment.AuthorityToken}: {ex.Message}");
        }
    }

    public async Task<Dictionary<string, List<LedgerTransaction>>> LoadLedgersAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<LedgerTransaction>>();
        const string sql = "SELECT customer_phone, transaction_id, idempotency_key, entries_json, timestamp_utc FROM customer_ledgers ORDER BY timestamp_utc DESC;";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var phone = reader.GetString(0);
                var txId = reader.GetString(1);
                var ik = reader.GetString(2);
                var json = reader.GetString(3);
                var ts = DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc);

                var entries = JsonSerializer.Deserialize<List<LedgerEntry>>(json, JsonOptions) ?? [];
                if (!dict.TryGetValue(phone, out var list))
                {
                    list = [];
                    dict[phone] = list;
                }
                list.Add(new LedgerTransaction(txId, ik, ts, entries));
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to load customer ledgers: {ex.Message}");
        }
        return dict;
    }

    public async Task SaveLedgerTransactionAsync(string customerPhone, LedgerTransaction transaction)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO customer_ledgers (id, customer_phone, transaction_id, idempotency_key, entries_json, timestamp_utc)
            VALUES (@id, @ph, @tx, @ik, @ent::jsonb, @ts)
            ON CONFLICT (id) DO NOTHING;";

        var id = $"ltx_{transaction.TransactionId}_{customerPhone}";
        var json = JsonSerializer.Serialize(transaction.Entries, JsonOptions);
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            cmd.Parameters.AddWithValue("id", id);
            cmd.Parameters.AddWithValue("ph", customerPhone);
            cmd.Parameters.AddWithValue("tx", transaction.TransactionId);
            cmd.Parameters.AddWithValue("ik", transaction.IdempotencyKey);
            cmd.Parameters.AddWithValue("ent", json);
            cmd.Parameters.AddWithValue("ts", transaction.TimestampUtc.UtcDateTime);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to save ledger transaction {transaction.TransactionId}: {ex.Message}");
        }
    }

    public async Task<Dictionary<string, long>> LoadCustomerWalletsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, long>();
        const string sql = "SELECT customer_phone, balance_irr FROM customer_wallets;";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                dict[reader.GetString(0)] = reader.GetInt64(1);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to load customer wallets: {ex.Message}");
        }
        return dict;
    }

    public async Task SaveCustomerWalletAsync(string customerPhone, long balanceIrr)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO customer_wallets (customer_phone, balance_irr, updated_at_utc)
            VALUES (@ph, @bal, NOW())
            ON CONFLICT (customer_phone) DO UPDATE SET
                balance_irr = EXCLUDED.balance_irr,
                updated_at_utc = NOW();";

        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            cmd.Parameters.AddWithValue("ph", customerPhone);
            cmd.Parameters.AddWithValue("bal", balanceIrr);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to save wallet balance for {customerPhone}: {ex.Message}");
        }
    }

    // 14. Mobile Push Devices & Configs
    public async Task<Dictionary<string, List<PushDeviceRegistration>>> LoadPushDevicesAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<PushDeviceRegistration>>();
        const string sql = "SELECT device_id, project_id, push_token, platform, provider, user_id, tags_json, app_version, device_model, registered_at_utc FROM project_push_devices;";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var devId = reader.GetString(0);
                var pid = reader.GetString(1);
                var tok = reader.GetString(2);
                var plat = reader.GetString(3);
                var prov = reader.GetString(4);
                var uid = reader.IsDBNull(5) ? null : reader.GetString(5);
                var tagsJson = reader.IsDBNull(6) ? "[]" : reader.GetString(6);
                var ver = reader.IsDBNull(7) ? null : reader.GetString(7);
                var model = reader.IsDBNull(8) ? null : reader.GetString(8);
                var regAt = DateTime.SpecifyKind(reader.GetDateTime(9), DateTimeKind.Utc);

                var tags = JsonSerializer.Deserialize<List<string>>(tagsJson, JsonOptions) ?? [];
                if (!dict.TryGetValue(pid, out var list))
                {
                    list = [];
                    dict[pid] = list;
                }
                list.Add(new PushDeviceRegistration(devId, tok, plat, prov, uid, tags, ver, model, regAt));
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to load push devices: {ex.Message}");
        }
        return dict;
    }

    public async Task SavePushDeviceAsync(string projectId, PushDeviceRegistration registration)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_push_devices (device_id, project_id, push_token, platform, provider, user_id, tags_json, app_version, device_model, registered_at_utc)
            VALUES (@did, @pid, @tok, @plat, @prov, @uid, @tags::jsonb, @ver, @model, @ra)
            ON CONFLICT (project_id, device_id) DO UPDATE SET
                push_token = EXCLUDED.push_token,
                platform = EXCLUDED.platform,
                provider = EXCLUDED.provider,
                user_id = EXCLUDED.user_id,
                tags_json = EXCLUDED.tags_json,
                app_version = EXCLUDED.app_version,
                device_model = EXCLUDED.device_model;";

        var tagsJson = JsonSerializer.Serialize(registration.Tags ?? [], JsonOptions);
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            cmd.Parameters.AddWithValue("did", registration.DeviceId);
            cmd.Parameters.AddWithValue("pid", projectId);
            cmd.Parameters.AddWithValue("tok", registration.PushToken);
            cmd.Parameters.AddWithValue("plat", registration.Platform);
            cmd.Parameters.AddWithValue("prov", registration.Provider);
            cmd.Parameters.AddWithValue("uid", (object?)registration.UserId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("tags", tagsJson);
            cmd.Parameters.AddWithValue("ver", (object?)registration.AppVersion ?? DBNull.Value);
            cmd.Parameters.AddWithValue("model", (object?)registration.DeviceModel ?? DBNull.Value);
            cmd.Parameters.AddWithValue("ra", (registration.RegisteredAtUtc ?? DateTimeOffset.UtcNow).UtcDateTime);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to save push device {registration.DeviceId}: {ex.Message}");
        }
    }

    public async Task DeletePushDeviceAsync(string projectId, string deviceId)
    {
        await EnsureInitializedAsync();
        const string sql = "DELETE FROM project_push_devices WHERE project_id = @pid AND device_id = @did;";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            cmd.Parameters.AddWithValue("pid", projectId);
            cmd.Parameters.AddWithValue("did", deviceId);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to delete push device {deviceId}: {ex.Message}");
        }
    }

    public async Task<Dictionary<string, PushProviderConfig>> LoadPushConfigsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, PushProviderConfig>();
        const string sql = "SELECT project_id, fcm_server_key, apns_key_id, apns_team_id, apns_bundle_id, apns_auth_token, najva_api_token, pushy_api_key, enable_domestic_fallback FROM project_push_configs;";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var pid = reader.GetString(0);
                var fcm = reader.IsDBNull(1) ? null : reader.GetString(1);
                var apKey = reader.IsDBNull(2) ? null : reader.GetString(2);
                var apTeam = reader.IsDBNull(3) ? null : reader.GetString(3);
                var apBundle = reader.IsDBNull(4) ? null : reader.GetString(4);
                var apAuth = reader.IsDBNull(5) ? null : reader.GetString(5);
                var najva = reader.IsDBNull(6) ? null : reader.GetString(6);
                var pushy = reader.IsDBNull(7) ? null : reader.GetString(7);
                var fallback = reader.GetBoolean(8);

                dict[pid] = new PushProviderConfig(fcm, apKey, apTeam, apBundle, apAuth, najva, pushy, fallback);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to load push configs: {ex.Message}");
        }
        return dict;
    }

    public async Task SavePushConfigAsync(string projectId, PushProviderConfig config)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_push_configs (project_id, fcm_server_key, apns_key_id, apns_team_id, apns_bundle_id, apns_auth_token, najva_api_token, pushy_api_key, enable_domestic_fallback, updated_at_utc)
            VALUES (@pid, @fcm, @kId, @tId, @bId, @tok, @naj, @pshy, @fb, NOW())
            ON CONFLICT (project_id) DO UPDATE SET
                fcm_server_key = EXCLUDED.fcm_server_key,
                apns_key_id = EXCLUDED.apns_key_id,
                apns_team_id = EXCLUDED.apns_team_id,
                apns_bundle_id = EXCLUDED.apns_bundle_id,
                apns_auth_token = EXCLUDED.apns_auth_token,
                najva_api_token = EXCLUDED.najva_api_token,
                pushy_api_key = EXCLUDED.pushy_api_key,
                enable_domestic_fallback = EXCLUDED.enable_domestic_fallback,
                updated_at_utc = NOW();";

        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            cmd.Parameters.AddWithValue("pid", projectId);
            cmd.Parameters.AddWithValue("fcm", (object?)config.FcmServerKey ?? DBNull.Value);
            cmd.Parameters.AddWithValue("kId", (object?)config.ApnsKeyId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("tId", (object?)config.ApnsTeamId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("bId", (object?)config.ApnsBundleId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("tok", (object?)config.ApnsAuthToken ?? DBNull.Value);
            cmd.Parameters.AddWithValue("naj", (object?)config.NajvaApiToken ?? DBNull.Value);
            cmd.Parameters.AddWithValue("pshy", (object?)config.PushyApiKey ?? DBNull.Value);
            cmd.Parameters.AddWithValue("fb", config.EnableDomesticFallback);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to save push config for {projectId}: {ex.Message}");
        }
    }

    // 15. Mobile IAP Configs & Records
    public async Task<Dictionary<string, MobileIapConfig>> LoadIapConfigsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, MobileIapConfig>();
        const string sql = "SELECT project_id, bazaar_client_id, bazaar_client_secret, bazaar_refresh_token, myket_api_key, auto_credit_wallet FROM project_iap_configs;";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var pid = reader.GetString(0);
                var bId = reader.IsDBNull(1) ? null : reader.GetString(1);
                var bSec = reader.IsDBNull(2) ? null : reader.GetString(2);
                var bRef = reader.IsDBNull(3) ? null : reader.GetString(3);
                var myket = reader.IsDBNull(4) ? null : reader.GetString(4);
                var autoCredit = reader.GetBoolean(5);

                dict[pid] = new MobileIapConfig(bId, bSec, bRef, myket, autoCredit);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to load IAP configs: {ex.Message}");
        }
        return dict;
    }

    public async Task SaveIapConfigAsync(string projectId, MobileIapConfig config)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_iap_configs (project_id, bazaar_client_id, bazaar_client_secret, bazaar_refresh_token, myket_api_key, auto_credit_wallet, updated_at_utc)
            VALUES (@pid, @bid, @bsec, @bref, @myk, @ac, NOW())
            ON CONFLICT (project_id) DO UPDATE SET
                bazaar_client_id = EXCLUDED.bazaar_client_id,
                bazaar_client_secret = EXCLUDED.bazaar_client_secret,
                bazaar_refresh_token = EXCLUDED.bazaar_refresh_token,
                myket_api_key = EXCLUDED.myket_api_key,
                auto_credit_wallet = EXCLUDED.auto_credit_wallet,
                updated_at_utc = NOW();";

        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            cmd.Parameters.AddWithValue("pid", projectId);
            cmd.Parameters.AddWithValue("bid", (object?)config.BazaarClientId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("bsec", (object?)config.BazaarClientSecret ?? DBNull.Value);
            cmd.Parameters.AddWithValue("bref", (object?)config.BazaarRefreshToken ?? DBNull.Value);
            cmd.Parameters.AddWithValue("myk", (object?)config.MyketApiKey ?? DBNull.Value);
            cmd.Parameters.AddWithValue("ac", config.AutoCreditWallet);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to save IAP config for {projectId}: {ex.Message}");
        }
    }

    public async Task<Dictionary<string, List<IapVerifiedRecord>>> LoadIapRecordsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<IapVerifiedRecord>>();
        const string sql = "SELECT transaction_id, project_id, store, package_name, product_id, purchase_token, user_id, amount_irr, consumption_state, purchase_state, verified_at_utc FROM project_iap_records ORDER BY verified_at_utc DESC;";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var txId = reader.GetString(0);
                var pid = reader.GetString(1);
                var store = reader.GetString(2);
                var pkg = reader.GetString(3);
                var prod = reader.GetString(4);
                var tok = reader.GetString(5);
                var uid = reader.IsDBNull(6) ? null : reader.GetString(6);
                var amt = reader.GetInt64(7);
                var cs = reader.GetString(8);
                var ps = reader.GetString(9);
                var vAt = DateTime.SpecifyKind(reader.GetDateTime(10), DateTimeKind.Utc);

                if (!dict.TryGetValue(pid, out var list))
                {
                    list = [];
                    dict[pid] = list;
                }
                list.Add(new IapVerifiedRecord(txId, store, pkg, prod, tok, uid, amt, cs, ps, vAt));
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to load IAP records: {ex.Message}");
        }
        return dict;
    }

    public async Task SaveIapRecordAsync(string projectId, IapVerifiedRecord record)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_iap_records (transaction_id, project_id, store, package_name, product_id, purchase_token, user_id, amount_irr, consumption_state, purchase_state, verified_at_utc)
            VALUES (@tx, @pid, @store, @pkg, @prod, @tok, @uid, @amt, @cs, @ps, @va)
            ON CONFLICT (project_id, purchase_token) DO UPDATE SET
                consumption_state = EXCLUDED.consumption_state,
                purchase_state = EXCLUDED.purchase_state;";

        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            cmd.Parameters.AddWithValue("tx", record.TransactionId);
            cmd.Parameters.AddWithValue("pid", projectId);
            cmd.Parameters.AddWithValue("store", record.Store);
            cmd.Parameters.AddWithValue("pkg", record.PackageName);
            cmd.Parameters.AddWithValue("prod", record.ProductId);
            cmd.Parameters.AddWithValue("tok", record.PurchaseToken);
            cmd.Parameters.AddWithValue("uid", (object?)record.UserId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("amt", record.AmountIrr);
            cmd.Parameters.AddWithValue("cs", record.ConsumptionState);
            cmd.Parameters.AddWithValue("ps", record.PurchaseState);
            cmd.Parameters.AddWithValue("va", record.VerifiedAtUtc.UtcDateTime);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to save IAP record {record.TransactionId}: {ex.Message}");
        }
    }

    // 16. Raw Usage Metering
    public async Task RecordUsageRawAsync(string projectId, string metricType, long quantity, long costIrr)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO billing_usage_records (id, project_id, metric_type, quantity, cost_irr, recorded_at_utc)
            VALUES (@id, @pid, @mt, @qty, @cost, NOW());";

        var id = $"usg_{Guid.NewGuid():N}";
        try
        {
            await using var cmd = _dataSource!.CreateCommand(sql);
            cmd.Parameters.AddWithValue("id", id);
            cmd.Parameters.AddWithValue("pid", projectId);
            cmd.Parameters.AddWithValue("mt", metricType);
            cmd.Parameters.AddWithValue("qty", quantity);
            cmd.Parameters.AddWithValue("cost", costIrr);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Store] Failed to record usage: {ex.Message}");
        }
    }
}
