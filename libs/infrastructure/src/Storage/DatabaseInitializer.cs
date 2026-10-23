namespace LocalMe.Infrastructure.Storage;

public static class DatabaseInitializer
{
    public static string GetControlPlaneMigrationSql()
    {
        return File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Migrations", "001_ControlPlane.sql"));
    }

    public static string GetTenantSchemaMigrationSql()
    {
        return File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Migrations", "002_TenantSchema.sql"));
    }

    public static string GetAnalyticsMigrationSql()
    {
        return File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Migrations", "003_AnalyticsAndBilling.sql"));
    }
}
