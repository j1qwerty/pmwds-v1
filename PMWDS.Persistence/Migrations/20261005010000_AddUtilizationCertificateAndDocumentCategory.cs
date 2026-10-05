using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PMWDS.Persistence.Context;

#nullable disable

namespace PMWDS.Persistence.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261005010000_AddUtilizationCertificateAndDocumentCategory")]
public partial class AddUtilizationCertificateAndDocumentCategory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        var sqlServer = migrationBuilder.ActiveProvider?.Contains(
            "SqlServer",
            StringComparison.OrdinalIgnoreCase) == true;

        var guidType = sqlServer ? "uniqueidentifier" : "TEXT";
        var dateTimeType = sqlServer ? "datetime2" : "TEXT";
        var boolType = sqlServer ? "bit" : "INTEGER";
        var intType = sqlServer ? "int" : "INTEGER";
        string textType(int maxLength) => sqlServer ? $"nvarchar({maxLength})" : "TEXT";

        migrationBuilder.AddColumn<string>(
            name: "Category",
            table: "ProjectDocuments",
            type: textType(40),
            maxLength: 40,
            nullable: false,
            defaultValue: "General");

        migrationBuilder.CreateIndex(
            name: "IX_ProjectDocuments_Category",
            table: "ProjectDocuments",
            column: "Category");

        migrationBuilder.CreateTable(
            name: "UtilizationCertificates",
            columns: table => new
            {
                Id = table.Column<Guid>(type: guidType, nullable: false),
                ProjectId = table.Column<Guid>(type: guidType, nullable: false),
                DocumentId = table.Column<Guid>(type: guidType, nullable: false),
                CertificateNumber = table.Column<string>(type: textType(100), maxLength: 100, nullable: false),
                FundingSource = table.Column<string>(type: textType(200), maxLength: 200, nullable: false),
                AmountClaimed = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                AmountUtilized = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                PeriodStart = table.Column<DateTime>(type: dateTimeType, nullable: false),
                PeriodEnd = table.Column<DateTime>(type: dateTimeType, nullable: false),
                Status = table.Column<string>(type: textType(20), maxLength: 20, nullable: false),
                MilestoneId = table.Column<Guid>(type: guidType, nullable: true),
                TaskId = table.Column<Guid>(type: guidType, nullable: true),
                Purpose = table.Column<string>(type: textType(2000), maxLength: 2000, nullable: true),
                SubmittedByUserId = table.Column<string>(type: textType(100), maxLength: 100, nullable: false),
                SubmittedOn = table.Column<DateTime>(type: dateTimeType, nullable: true),
                ReviewedByUserId = table.Column<string>(type: textType(100), maxLength: 100, nullable: true),
                ReviewedOn = table.Column<DateTime>(type: dateTimeType, nullable: true),
                ReviewNotes = table.Column<string>(type: textType(2000), maxLength: 2000, nullable: true),
                CreatedDate = table.Column<DateTime>(type: dateTimeType, nullable: false),
                ModifiedDate = table.Column<DateTime>(type: dateTimeType, nullable: true),
                CreatedBy = table.Column<string>(type: textType(100), maxLength: 100, nullable: false),
                ModifiedBy = table.Column<string>(type: textType(100), maxLength: 100, nullable: true),
                IsDeleted = table.Column<bool>(type: boolType, nullable: false),
                RowVersion = table.Column<int>(type: intType, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_UtilizationCertificates", x => x.Id);
                table.ForeignKey(
                    name: "FK_UtilizationCertificates_Milestones_MilestoneId",
                    column: x => x.MilestoneId,
                    principalTable: "Milestones",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.SetNull);
                table.ForeignKey(
                    name: "FK_UtilizationCertificates_ProjectDocuments_DocumentId",
                    column: x => x.DocumentId,
                    principalTable: "ProjectDocuments",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_UtilizationCertificates_Projects_ProjectId",
                    column: x => x.ProjectId,
                    principalTable: "Projects",
                    principalColumn: "Id",
                    onDelete: sqlServer
                        ? ReferentialAction.NoAction
                        : ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_UtilizationCertificates_Tasks_TaskId",
                    column: x => x.TaskId,
                    principalTable: "Tasks",
                    principalColumn: "Id",
                    onDelete: sqlServer
                        ? ReferentialAction.NoAction
                        : ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "IX_UtilizationCertificates_CertificateNumber",
            table: "UtilizationCertificates",
            column: "CertificateNumber");

        migrationBuilder.CreateIndex(
            name: "IX_UtilizationCertificates_DocumentId",
            table: "UtilizationCertificates",
            column: "DocumentId",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_UtilizationCertificates_MilestoneId",
            table: "UtilizationCertificates",
            column: "MilestoneId");

        migrationBuilder.CreateIndex(
            name: "IX_UtilizationCertificates_ProjectId",
            table: "UtilizationCertificates",
            column: "ProjectId");

        migrationBuilder.CreateIndex(
            name: "IX_UtilizationCertificates_Status",
            table: "UtilizationCertificates",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_UtilizationCertificates_TaskId",
            table: "UtilizationCertificates",
            column: "TaskId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "UtilizationCertificates");

        migrationBuilder.DropIndex(
            name: "IX_ProjectDocuments_Category",
            table: "ProjectDocuments");

        migrationBuilder.DropColumn(
            name: "Category",
            table: "ProjectDocuments");
    }
}
