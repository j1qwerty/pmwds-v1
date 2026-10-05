using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class Report : AuditableEntity
{
    public string Name { get; private set; } = string.Empty;
    public string ReportType { get; private set; } = string.Empty;
    public string ParametersJson { get; private set; } = "{}";
    public DateTime GeneratedDate { get; private set; } = DateTime.UtcNow;
    public string Format { get; private set; } = string.Empty;
    public byte[] Data { get; private set; } = Array.Empty<byte>();
    public Guid GeneratedByUserId { get; private set; }

    protected Report() { }

    public static Report Create(
        string name,
        string reportType,
        object? parameters,
        string format,
        byte[] data,
        Guid generatedByUserId)
    {
        return new Report
        {
            Name = name.Trim(),
            ReportType = reportType.Trim(),
            ParametersJson = JsonSerializer.Serialize(parameters ?? new Dictionary<string, object>()),
            GeneratedDate = DateTime.UtcNow,
            Format = format.Trim(),
            Data = data,
            GeneratedByUserId = generatedByUserId
        };
    }

    public void UpdateMetadata(string name, string reportType, object? parameters, string format)
    {
        Name = name.Trim();
        ReportType = reportType.Trim();
        ParametersJson = JsonSerializer.Serialize(parameters ?? new Dictionary<string, object>());
        Format = format.Trim();
    }

    public void ReplaceData(byte[] data)
    {
        Data = data;
        GeneratedDate = DateTime.UtcNow;
    }
}
