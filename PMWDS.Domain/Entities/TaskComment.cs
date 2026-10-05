using PMWDS.Domain.Common;
namespace PMWDS.Domain.Entities;

public class TaskComment : BaseEntity
{
    public Guid TaskId { get; private set; }
    public Guid? UserId { get; private set; }
    public string Content { get; private set; } = string.Empty;
    public bool IsSystemGenerated { get; private set; }
    public Guid? ParentCommentId { get; private set; }
    protected TaskComment() { }
    public static TaskComment Create(
    Guid taskId, Guid? userId,
    string content, bool isSystem = false,
    Guid? parentId = null)
    {
        return new TaskComment
        {
            TaskId = taskId,
            UserId = userId,
            Content = content,
            IsSystemGenerated = isSystem,
            ParentCommentId = parentId
        };
    }
    public void Edit(string newContent)
    => Content = newContent;
}
