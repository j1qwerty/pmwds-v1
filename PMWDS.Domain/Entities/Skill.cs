using PMWDS.Domain.Common;
namespace PMWDS.Domain.Entities;

public class Skill : AuditableEntity
{
    public string Name { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string? ParentSkillId { get; private set; }
    public Guid? OrganizationId { get; private set; }
    public Organization? Organization { get; private set; }
    public IReadOnlyCollection<UserSkill> UserSkills =>
    _userSkills.AsReadOnly();
    private readonly List<UserSkill> _userSkills = new();
    protected Skill() { }
    public static Skill Create(
    string name, string category,
     string description,
    string? parentSkillId = null)
    {
        return new Skill
        {
            Name = name,
            Category = category,
            Description = description,
            ParentSkillId = parentSkillId
        };
    }

    public void AssignToOrganization(Guid? organizationId)
    {
        OrganizationId = organizationId;
    }

    public void Update(string name, string category, string description)
    {
        Name = name;
        Category = category;
        Description = description;
    }
}
