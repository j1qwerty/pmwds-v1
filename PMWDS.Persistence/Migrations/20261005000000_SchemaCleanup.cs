using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PMWDS.Persistence.Migrations;

public partial class SchemaCleanup : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "ApiKey",
            table: "AIProviderCredentials");

        migrationBuilder.DropColumn(
            name: "IsActive",
            table: "AIGlobalSettings");

        migrationBuilder.DropTable(
            name: "TimeEntries");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "TimeEntries",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                TaskId = table.Column<Guid>(nullable: false),
                UserId = table.Column<Guid>(nullable: false),
                StartTime = table.Column<DateTime>(nullable: false),
                EndTime = table.Column<DateTime>(nullable: true),
                Description = table.Column<string>(maxLength: 2000, nullable: false),
                IsBillable = table.Column<bool>(nullable: false),
                IsManualEntry = table.Column<bool>(nullable: false),
                CreatedDate = table.Column<DateTime>(nullable: false),
                CreatedBy = table.Column<string>(nullable: false),
                ModifiedDate = table.Column<DateTime>(nullable: true),
                ModifiedBy = table.Column<string>(nullable: true),
                IsDeleted = table.Column<bool>(nullable: false),
                RowVersion = table.Column<int>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TimeEntries", x => x.Id);
                table.ForeignKey(
                    name: "FK_TimeEntries_Tasks_TaskId",
                    column: x => x.TaskId,
                    principalTable: "Tasks",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_TimeEntries_Users_UserId",
                    column: x => x.UserId,
                    principalTable: "Users",
                    principalColumn: "Id");
            });

        migrationBuilder.CreateIndex(
            name: "IX_TimeEntries_StartTime",
            table: "TimeEntries",
            column: "StartTime");

        migrationBuilder.CreateIndex(
            name: "IX_TimeEntries_TaskId",
            table: "TimeEntries",
            column: "TaskId");

        migrationBuilder.CreateIndex(
            name: "IX_TimeEntries_UserId",
            table: "TimeEntries",
            column: "UserId");

        migrationBuilder.CreateIndex(
            name: "IX_TimeEntries_IsDeleted",
            table: "TimeEntries",
            column: "IsDeleted");

        migrationBuilder.CreateIndex(
            name: "IX_TimeEntries_IsDeleted_TaskId_UserId_StartTime",
            table: "TimeEntries",
            columns: new[] { "IsDeleted", "TaskId", "UserId", "StartTime" });

        migrationBuilder.AddColumn<string>(
            name: "ApiKey",
            table: "AIProviderCredentials",
            type: "nvarchar(2000)",
            maxLength: 2000,
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "IsActive",
            table: "AIGlobalSettings",
            nullable: false,
            defaultValue: false);
    }
}
