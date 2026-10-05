namespace PMWDS.Application.Interfaces.Services;
public interface IEmailService
{
 Task SendEmailAsync(
 string to,
 string subject,
 string body,
 CancellationToken ct = default);
 Task SendEmailWithAttachmentAsync(
 string to,
 string subject,
 string body,
 byte[] attachment,
 string fileName,
 CancellationToken ct = default);
}
