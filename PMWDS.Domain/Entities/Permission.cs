using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class Permission : AuditableEntity
{
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Module { get; private set; } = string.Empty;
    public bool IsGlobal { get; private set; }
    public ICollection<Role> Roles { get; private set; } = new List<Role>();

    protected Permission() { }

    public static Permission Create(
        string code,
        string name,
        string description,
        string module,
        bool isGlobal = false)
    {
        return new Permission
        {
            Code = code.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            Description = description.Trim(),
            Module = module.Trim(),
            IsGlobal = isGlobal
        };
    }

    public void Update(
        string name,
        string description,
        string module,
        bool isGlobal)
    {
        Name = name.Trim();
        Description = description.Trim();
        Module = module.Trim();
        IsGlobal = isGlobal;
    }

    public bool Validate()
        => !string.IsNullOrWhiteSpace(Code)
           && !string.IsNullOrWhiteSpace(Name)
           && !string.IsNullOrWhiteSpace(Module);
}
