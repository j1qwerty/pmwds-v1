using Microsoft.Extensions.Logging;
using PMWDS.Application.Interfaces.Services;

namespace PMWDS.Infrastructure.Jobs;

public interface IAIModelTrainingJob
{
    Task ExecuteAsync(CancellationToken ct);
}

public class AIModelTrainingJob : IAIModelTrainingJob
{
    private readonly IModelManagementService _ai;
    private readonly ILogger<AIModelTrainingJob> _logger;

    public AIModelTrainingJob(
        IModelManagementService ai,
        ILogger<AIModelTrainingJob> logger)
    {
        _ai = ai;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation(
            "AI model training started at {Time}",
            DateTime.UtcNow);

        try
        {
            await _ai.TrainModelsAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI model training failed.");
        }
    }
}
