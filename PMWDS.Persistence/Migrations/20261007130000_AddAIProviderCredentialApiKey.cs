using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PMWDS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAIProviderCredentialApiKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Same provider split as the other consolidated migrations: SQL Server
            // has no TEXT type, and nvarchar(2000) is the equivalent of a
            // length-limited string there. SQLite stores every string as TEXT.
            var sqlServer = migrationBuilder.ActiveProvider?.Contains(
                "SqlServer",
                StringComparison.OrdinalIgnoreCase) == true;

            migrationBuilder.AddColumn<string>(
                name: "ApiKey",
                table: "AIProviderCredentials",
                type: sqlServer ? "nvarchar(2000)" : "TEXT",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApiKey",
                table: "AIProviderCredentials");
        }
    }
}