using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class ProjectDepartment : AuditableEntity
{
    public Guid ProjectId { get; private set; }
    public Guid DepartmentId { get; private set; }
    public bool IsPrimary { get; private set; }

    /// <summary>
    /// Set by <see cref="Project.AssignDepartments"/> when a department is
    /// unassigned from a project. ApplicationDbContext turns this into a real
    /// DELETE on save.
    ///
    /// Why hard-delete instead of the usual soft-delete: ProjectDepartments has
    /// a UNIQUE index on (ProjectId, DepartmentId), so a soft-deleted row would
    /// permanently block re-assigning that department to the same project. The
    /// department audit trail lives in ActivityLog, so the join row itself does
    /// not need to be retained.
    /// </summary>
    public bool MarkedForDeletion { get; private set; }

    public Project? Project { get; private set; }
    public Department? Department { get; private set; }

    protected ProjectDepartment() { }

    public static ProjectDepartment Create(Guid projectId, Guid departmentId, bool isPrimary = false)
        => new()
        {
            ProjectId = projectId,
            DepartmentId = departmentId,
            IsPrimary = isPrimary
        };

    public void MarkPrimary()
        => IsPrimary = true;

    public void ClearPrimary()
        => IsPrimary = false;

    public void MarkForDeletion()
        => MarkedForDeletion = true;
}