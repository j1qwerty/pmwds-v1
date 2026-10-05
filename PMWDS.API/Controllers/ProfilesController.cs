using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PMWDS.API.Services;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;

namespace PMWDS.API.Controllers;

public class ProfilesController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly RoleScopeService _scope;

    public ProfilesController(
        IMediator mediator,
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        RoleScopeService scope) : base(mediator)
    {
        _uow = uow;
        _currentUser = currentUser;
        _scope = scope;
    }

    [HttpGet("{userId:guid}")]
    public async Task<IActionResult> Get(Guid userId, CancellationToken ct)
    {
        if (!await _scope.CanAccessUserAsync(userId, ct))
        {
            return Forbid();
        }

        var profile = (await _uow.UserProfiles.FindAsync(p => p.UserId == userId, ct)).FirstOrDefault();
        return profile == null ? NotFound() : Ok(MapProfile(profile));
    }

    [HttpPut("{userId:guid}")]
    public async Task<IActionResult> Upsert(Guid userId, [FromBody] UpsertProfileRequest req, CancellationToken ct)
    {
        if (!await _scope.CanManageUserAsync(userId, ct))
        {
            return Forbid();
        }

        var user = await _uow.Users.GetByIdAsync(userId, ct);
        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        var profile = (await _uow.UserProfiles.FindAsync(p => p.UserId == userId, ct)).FirstOrDefault();
        if (profile == null)
        {
            profile = UserProfile.Create(userId, req.Bio, req.JobTitle, req.DateOfBirth, req.Address, req.EmergencyContact, req.LinkedInUrl);
            profile.SetCreatedBy(_currentUser.UserId ?? "system");
            await _uow.UserProfiles.AddAsync(profile, ct);
        }
        else
        {
            profile.UpdateProfileDetails(req.Bio, req.JobTitle, req.DateOfBirth, req.Address, req.EmergencyContact, req.LinkedInUrl);
            profile.SetModified(_currentUser.UserId ?? "system");
            await _uow.UserProfiles.UpdateAsync(profile, ct);
        }

        await _uow.SaveChangesAsync(ct);
        return Ok(MapProfile(profile));
    }

    private static UserProfileResponse MapProfile(UserProfile profile)
        => new(
            profile.Id,
            profile.UserId,
            profile.Bio,
            profile.JobTitle,
            profile.DateOfBirth,
            profile.Address,
            profile.EmergencyContact,
            profile.LinkedInUrl);
}
