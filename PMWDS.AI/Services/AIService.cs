using Microsoft.Extensions.Options;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Infrastructure.Settings;

namespace PMWDS.AI.Services;

public partial class AIService :
    IRecommendationService,
    IPredictionService,
    IProjectHealthService,
    IModelManagementService,
    IChatService
{
    private const string TaskAllocationModelType = "TaskAllocation";
    private const string DelayPredictionModelType = "DelayPrediction";

    private readonly IUnitOfWork _uow;
    private readonly ITaskAllocationEngine _allocation;
    private readonly IDelayPredictionEngine _delay;
    private readonly IChatEngine _chat;
    private readonly AISettings _settings;

    public AIService(
        IUnitOfWork uow,
        ITaskAllocationEngine allocation,
        IDelayPredictionEngine delay,
        IChatEngine chat,
        IOptions<AISettings> settings)
    {
        _uow = uow;
        _allocation = allocation;
        _delay = delay;
        _chat = chat;
        _settings = settings.Value;
    }
}
