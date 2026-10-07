using PMWDS.Application.DTOs.AI;

namespace PMWDS.Application.Interfaces.Services;

public interface IChatService
{
    Task<string> GenerateNaturalLanguageSummaryAsync(string context, CancellationToken ct = default);
    Task<ChatResponseDto> ProcessChatMessageAsync(
        string userId,
        string message,
        string contextDossier,
        string? provider = null,
        string? model = null,
        CancellationToken ct = default);
}
