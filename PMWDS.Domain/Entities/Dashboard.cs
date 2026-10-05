using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class Dashboard : AuditableEntity
{
    public Guid UserId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string LayoutType { get; private set; } = string.Empty;
    public bool IsDefault { get; private set; }
    public DateTime LastAccessed { get; private set; } = DateTime.UtcNow;
    public ICollection<DashboardWidget> Widgets { get; private set; } = new List<DashboardWidget>();

    protected Dashboard() { }

    public static Dashboard Create(Guid userId, string name, string layoutType, bool isDefault)
    {
        return new Dashboard
        {
            UserId = userId,
            Name = name.Trim(),
            LayoutType = layoutType.Trim(),
            IsDefault = isDefault,
            LastAccessed = DateTime.UtcNow
        };
    }

    public void Update(string name, string layoutType, bool isDefault)
    {
        Name = name.Trim();
        LayoutType = layoutType.Trim();
        IsDefault = isDefault;
        LastAccessed = DateTime.UtcNow;
    }

    public void AddWidget(DashboardWidget widget)
    {
        if (Widgets.All(w => w.Id != widget.Id))
        {
            Widgets.Add(widget);
        }
    }

    public void RemoveWidget(Guid widgetId)
    {
        var widget = Widgets.FirstOrDefault(w => w.Id == widgetId);
        if (widget != null)
        {
            Widgets.Remove(widget);
        }
    }

    public void ReorderWidgets(IEnumerable<Guid> order)
    {
        var positions = order.Select((id, index) => new { id, index }).ToDictionary(x => x.id, x => x.index);
        foreach (var widget in Widgets)
        {
            if (positions.TryGetValue(widget.Id, out var index))
            {
                widget.SetDisplayOrder(index);
            }
        }
    }
}
