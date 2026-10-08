using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PMWDS.Persistence.Context;

#nullable disable

namespace PMWDS.Persistence.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261008000000_AddDocumentArchiveRetention")]
public sealed class AddDocumentArchiveRetention : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        var sqlServer = migrationBuilder.ActiveProvider?.Contains(
            "SqlServer",
            StringComparison.OrdinalIgnoreCase) == true;

        migrationBuilder.AddColumn<DateTime>(
            name: "DeletedDate",
            table: "ProjectDocuments",
            type: sqlServer ? "datetime2" : "TEXT",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "DocumentArchiveRetentionDays",
            table: "AIGlobalSettings",
            type: sqlServer ? "int" : "INTEGER",
            nullable: false,
            defaultValue: 30);

        migrationBuilder.Sql(
            "UPDATE ProjectDocuments SET DeletedDate = COALESCE(ModifiedDate, CreatedDate) " +
            "WHERE IsDeleted = 1 AND DeletedDate IS NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "DeletedDate",
            table: "ProjectDocuments");

        migrationBuilder.DropColumn(
            name: "DocumentArchiveRetentionDays",
            table: "AIGlobalSettings");
    }
}
