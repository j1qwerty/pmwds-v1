using Microsoft.Extensions.Logging;
using PMWDS.Application.Interfaces.Services;
namespace PMWDS.Infrastructure.Jobs;

public interface IScheduledReportJob
{
    Task ExecuteAsync(CancellationToken ct);
}
public class ScheduledReportJob : IScheduledReportJob
{
    private readonly IUnitOfWork _uow;
    private readonly IReportService _reports;
    private readonly IEmailService _email;
    private readonly ILogger<ScheduledReportJob> _logger;
    public ScheduledReportJob(
    IUnitOfWork uow,
    IReportService reports,
    IEmailService email,
    ILogger<ScheduledReportJob> logger)
    {
        _uow = uow;
        _reports = reports;
        _email = email;
        _logger = logger;
    }
    public async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation(
        "ScheduledReportJob started at {Time}",
        DateTime.UtcNow);
        var managers = await _uow.Users
        .GetUsersByRoleAsync("ProjectManager", ct);
        foreach (var manager in managers)
        {
            try
            {
                var projects = await _uow.Projects
                .GetByManagerAsync(manager.Id, ct);
                foreach (var project in projects)
                {
                    var reportBytes = await _reports


                    .DownloadProjectStatusReportAsync(
                    project.Id, "pdf", ct);
                    await _email.SendEmailWithAttachmentAsync(
                    manager.Email!,
                   $"Weekly Status Report — " +
                    $"{project.Name}",
                    $"<p>Dear {manager.FirstName},</p>" +
                    $"<p>Please find attached the " +
                    $"weekly status report for " +
                    $"<strong>{project.Name}</strong>." +
                    $"</p>",
                   reportBytes,
                   $"{project.ProjectCode}_" +
                    $"weekly_report.pdf",
                   ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                "Failed to send weekly report " +
                "for manager {ManagerId}",
                manager.Id);
            }
        }
        _logger.LogInformation(
        "ScheduledReportJob completed.");
    }
}
