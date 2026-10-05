using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class Organization : AuditableEntity
{
    public string Name { get; private set; } = string.Empty;
    public string TaxId { get; private set; } = string.Empty;
    public string Address { get; private set; } = string.Empty;
    public string ContactEmail { get; private set; } = string.Empty;
    public string ContactPhone { get; private set; } = string.Empty;
    public DateTime FoundedDate { get; private set; }
    public ICollection<Department> Departments { get; private set; } = new List<Department>();

    protected Organization() { }

    public static Organization Create(
        string name,
        string? taxId = null,
        string? address = null,
        string? contactEmail = null,
        string? contactPhone = null,
        DateTime? foundedDate = null)
    {
        return new Organization
        {
            Name = name.Trim(),
            TaxId = (taxId ?? "").Trim(),
            Address = (address ?? "").Trim(),
            ContactEmail = (contactEmail ?? "").Trim(),
            ContactPhone = (contactPhone ?? "").Trim(),
            FoundedDate = foundedDate ?? default
        };
    }

    public void Update(
        string name,
        string? taxId = null,
        string? address = null,
        string? contactEmail = null,
        string? contactPhone = null,
        DateTime? foundedDate = null)
    {
        Name = name.Trim();
        TaxId = (taxId ?? "").Trim();
        Address = (address ?? "").Trim();
        ContactEmail = (contactEmail ?? "").Trim();
        ContactPhone = (contactPhone ?? "").Trim();
        FoundedDate = foundedDate ?? default;
    }

    public void AddDepartment(Department department)
    {
        if (Departments.All(d => d.Id != department.Id))
        {
            Departments.Add(department);
            department.AssignToOrganization(Id);
        }
    }

    public bool RemoveDepartment(Guid departmentId)
    {
        var department = Departments.FirstOrDefault(d => d.Id == departmentId);
        if (department == null)
        {
            return false;
        }

        Departments.Remove(department);
        department.AssignToOrganization(null);
        return true;
    }

    public IReadOnlyCollection<Department> GetOrganizationHierarchy()
        => Departments.ToList().AsReadOnly();

    public int GetTotalEmployees()
        => Departments.Sum(d => d.Members.Count);
}
