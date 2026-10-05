using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class UserDepartment : AuditableEntity
{
    public Guid UserId { get; private set; }
    public Guid DepartmentId { get; private set; }
    public bool IsPrimary { get; private set; }

    public ApplicationUser? User { get; private set; }
    public Department? Department { get; private set; }

    protected UserDepartment() { }

    public static UserDepartment Create(Guid userId, Guid departmentId, bool isPrimary = false)
        => new()
        {
            UserId = userId,
            DepartmentId = departmentId,
            IsPrimary = isPrimary
        };

    public void MarkPrimary() => IsPrimary = true;
    public void ClearPrimary() => IsPrimary = false;
}
