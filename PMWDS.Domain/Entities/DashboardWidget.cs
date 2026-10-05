using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class DashboardWidget : AuditableEntity
{
    public Guid DashboardId { get; private set; }
    public string WidgetType { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string ConfigurationJson { get; private set; } = "{}";
    public int RefreshInterval { get; private set; }
    public DateTime LastRefreshed { get; private set; } = DateTime.UtcNow;
    public string RequiredPermissionsJson { get; private set; } = "[]";
    public int DisplayOrder { get; private set; }

    public Dashboard? Dashboard { get; private set; }

    protected DashboardWidget() { }

    public static DashboardWidget Create(
        Guid dashboardId,
        string widgetType,
        string title,
        object? configuration,
        int refreshInterval,
        IEnumerable<string>? requiredPermissions,
        int displayOrder)
    {
        return new DashboardWidget
        {
            DashboardId = dashboardId,
            WidgetType = widgetType.Trim(),
            Title = title.Trim(),
            ConfigurationJson = JsonSerializer.Serialize(configuration ?? new Dictionary<string, object>()),
            RefreshInterval = refreshInterval,
            RequiredPermissionsJson = JsonSerializer.Serialize(requiredPermissions ?? Enumerable.Empty<string>()),
            DisplayOrder = displayOrder,
            LastRefreshed = DateTime.UtcNow
        };
    }

    public void Update(
        string widgetType,
        string title,
        object? configuration,
        int refreshInterval,
        IEnumerable<string>? requiredPermissions)
    {
        WidgetType = widgetType.Trim();
        Title = title.Trim();
        ConfigurationJson = JsonSerializer.Serialize(configuration ?? new Dictionary<string, object>());
        RefreshInterval = refreshInterval;
        RequiredPermissionsJson = JsonSerializer.Serialize(requiredPermissions ?? Enumerable.Empty<string>());
        LastRefreshed = DateTime.UtcNow;
    }

    public void SetDisplayOrder(int displayOrder)
    {
        DisplayOrder = displayOrder;
    }
}
