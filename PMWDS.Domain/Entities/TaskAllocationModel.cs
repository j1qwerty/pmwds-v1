namespace PMWDS.Domain.Entities;

public class TaskAllocationModel : AIModel
{
    protected TaskAllocationModel() { }

    public static TaskAllocationModel Create(
        string name,
        string version,
        string? modelPath = null,
        IDictionary<string, double>? hyperparameters = null,
        IEnumerable<string>? features = null)
    {
        var model = new TaskAllocationModel();
        model.Initialize(name, version, "TaskAllocation", modelPath, hyperparameters, features);
        return model;
    }
}
