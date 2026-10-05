namespace PMWDS.Domain.Common;

public abstract class AuditableEntity : BaseEntity
{
    public string? Notes { get; protected set; }
    public string? Tags { get; protected set; }
    public bool IsActive { get; protected set; } = true;
    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
    public void SetNotes(string notes) => Notes = notes;
    public void SetTags(string tags) => Tags = tags;
}