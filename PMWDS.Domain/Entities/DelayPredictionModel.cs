namespace PMWDS.Domain.Entities;

public class DelayPredictionModel : AIModel
{
    protected DelayPredictionModel() { }

    public static DelayPredictionModel Create(
        string name,
        string version,
        string? modelPath = null,
        IDictionary<string, double>? hyperparameters = null,
        IEnumerable<string>? features = null)
    {
        var model = new DelayPredictionModel();
        model.Initialize(name, version, "DelayPrediction", modelPath, hyperparameters, features);
        return model;
    }
}
