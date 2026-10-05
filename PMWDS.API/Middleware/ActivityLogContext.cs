namespace PMWDS.API.Middleware;

public record ActivityLogContext(
    string ActivityType,
    string Description,
    Dictionary<string, object> Metadata,
    Guid? ProjectId = null);
