using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PMWDS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "MilestoneId",
                table: "ProjectDocuments",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TaskId",
                table: "ProjectDocuments",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectDocuments_MilestoneId",
                table: "ProjectDocuments",
                column: "MilestoneId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectDocuments_TaskId",
                table: "ProjectDocuments",
                column: "TaskId");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectDocuments_Milestones_MilestoneId",
                table: "ProjectDocuments");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectDocuments_Tasks_TaskId",
                table: "ProjectDocuments");

            migrationBuilder.DropIndex(
                name: "IX_ProjectDocuments_MilestoneId",
                table: "ProjectDocuments");

            migrationBuilder.DropIndex(
                name: "IX_ProjectDocuments_TaskId",
                table: "ProjectDocuments");

            migrationBuilder.DropColumn(
                name: "MilestoneId",
                table: "ProjectDocuments");

            migrationBuilder.DropColumn(
                name: "TaskId",
                table: "ProjectDocuments");
        }
    }
}
