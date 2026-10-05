namespace PMWDS.Domain.Common;

public abstract class BaseEntity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();
    public DateTime CreatedDate { get; protected set; } = DateTime.UtcNow;
    public DateTime? ModifiedDate { get; protected set; }
    public string CreatedBy { get; protected set; } = string.Empty;
    public string? ModifiedBy { get; protected set; }
    public bool IsDeleted { get; protected set; } = false;
    public int RowVersion { get; protected set; } = 1;
    public void SetCreatedBy(string userId) => CreatedBy = userId;
    public void SetModified(string userId)
    {
        ModifiedDate = DateTime.UtcNow;
        ModifiedBy = userId;
        RowVersion++;
    }
    public void SoftDelete(string userId)
    {
        IsDeleted = true;
        SetModified(userId);
    }
}
