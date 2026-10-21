namespace LocalMe.DataPlane.Admin;

using System.Text.Json.Serialization;

/// <summary>
/// Sovereign Iranian BaaS global platform configurations and operational variables.
/// Completely specifiable, persistable, and auditable by Superadmins.
/// </summary>
public sealed class PlatformConfig
{
    // 1. Pricing & Billing Variables (IRR)
    public long DbQueryPer1kIrr { get; set; } = 100;
    public long StorageGbMonthIrr { get; set; } = 500;
    public long SmsPerMessageIrr { get; set; } = 800;
    public long ComputePer100msIrr { get; set; } = 10;
    public long EgressGbIrr { get; set; } = 2_000;
    public long MinWalletTopupIrr { get; set; } = 100_000;
    public long InitialFreeCreditIrr { get; set; } = 5_000_000;

    // 2. Operational & Platform Variables
    public bool MaintenanceMode { get; set; }
    public string MaintenanceMessage { get; set; } = "سامانه در حال به‌روزرسانی زیرساختی می‌باشد. لطفاً دقایقی دیگر مراجعه فرمایید.";
    public string PlatformName { get; set; } = "لوکال‌می (LocalMe)";
    public string DefaultRegion { get; set; } = "ir-thr-milad1";
    public string SovereignEgressNat { get; set; } = "2.180.12.94 (Static Domestic NAT Active)";
    public string SystemBroadcastMessage { get; set; } = "";

    // 3. Developer & Tier Limits
    public int MaxProjectsPerDeveloperTier { get; set; } = 1;
    public int MaxTeamMembersPerDeveloperTier { get; set; } = 1;

    // 4. Global SMS Gateway Defaults
    public string SmsDefaultProvider { get; set; } = "kavenegar"; // kavenegar, melipayamak, magfa
    public string SmsDefaultApiKey { get; set; } = "";
    public string SmsDefaultSenderNumber { get; set; } = "3000777";
    public string SmsDefaultPatternCode { get; set; } = "localme-verify";
    public int SmsDefaultOtpLength { get; set; } = 6;
    public int SmsDefaultOtpExpirySeconds { get; set; } = 120;

    // 5. Global Shetab IPG Defaults
    public string IpgDefaultPsp { get; set; } = "zarinpal"; // zarinpal, behpardakht, sep, sadad
    public string IpgDefaultMerchantId { get; set; } = "";
    public string IpgCallbackBaseUrl { get; set; } = "https://api.localme.ir/_baas/v1/pay/callback";
    public long ShaparakWageIrr { get; set; } = 1_200;

    // 6. Security, Session & Rate-Limit Variables
    public string JwtSecret { get; set; } = "localme-platform-production-hmac-sha256-secret-key-32-chars-min!";
    public int JwtExpiryHours { get; set; } = 72;
    public int RefreshTokenExpiryDays { get; set; } = 30;
    public int MaxLoginFailedAttempts { get; set; } = 5;
    public int LockoutDurationMinutes { get; set; } = 15;
    public string CorsAllowedOrigins { get; set; } = "*";

    // 7. Resource Envelopes & Limits
    public long DefaultStorageQuotaMb { get; set; } = 1024;
    public long DefaultMaxFileSizeMb { get; set; } = 50;
    public int DefaultFunctionsMemoryMb { get; set; } = 16;
    public int DefaultFunctionsTimeoutMs { get; set; } = 5000;
    public int DefaultDbMaxConnections { get; set; } = 20;

    // 8. Platform & Console Logging Controls
    public string PlatformLogLevel { get; set; } = "Information"; // Trace, Debug, Information, Warning, Error
    public string LoggingGranularity { get; set; } = "Standard"; // Verbose, Standard, Minimal
    public bool IsPlatformLoggingActive { get; set; } = true;
    public bool ConsoleLoggingEnabled { get; set; } = true;

    // Audit Metadata
    public DateTimeOffset LastUpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public string LastUpdatedBy { get; set; } = "system_superadmin";

    public PlatformConfig Clone()
    {
        return new PlatformConfig
        {
            DbQueryPer1kIrr = DbQueryPer1kIrr,
            StorageGbMonthIrr = StorageGbMonthIrr,
            SmsPerMessageIrr = SmsPerMessageIrr,
            ComputePer100msIrr = ComputePer100msIrr,
            EgressGbIrr = EgressGbIrr,
            MinWalletTopupIrr = MinWalletTopupIrr,
            InitialFreeCreditIrr = InitialFreeCreditIrr,
            MaintenanceMode = MaintenanceMode,
            MaintenanceMessage = MaintenanceMessage,
            PlatformName = PlatformName,
            DefaultRegion = DefaultRegion,
            SovereignEgressNat = SovereignEgressNat,
            SystemBroadcastMessage = SystemBroadcastMessage,
            MaxProjectsPerDeveloperTier = MaxProjectsPerDeveloperTier,
            MaxTeamMembersPerDeveloperTier = MaxTeamMembersPerDeveloperTier,
            SmsDefaultProvider = SmsDefaultProvider,
            SmsDefaultApiKey = SmsDefaultApiKey,
            SmsDefaultSenderNumber = SmsDefaultSenderNumber,
            SmsDefaultPatternCode = SmsDefaultPatternCode,
            SmsDefaultOtpLength = SmsDefaultOtpLength,
            SmsDefaultOtpExpirySeconds = SmsDefaultOtpExpirySeconds,
            IpgDefaultPsp = IpgDefaultPsp,
            IpgDefaultMerchantId = IpgDefaultMerchantId,
            IpgCallbackBaseUrl = IpgCallbackBaseUrl,
            ShaparakWageIrr = ShaparakWageIrr,
            JwtSecret = JwtSecret,
            JwtExpiryHours = JwtExpiryHours,
            RefreshTokenExpiryDays = RefreshTokenExpiryDays,
            MaxLoginFailedAttempts = MaxLoginFailedAttempts,
            LockoutDurationMinutes = LockoutDurationMinutes,
            CorsAllowedOrigins = CorsAllowedOrigins,
            DefaultStorageQuotaMb = DefaultStorageQuotaMb,
            DefaultMaxFileSizeMb = DefaultMaxFileSizeMb,
            DefaultFunctionsMemoryMb = DefaultFunctionsMemoryMb,
            DefaultFunctionsTimeoutMs = DefaultFunctionsTimeoutMs,
            DefaultDbMaxConnections = DefaultDbMaxConnections,
            PlatformLogLevel = PlatformLogLevel,
            LoggingGranularity = LoggingGranularity,
            IsPlatformLoggingActive = IsPlatformLoggingActive,
            ConsoleLoggingEnabled = ConsoleLoggingEnabled,
            LastUpdatedAtUtc = LastUpdatedAtUtc,
            LastUpdatedBy = LastUpdatedBy
        };
    }
}
