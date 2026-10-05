using Hangfire;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Infrastructure.Jobs;
namespace PMWDS.Infrastructure.Services;

public interface IBackgroundJobService
{
   void EnqueueTaskDeadlineCheck();
   void EnqueueAIModelTraining();
   void EnqueueScheduledReports();
   void EnqueueEscalationCheck();
   void ScheduleRecurring(
   string jobId, string cronExpression,
   Action job);
}
public class HangfireBackgroundJobService : IBackgroundJobService
{
   private readonly IRecurringJobManager _recurringJobs;
   private readonly IBackgroundJobClient _backgroundJobs;
   public HangfireBackgroundJobService(
   IRecurringJobManager recurringJobs,
   IBackgroundJobClient backgroundJobs)
   {
      _recurringJobs = recurringJobs;
      _backgroundJobs = backgroundJobs;
   }
   public void EnqueueTaskDeadlineCheck()
   => _backgroundJobs
   .Enqueue<IDeadlineCheckerJob>(
   j => j.ExecuteAsync(
   CancellationToken.None));
   public void EnqueueAIModelTraining()
   => _backgroundJobs
   .Enqueue<IAIModelTrainingJob>(
   j => j.ExecuteAsync(
   CancellationToken.None));
   public void EnqueueScheduledReports()
   => _backgroundJobs
   .Enqueue<IScheduledReportJob>(
   j => j.ExecuteAsync(
   CancellationToken.None));
   public void EnqueueEscalationCheck()
   => _backgroundJobs
   .Enqueue<IEscalationCheckerJob>(

      j => j.ExecuteAsync(
   CancellationToken.None));
   public void ScheduleRecurring(
   string jobId,
   string cronExpression,
   Action job)
   => _recurringJobs.AddOrUpdate(
   jobId, () => job(), cronExpression);
}
