using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Services;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

public sealed class DocumentArchiveController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public DocumentArchiveController(
        IMediator mediator,
        ApplicationDbContext db,
        ICurrentUserService currentUser) : base(mediator)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet("settings")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var setting = await _db.AIGlobalSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        return Ok(new { retentionDays = setting?.DocumentArchiveRetentionDays ?? 30 });
    }

    [HttpPut("settings")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> UpdateSettings(
        [FromBody] UpdateDocumentArchiveSettingsDto dto,
        CancellationToken ct)
    {
        if (dto.RetentionDays < 1)
            return BadRequest(new { message = "Archive retention must be at least one day." });

        var setting = await _db.AIGlobalSettings.FirstOrDefaultAsync(ct);
        if (setting == null)
        {
            setting = new AIGlobalSetting { DocumentArchiveRetentionDays = dto.RetentionDays };
            setting.SetCreatedBy(_currentUser.UserId ?? "system");
            await _db.AIGlobalSettings.AddAsync(setting, ct);
        }
        else
        {
            setting.DocumentArchiveRetentionDays = dto.RetentionDays;
            setting.SetModified(_currentUser.UserId ?? "system");
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { retentionDays = setting.DocumentArchiveRetentionDays });
    }
}

public sealed record UpdateDocumentArchiveSettingsDto(int RetentionDays);
