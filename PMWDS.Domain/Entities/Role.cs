using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class Role : AuditableEntity
{
    public string Key { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public int PermissionLevel { get; private set; }
    public int PaginationPageSize { get; private set; } = 10;
    public ICollection<Permission> Permissions { get; private set; } = new List<Permission>();
    public ICollection<ApplicationUser> Users { get; private set; } = new List<ApplicationUser>();

    protected Role() { }

    public static Role Create(string name, string description, int permissionLevel)
        => Create(CreateCustomKey(name), name, description, permissionLevel);

    public static Role Create(string key, string name, string description, int permissionLevel)
    {
        return new Role
        {
            Key = NormalizeKey(key),
            Name = name.Trim(),
            Description = description.Trim(),
            PermissionLevel = permissionLevel
        };
    }

    public void Update(string name, string description, int permissionLevel)
    {
        Name = name.Trim();
        Description = description.Trim();
        PermissionLevel = permissionLevel;
    }

    public void EnsureKey(string key)
    {
        if (string.IsNullOrWhiteSpace(Key))
        {
            Key = NormalizeKey(key);
        }
    }

    public void UpdatePaginationPageSize(int pageSize)
        => PaginationPageSize = Math.Clamp(pageSize, 1, 500);

    public void AddPermission(Permission permission)
    {
        if (Permissions.All(p => p.Id != permission.Id))
        {
            Permissions.Add(permission);
        }
    }

    public void RemovePermission(Guid permissionId)
    {
        var permission = Permissions.FirstOrDefault(p => p.Id == permissionId);
        if (permission != null)
        {
            Permissions.Remove(permission);
        }
    }

    public bool CheckPermission(string permissionCode)
        => Permissions.Any(p => p.Code.Equals(permissionCode, StringComparison.OrdinalIgnoreCase));

    public Role Clone()
    {
        var clone = Create($"{Name} Copy", Description, PermissionLevel);
        foreach (var permission in Permissions)
        {
            clone.AddPermission(permission);
        }

        return clone;
    }

    private static string NormalizeKey(string key)
        => key.Trim().ToLowerInvariant();

    private static string CreateCustomKey(string name)
    {
        var slug = new string(name
            .Trim()
            .ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '-')
            .ToArray());

        slug = string.Join('-', slug.Split('-', StringSplitOptions.RemoveEmptyEntries));
        slug = string.IsNullOrWhiteSpace(slug) ? "role" : slug[..Math.Min(slug.Length, 24)];
        return $"custom-{slug}-{Guid.NewGuid():N}";
    }
}
