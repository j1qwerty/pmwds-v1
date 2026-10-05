using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PMWDS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUtilizationCertificate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // This migration must run on both engines, so column types branch on the active
            // provider. Two traps, both hit the hard way here:
            //
            // 1. SQLite's type names are not valid SQL Server. Guid/string/DateTime were
            //    all TEXT and bool/int INTEGER. SQL Server *parses* those names - TEXT is
            //    the legacy LOB type and INTEGER an INT alias - so the DDL was accepted
            //    right up to the primary key, which then failed:
            //      Column 'Id' in table 'UtilizationCertificates' is of a type that is
            //      invalid for use as a key column in an index.
            //
            // 2. Supplying a bare "nvarchar" is a trap of its own. When `type` is given
            //    EF Core uses it verbatim and IGNORES maxLength, so every string column was
            //    created as nvarchar(1). Saving a document then failed with
            //      String or binary data would be truncated in table 'ProjectDocuments',
            //      column 'Category'. Truncated value: 'G'.
            //    So the SQL Server string type must carry its length inline.
            //
            // Types are therefore fully qualified per provider. The SQLite branch is
            // byte-identical to what already shipped, so existing SQLite databases are
            // unaffected - EF Core tracks applied migrations by id, not file contents.
            // Omitting `type` instead was also tried and does NOT work: EF resolves
            // unspecified column types from this migration's TargetModel, and the model
            // snapshot has every column pinned to SQLite's TEXT.
            //
            // The FK behaviours also have to branch - cascade semantics are not a column
            // type. See the constraints below.

            var sqlServer = migrationBuilder.ActiveProvider?.Contains(
                "SqlServer", StringComparison.OrdinalIgnoreCase) == true;

            var guidType = sqlServer ? "uniqueidentifier" : "TEXT";
            var dateTimeType = sqlServer ? "datetime2" : "TEXT";
            var boolType = sqlServer ? "bit" : "INTEGER";
            var intType = sqlServer ? "int" : "INTEGER";

            // Length must be part of the type name, not just maxLength - see trap 2 above.
            string Text(int maxLength) => sqlServer ? $"nvarchar({maxLength})" : "TEXT";

            // Every pre-existing document is a plain file, so backfill the default
            // category rather than an empty string — the enum is stored as text and
            // "" cannot be converted back to DocumentCategory on read.
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "ProjectDocuments",
                type: Text(40),
                maxLength: 40,
                nullable: false,
                defaultValue: "General");

            migrationBuilder.CreateTable(
                name: "UtilizationCertificates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: guidType, nullable: false),
                    ProjectId = table.Column<Guid>(type: guidType, nullable: false),
                    DocumentId = table.Column<Guid>(type: guidType, nullable: false),
                    CertificateNumber = table.Column<string>(type: Text(100), maxLength: 100, nullable: false),
                    FundingSource = table.Column<string>(type: Text(200), maxLength: 200, nullable: false),
                    AmountClaimed = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AmountUtilized = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PeriodStart = table.Column<DateTime>(type: dateTimeType, nullable: false),
                    PeriodEnd = table.Column<DateTime>(type: dateTimeType, nullable: false),
                    Status = table.Column<string>(type: Text(20), maxLength: 20, nullable: false),
                    MilestoneId = table.Column<Guid>(type: guidType, nullable: true),
                    TaskId = table.Column<Guid>(type: guidType, nullable: true),
                    Purpose = table.Column<string>(type: Text(2000), maxLength: 2000, nullable: true),
                    SubmittedByUserId = table.Column<string>(type: Text(100), maxLength: 100, nullable: false),
                    SubmittedOn = table.Column<DateTime>(type: dateTimeType, nullable: true),
                    ReviewedByUserId = table.Column<string>(type: Text(100), maxLength: 100, nullable: true),
                    ReviewedOn = table.Column<DateTime>(type: dateTimeType, nullable: true),
                    ReviewNotes = table.Column<string>(type: Text(2000), maxLength: 2000, nullable: true),
                    CreatedDate = table.Column<DateTime>(type: dateTimeType, nullable: false),
                    ModifiedDate = table.Column<DateTime>(type: dateTimeType, nullable: true),
                    CreatedBy = table.Column<string>(type: Text(100), maxLength: 100, nullable: false),
                    ModifiedBy = table.Column<string>(type: Text(100), maxLength: 100, nullable: true),
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
                        // SQLite permits several cascade paths into one table, SQL Server
                        // does not. Projects already cascades to ProjectDocuments, which
                        // cascades here too, so keeping CASCADE on this FK as well gives
                        // SQL Server two routes to the same row and it refuses the table:
                        //
                        //   Introducing FOREIGN KEY constraint
                        //   'FK_UtilizationCertificates_Projects_ProjectId' ... may cause
                        //   cycles or multiple cascade paths.
                        //
                        // On SQL Server this FK becomes NO ACTION and the single remaining
                        // path Projects -> ProjectDocuments -> UtilizationCertificates does
                        // the work. SQLite keeps CASCADE because it needs the constraint
                        // to actually delete rows: with NO ACTION, SQLite would not
                        // cascade and orphan certificates would survive a project delete.
                        onDelete: sqlServer
                            ? ReferentialAction.NoAction
                            : ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UtilizationCertificates_Tasks_TaskId",
                        column: x => x.TaskId,
                        principalTable: "Tasks",
                        principalColumn: "Id",
                        // Same single-cascade-path rule as ProjectId above. Tasks already
                        // cascade from Projects, so SET NULL here is a second cascade path
                        // into UtilizationCertificates and SQL Server rejects the table.
                        // The one permitted path is
                        // Projects -> ProjectDocuments -> UtilizationCertificates.
                        //
                        // NO ACTION does NOT mean SQL Server loses the SET NULL behaviour.
                        // TaskRepository.DeleteTaskGraphsByIdsAsync clears the link in the
                        // application before any task delete, and every task-deletion path
                        // (task, subtask, milestone) funnels through that method. The result
                        // is identical on both providers: the certificate survives with a
                        // null TaskId instead of being deleted or blocking the delete.
                        onDelete: sqlServer
                            ? ReferentialAction.NoAction
                            : ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectDocuments_Category",
                table: "ProjectDocuments",
                column: "Category");

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

        /// <inheritdoc />
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
}
