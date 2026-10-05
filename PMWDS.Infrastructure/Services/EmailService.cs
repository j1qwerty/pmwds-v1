using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using PMWDS.Application.Interfaces.Services;
using Microsoft.Extensions.Options;
using PMWDS.Infrastructure.Settings;
namespace PMWDS.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly EmailSettings _settings;
    public EmailService(IOptions<EmailSettings> settings)
    => _settings = settings.Value;
    public async Task SendEmailAsync(
    string to, string subject,
    string body,
    CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(
        _settings.SenderName, _settings.SenderEmail));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = body };
        using var client = new SmtpClient();
        await client.ConnectAsync(
        _settings.Host, _settings.Port,
        GetSocketOptions(), ct);
        if (!string.IsNullOrWhiteSpace(_settings.Username))
        {
            await client.AuthenticateAsync(
            _settings.Username, _settings.Password, ct);
        }
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
    public async Task SendEmailWithAttachmentAsync(
        string to,
        string subject,
        string body,
        byte[] attachment,
        string fileName,
        CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(
            _settings.SenderName, _settings.SenderEmail));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        var builder = new BodyBuilder
        {
            HtmlBody = body
        };
        builder.Attachments.Add(fileName, attachment);
        message.Body = builder.ToMessageBody();
        using var client = new SmtpClient();
        await client.ConnectAsync(
            _settings.Host, _settings.Port,
            GetSocketOptions(), ct);
        if (!string.IsNullOrWhiteSpace(_settings.Username))
        {
            await client.AuthenticateAsync(
                _settings.Username, _settings.Password, ct);
        }
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }

    private SecureSocketOptions GetSocketOptions()
        => _settings.UseSsl
            ? SecureSocketOptions.StartTlsWhenAvailable
            : SecureSocketOptions.Auto;
}
