using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class AIGlobalSetting : BaseEntity
{
    public string DefaultProvider { get; set; } = "OpenRouter";
    public string DefaultModel { get; set; } = "";
    public double RiskThreshold { get; set; } = 0.7;
    public bool UseLocalModel { get; set; } = false;
    public string MLModelPath { get; set; } = "";
}
