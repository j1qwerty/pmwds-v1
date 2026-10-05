using PMWDS.Domain.Common;
namespace PMWDS.Domain.Entities;

public class Department : AuditableEntity
{
    public string Name { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public Guid? OrganizationId { get; private set; }
    public Guid? ParentDepartmentId { get; private set; }
    public string? DepartmentHeadUserId { get; private set; }
    public int MaxCapacity { get; private set; }
    // Navigation
    public Organization? Organization { get; private set; }
    public Department? ParentDepartment { get; private set; }
    public IReadOnlyCollection<Department> SubDepartments =>
    _subDepartments.AsReadOnly();
    public IReadOnlyCollection<ApplicationUser> Members =>
    _members.AsReadOnly();
    public IReadOnlyCollection<Project> Projects =>
    _projects.AsReadOnly();
    public IReadOnlyCollection<ProjectDepartment> ProjectDepartments =>
    _projectDepartments.AsReadOnly();
    private readonly List<Department> _subDepartments = new();
    private readonly List<ApplicationUser> _members = new();
    private readonly List<Project> _projects = new();
    private readonly List<ProjectDepartment> _projectDepartments = new();
    protected Department() { }
    public static Department Create(
    string name,
    string code,
    string? description = null,
    Guid? parentId = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Department name required.");
        return new Department
        {
            Name = name,
            Code = code.ToUpper(),
            Description = description,
            ParentDepartmentId = parentId
        };
    }
    public void AssignHead(string? userId)
    => DepartmentHeadUserId = userId;
    public void AssignToOrganization(Guid? organizationId)
    => OrganizationId = organizationId;
    public void Update(
    string name,
    string code,
    string? description)
    {
        Name = name;
        Code = code.ToUpper();
        Description = description;
    }
    public void SetMaxCapacity(int capacity)
    => MaxCapacity = capacity;
    public double CalculateCapacityUtilization()
    {
        if (MaxCapacity == 0) return 0;
        return (double)_members.Count / MaxCapacity * 100;
    }
}
