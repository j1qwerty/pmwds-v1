using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PMWDS.Persistence.Context;

#nullable disable

namespace PMWDS.Persistence.Migrations;

/// <summary>
/// Adds ProjectDepartments.MarkedForDeletion.
///
/// Project.AssignDepartments used to drop an unassigned department with a plain
/// List.RemoveAll. EF keeps the entity tracked and Unchanged after that, so the
/// save emitted an UPDATE for a row that was no longer wanted; that UPDATE
/// missed its RowVersion concurrency check and the whole request failed with
/// DbUpdateConcurrencyException ("expected to affect 1 row(s), but actually
/// affected 0"). In the UI this surfaced as: editing a project worked while the
/// department list was unchanged, but adding or removing any department
/// returned HTTP 500 and the edit sheet silently discarded the change.
///
/// The domain now sets MarkedForDeletion and ApplicationDbContext issues a real
/// DELETE for those rows. Hard delete (not soft delete) is required because
/// ProjectDepartments carries a UNIQUE index on (ProjectId, DepartmentId): an
/// IsDeleted row would permanently block re-assigning that department to the
/// same project.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20261011120000_AddProjectDepartmentMarkedForDeletion")]
public sealed class AddProjectDepartmentMarkedForDeletion : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        var sqlServer = migrationBuilder.ActiveProvider?.Contains(
            "SqlServer",
            StringComparison.OrdinalIgnoreCase) == true;

        migrationBuilder.AddColumn<bool>(
            name: "MarkedForDeletion",
            table: "ProjectDepartments",
            type: sqlServer ? "bit" : "INTEGER",
            nullable: false,
            defaultValue: false);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "MarkedForDeletion",
            table: "ProjectDepartments");
    }
}