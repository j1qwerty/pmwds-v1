using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PMWDS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DetachDocumentHierarchyLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectDocuments_Milestones_MilestoneId",
                table: "ProjectDocuments");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectDocuments_Tasks_TaskId",
                table: "ProjectDocuments");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectDocuments_Milestones_MilestoneId",
                table: "ProjectDocuments",
                column: "MilestoneId",
                principalTable: "Milestones",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectDocuments_Tasks_TaskId",
                table: "ProjectDocuments",
                column: "TaskId",
                principalTable: "Tasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectDocuments_Milestones_MilestoneId",
                table: "ProjectDocuments");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectDocuments_Tasks_TaskId",
                table: "ProjectDocuments");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectDocuments_Milestones_MilestoneId",
                table: "ProjectDocuments",
                column: "MilestoneId",
                principalTable: "Milestones",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectDocuments_Tasks_TaskId",
                table: "ProjectDocuments",
                column: "TaskId",
                principalTable: "Tasks",
                principalColumn: "Id");
        }
    }
}
