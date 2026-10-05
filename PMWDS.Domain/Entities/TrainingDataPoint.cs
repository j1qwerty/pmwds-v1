using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class TrainingDataPoint : AuditableEntity
{
    public string DataType { get; private set; } = string.Empty;
    public string FeaturesJson { get; private set; } = "{}";
    public string LabelsJson { get; private set; } = "{}";
    public string Source { get; private set; } = string.Empty;

    protected TrainingDataPoint() { }

    public static TrainingDataPoint Create(
        string dataType,
        IDictionary<string, object?>? features,
        IDictionary<string, object?>? labels,
        string source)
    {
        return new TrainingDataPoint
        {
            DataType = dataType.Trim(),
            FeaturesJson = JsonSerializer.Serialize(features ?? new Dictionary<string, object?>()),
            LabelsJson = JsonSerializer.Serialize(labels ?? new Dictionary<string, object?>()),
            Source = source.Trim()
        };
    }

    public void Update(
        string dataType,
        IDictionary<string, object?>? features,
        IDictionary<string, object?>? labels,
        string source)
    {
        DataType = dataType.Trim();
        FeaturesJson = JsonSerializer.Serialize(features ?? new Dictionary<string, object?>());
        LabelsJson = JsonSerializer.Serialize(labels ?? new Dictionary<string, object?>());
        Source = source.Trim();
    }
}
