using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PMWDS.API.Services;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;

namespace PMWDS.API.Controllers;

[ApiController]
[Route("api/v1/skills")]
public class SkillsController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly RoleScopeService _scope;

    public SkillsController(
        IMediator mediator,
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        RoleScopeService scope) : base(mediator)
    {
        _uow = uow;
        _currentUser = currentUser;
        _scope = scope;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var skills = await GetScopedSkillsAsync(ct);
        return Ok(skills.Select(SkillDto.FromEntity));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var skill = await _uow.Skills.GetByIdAsync(id, ct);
        if (skill == null)
        {
            return NotFound();
        }

        return await CanAccessSkillAsync(skill, ct)
            ? Ok(SkillDto.FromEntity(skill))
            : Forbid();
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> Create(
        [FromBody] CreateSkillDto dto,
        CancellationToken ct)
    {
        var organizationId = await ResolveWriteOrganizationIdAsync(dto.OrganizationId, ct);
        if (!_scope.IsSuperAdmin && !organizationId.HasValue)
        {
            return Forbid();
        }

        var existing = await _uow.Skills.FindAsync(
            s => s.Name.ToLower() == dto.Name.ToLower().Trim() &&
                 s.OrganizationId == organizationId,
            ct);
        if (existing.Any())
        {
            return Conflict(new { message = $"Skill '{dto.Name}' already exists." });
        }

        var skill = Skill.Create(dto.Name, dto.Category, dto.Description);
        skill.AssignToOrganization(organizationId);
        skill.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.Skills.AddAsync(skill, ct);
        await _uow.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = skill.Id }, SkillDto.FromEntity(skill));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateSkillDto dto,
        CancellationToken ct)
    {
        var skill = await _uow.Skills.GetByIdAsync(id, ct);
        if (skill == null)
        {
            return NotFound();
        }

        if (!await CanManageSkillAsync(skill, ct))
        {
            return Forbid();
        }

        var existingName = await _uow.Skills.FindAsync(
            s => s.Name.ToLower() == dto.Name.ToLower().Trim() &&
                 s.Id != id &&
                 s.OrganizationId == skill.OrganizationId,
            ct);
        if (existingName.Any())
        {
            return Conflict(new { message = $"Skill '{dto.Name}' already exists." });
        }

        skill.Update(dto.Name, dto.Category, dto.Description);
        skill.SetModified(_currentUser.UserId ?? "system");
        await _uow.Skills.UpdateAsync(skill, ct);
        await _uow.SaveChangesAsync(ct);
        return Ok(SkillDto.FromEntity(skill));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Director)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var skill = await _uow.Skills.GetByIdAsync(id, ct);
        if (skill == null)
        {
            return NotFound();
        }

        if (!await CanDeleteSkillAsync(skill, ct))
        {
            return Forbid();
        }

        await _uow.Skills.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<Guid?> ResolveWriteOrganizationIdAsync(Guid? requestedOrganizationId, CancellationToken ct)
    {
        if (_scope.IsSuperAdmin)
        {
            return requestedOrganizationId;
        }

        var organizationIds = await _scope.GetOrganizationIdsAsync(ct);
        if (requestedOrganizationId.HasValue)
        {
            return organizationIds.Contains(requestedOrganizationId.Value)
                ? requestedOrganizationId
                : null;
        }

        return organizationIds.Count > 0 ? organizationIds.First() : null;
    }

    private async Task<IEnumerable<Skill>> GetScopedSkillsAsync(CancellationToken ct)
    {
        if (_scope.IsSuperAdmin)
        {
            return await _uow.Skills.GetAllAsync(ct);
        }

        var organizationIds = await _scope.GetOrganizationIdsAsync(ct);
        return await _uow.Skills.FindAsync(
            skill => !skill.OrganizationId.HasValue ||
                     organizationIds.Contains(skill.OrganizationId.Value),
            ct);
    }

    private async Task<bool> CanAccessSkillAsync(Skill skill, CancellationToken ct)
    {
        if (_scope.IsSuperAdmin || !skill.OrganizationId.HasValue)
        {
            return true;
        }

        var organizationIds = await _scope.GetOrganizationIdsAsync(ct);
        return organizationIds.Contains(skill.OrganizationId.Value);
    }

    private async Task<bool> CanManageSkillAsync(Skill skill, CancellationToken ct)
    {
        if (_scope.IsSuperAdmin || skill.CreatedBy == _currentUser.UserId)
        {
            return true;
        }

        return skill.OrganizationId.HasValue &&
            await _scope.CanAccessOrganizationAsync(skill.OrganizationId.Value, ct);
    }

    private async Task<bool> CanDeleteSkillAsync(Skill skill, CancellationToken ct)
    {
        if (_scope.IsSuperAdmin || skill.CreatedBy == _currentUser.UserId)
        {
            return true;
        }

        return _scope.IsDirector &&
            skill.OrganizationId.HasValue &&
            await _scope.CanAccessOrganizationAsync(skill.OrganizationId.Value, ct);
    }
}
