using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PMWDS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixAiGlobalSettingsIsActiveDrift : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // InitialCreate emitted an "IsActive" column for AIGlobalSettings, but AIGlobalSetting
            // (via BaseEntity) has no such property and the model snapshot does not include it.
            // The column was created NOT NULL with no default, so EF INSERTs omitted it and every
            // seed of AIGlobalSettings failed with "NOT NULL constraint failed: AIGlobalSettings.IsActive".
            //
            // Development never saw this because the SQLite dev path uses EnsureCreated (model-driven),
            // which simply never created the column. Only migration-built databases hit it.
            migrationBuilder.Sql("ALTER TABLE \"AIGlobalSettings\" DROP COLUMN \"IsActive\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore the original shape. Kept permissive so it cannot fail on existing rows.
            migrationBuilder.Sql("ALTER TABLE \"AIGlobalSettings\" ADD COLUMN \"IsActive\" INTEGER NOT NULL DEFAULT 0;");
        }
    }
}