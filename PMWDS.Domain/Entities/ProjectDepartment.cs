using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class ProjectDepartment : AuditableEntity
{
    public Guid ProjectId { get; private set; }
    public Guid DepartmentId { get; private set; }
    public bool IsPrimary { get; private set; }

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
}
