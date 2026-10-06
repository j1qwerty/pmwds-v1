using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Middleware;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Common;
using PMWDS.Application.DTOs.Users;
using PMWDS.Application.Features.Users.Queries;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Infrastructure.Services;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

public class UsersController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly ApplicationDbContext _db;
    private readonly ILocalFileStorageService _localFiles;
    private readonly RoleScopeService _scope;
    private readonly IDataChangeNotifier _changes;

    public UsersController(
        IMediator mediator,
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        ApplicationDbContext db,
        ILocalFileStorageService localFiles,
        RoleScopeService scope,
        IDataChangeNotifier changes) : base(mediator)
    {
        _uow = uow;
        _currentUser = currentUser;
        _db = db;
        _localFiles = localFiles;
        _scope = scope;
        _changes = changes;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? departmentId,
        [FromQuery] PaginationQuery pagination,
        CancellationToken ct)
    {
        if (departmentId.HasValue && !await _scope.CanAccessDepartmentAsync(departmentId.Value, ct))
        {
            return Forbid();
        }

        var query = _db.Users.AsNoTracking();

        if (departmentId.HasValue)
        {
            query = query.Where(u =>
                u.DepartmentId == departmentId.Value ||
                u.DepartmentAssignments.Any(assignment => assignment.DepartmentId == departmentId.Value));
        }

        query = await _scope.ScopeUsersAsync(query, ct);

        var totalCount = await query.CountAsync(ct);
        var rows = await query
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .Select(u => new
            {
                u.Id,
                u.FirstName,
                u.LastName,
                u.Email,
                u.ProfilePictureUrl,
                JobTitle = u.Profile != null ? (u.Profile.JobTitle ?? u.JobTitle) : u.JobTitle,
                u.OrganizationId,
                DepartmentName = u.Department != null ? u.Department.Name : null,
                u.DepartmentId,
                ProfileId = u.Profile != null ? u.Profile.Id : (Guid?)null,
                Bio = u.Profile != null ? u.Profile.Bio : null,
                u.AvailabilityStatus,
                u.AvailabilityPercentage,
                u.AIWorkloadScore,
                u.AIBurnoutRiskScore,
                u.AIPerformanceScore,
                ActiveTaskCount = u.TaskAssignments.Count(assignment =>
                    assignment.Task != null &&
                    assignment.Task.Status == PMWDS.Domain.Enums.TaskStatus.InProgress),
                u.IsActive
            })
            .ToListAsync(ct);

        var userIds = rows.Select(row => row.Id).ToList();

        // Project the roles collection inline rather than flattening it with a collection-
        // correlated SelectMany. The SelectMany form made EF emit SQL Server's APPLY, which
        // SQLite cannot generate, so the whole users list returned 500 whenever the application
        // ran on its SQLite fallback. A collection inside the projection compiles to an
        // aggregating subquery (STRING_AGG / GROUP_CONCAT), which every provider translates.
        var userRoleRows = await _db.Users
            .AsNoTracking()
            .Where(user => userIds.Contains(user.Id))
            .Select(user => new
            {
                UserId = user.Id,
                Names = user.Roles.Select(role => role.Name).ToList(),
                Keys = user.Roles.Select(role => role.Key).ToList()
            })
            .ToListAsync(ct);

        var roleRows = userRoleRows
            .SelectMany(row => row.Names
                .Select((name, index) => new { row.UserId, Name = name, Key = row.Keys[index] }))
            .ToList();

        var departmentRows = await _db.UserDepartments
            .AsNoTracking()
            .Where(assignment => userIds.Contains(assignment.UserId))
            .Select(assignment => new
            {
                assignment.UserId,
                assignment.DepartmentId,
                DepartmentName = assignment.Department.Name,
                DepartmentCode = assignment.Department.Code,
                OrganizationId = assignment.Department.OrganizationId,
                OrganizationName = assignment.Department.Organization != null
                    ? assignment.Department.Organization.Name
                    : null,
                assignment.IsPrimary
            })
            .ToListAsync(ct);

        var skillRows = await _db.UserSkills
            .AsNoTracking()
            .Where(skill => userIds.Contains(skill.UserId))
            .Select(skill => new
            {
                skill.UserId,
                skill.SkillId,
                SkillName = skill.Skill != null ? skill.Skill.Name : "",
                skill.ProficiencyLevel,
                skill.ExperienceMonths,
                skill.LastUsed
            })
            .ToListAsync(ct);

        var rolesByUser = roleRows
            .GroupBy(row => row.UserId)
            .ToDictionary(
                group => group.Key,
                group => group.ToList());

        var departmentsByUser = departmentRows
            .GroupBy(row => row.UserId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(row => new UserDepartmentDto(
                    row.DepartmentId,
                    row.DepartmentName,
                    row.DepartmentCode,
                    row.OrganizationId,
                    row.OrganizationName,
                    row.IsPrimary)).ToList());

        var skillsByUser = skillRows
            .GroupBy(row => row.UserId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(row => new UserSkillDto(
                    row.SkillId,
                    row.SkillName,
                    row.ProficiencyLevel,
                    row.ExperienceMonths,
                    row.LastUsed)).ToList());

        var items = rows.Select(row =>
        {
            var roles = rolesByUser.GetValueOrDefault(row.Id) ?? [];
            return new UserDto(
                Id: row.Id.ToString(),
                FirstName: row.FirstName,
                LastName: row.LastName,
                FullName: row.FirstName + " " + row.LastName,
                Email: row.Email,
                ProfilePictureUrl: row.ProfilePictureUrl,
                JobTitle: row.JobTitle,
                OrganizationId: row.OrganizationId,
                Department: row.DepartmentName,
                DepartmentId: row.DepartmentId,
                Departments: departmentsByUser.GetValueOrDefault(row.Id) ?? [],
                ProfileId: row.ProfileId,
                Bio: row.Bio,
                AvailabilityStatus: row.AvailabilityStatus.ToString(),
                AvailabilityPercentage: row.AvailabilityPercentage,
                AIWorkloadScore: row.AIWorkloadScore,
                AIBurnoutRiskScore: row.AIBurnoutRiskScore,
                AIPerformanceScore: row.AIPerformanceScore,
                ActiveTaskCount: row.ActiveTaskCount,
                IsActive: row.IsActive,
                LastLoginDate: null,
                Roles: roles.Select(role => role.Name).ToList(),
                RoleKeys: roles.Select(role => role.Key)
                    .Where(key => !string.IsNullOrWhiteSpace(key))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList(),
                Skills: skillsByUser.GetValueOrDefault(row.Id)?.Select(skill => skill.SkillName).ToList(),
                SkillDetails: skillsByUser.GetValueOrDefault(row.Id));
        }).ToList();

        return Ok(PaginatedResponse<UserDto>.Create(items, pagination, totalCount));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        if (!await _scope.CanAccessUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        var user = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        return user == null ? NotFound() : Ok(UserDto.FromEntityWithSkills(user, UserRoleResolver.Resolve(user)));
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe(CancellationToken ct)
    {
        var userId = _currentUser.UserId;
        if (!Guid.TryParse(userId, out var parsedId))
        {
            return Unauthorized();
        }

        var user = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        return user == null ? NotFound() : Ok(UserDto.FromEntityWithSkills(user, UserRoleResolver.Resolve(user)));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(
        string id,
        [FromBody] UpdateUserDto dto,
        CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        var user = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        if (user == null)
        {
            return NotFound();
        }

        if (!await _scope.CanManageUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        if (!await AreDepartmentsInScopeAsync(dto.DepartmentIds, dto.DepartmentId, ct))
        {
            return Forbid();
        }

        if (!await IsOrganizationInScopeAsync(dto.OrganizationId, ct))
        {
            return Forbid();
        }

        user.UpdateProfile(
            dto.FirstName,
            dto.LastName,
            dto.PhoneNumber ?? string.Empty,
            dto.JobTitle ?? string.Empty,
            dto.ProfilePictureUrl);

        await AssignDepartmentsAsync(user, dto.DepartmentIds, dto.DepartmentId, dto.OrganizationId, ct);

        var profile = user.Profile ?? UserProfile.Create(user.Id, null, dto.JobTitle, null, null, null, null);
        profile.UpdateProfileDetails(
            user.Profile?.Bio,
            dto.JobTitle ?? user.JobTitle,
            user.Profile?.DateOfBirth,
            user.Profile?.Address,
            user.Profile?.EmergencyContact,
            user.Profile?.LinkedInUrl);

        if (user.Profile == null)
        {
            profile.SetCreatedBy(_currentUser.UserId ?? "system");
            await _uow.UserProfiles.AddAsync(profile, ct);
            user.SetProfile(profile);
        }

        user.UpdateAvailability(dto.AvailabilityStatus ?? user.AvailabilityStatus, dto.AvailabilityPercentage);
        if (dto.RoleNames is { Count: > 0 } && (_scope.IsSuperAdmin || _scope.IsDirector))
        {
            var requestedRoleInputs = dto.RoleNames
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Select(role => role.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var requestedRoles = await ResolveRolesByInputAsync(requestedRoleInputs, ct);

            if (!_scope.IsSuperAdmin && requestedRoles.Any(role => role.Key == RoleKeys.SuperAdmin))
            {
                return Forbid();
            }

            if (!_scope.IsSuperAdmin && requestedRoles.Count > 0)
            {
                var currentUserId = _currentUser.UserId;
                var currentUserMaxLevel = 0;
                if (Guid.TryParse(currentUserId, out var currentUserGuid))
                {
                    var currentUserEntity = await _db.Users
                        .Include(u => u.Roles)
                        .FirstOrDefaultAsync(u => u.Id == currentUserGuid, ct);
                    if (currentUserEntity != null)
                    {
                        currentUserMaxLevel = currentUserEntity.Roles.Max(r => r.PermissionLevel);
                    }
                }

                if (requestedRoles.Any(role => role.PermissionLevel >= currentUserMaxLevel))
                {
                    return Forbid();
                }
            }

            var isCurrentlySuperAdmin = user.Roles.Any(r => r.Key == RoleKeys.SuperAdmin);
            if (isCurrentlySuperAdmin && requestedRoles.All(role => role.Key != RoleKeys.SuperAdmin))
            {
                var superAdmin = await _db.Roles.FirstOrDefaultAsync(r => r.Key == RoleKeys.SuperAdmin, ct);
                if (superAdmin != null)
                {
                    requestedRoles.Add(superAdmin);
                }
            }

            if (requestedRoles.Count == 0)
            {
                var viewer = await _db.Roles.FirstOrDefaultAsync(r => r.Key == RoleKeys.Viewer, ct);
                if (viewer != null)
                {
                    requestedRoles.Add(viewer);
                }
            }

            user.Roles.Clear();
            foreach (var role in requestedRoles)
            {
                user.Roles.Add(role);
            }
        }
        user.SetModified(_currentUser.UserId ?? "system");

        await _uow.Users.UpdateAsync(user, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "User Updated",
            Description: $"{_currentUser.FullName} updated user \"{user.FullName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["targetUserId"] = user.Id,
                ["targetUserFullName"] = user.FullName
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Users, user.Id.ToString(), null, ct);

        return Ok(UserDto.FromEntityWithSkills(user, UserRoleResolver.Resolve(user)));
    }

    [HttpPost("register")]
    [Authorize(Policy = AuthorizationPolicies.Director)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterUserDto dto,
        CancellationToken ct)
    {
        var existingEmail = await _uow.Users.FindAsync(
            u => u.Email == dto.Email.ToLower().Trim(),
            ct);
        if (existingEmail.Any())
        {
            return Conflict(new { message = $"A user with email '{dto.Email}' already exists." });
        }

        if (!await AreDepartmentsInScopeAsync(dto.DepartmentIds, dto.DepartmentId, ct))
        {
            return Forbid();
        }

        if (!await IsOrganizationInScopeAsync(dto.OrganizationId, ct))
        {
            return Forbid();
        }

        var roleInput = string.IsNullOrWhiteSpace(dto.Role) ? RoleKeys.Viewer : dto.Role.Trim();
        var role = await ResolveRoleByInputAsync(roleInput, ct);
        if (role == null)
        {
            return BadRequest(new { message = $"Role '{roleInput}' was not found." });
        }

        if (!_scope.IsSuperAdmin && role.Key == RoleKeys.SuperAdmin)
        {
            return Forbid();
        }

        if (!_scope.IsSuperAdmin)
        {
            var currentUserMaxLevel = await GetCurrentUserMaxRoleLevelAsync(ct);
            if (role.PermissionLevel >= currentUserMaxLevel)
            {
                return Forbid();
            }
        }

        var user = ApplicationUser.Create(
            dto.Email,
            dto.FirstName,
            dto.LastName,
            Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            dto.JobTitle ?? role.Name,
            dto.DepartmentId);
        user.SetCreatedBy(_currentUser.UserId ?? "system");
        user.Roles.Add(role);

        user.SetPassword(new PasswordHasher<ApplicationUser>().HashPassword(user, dto.Password.Trim()));

        await _uow.Users.AddAsync(user, ct);
        await _uow.SaveChangesAsync(ct);
        var requestedOrganizationId = dto.OrganizationId ?? await GetOrganizationForDepartmentAsync(dto.DepartmentId, ct);
        if (requestedOrganizationId.HasValue)
        {
            user.AssignToOrganization(requestedOrganizationId.Value);
        }
        await AssignDepartmentsAsync(user, dto.DepartmentIds, dto.DepartmentId, dto.OrganizationId, ct);

        var profile = UserProfile.Create(
            user.Id,
            null,
            dto.JobTitle ?? role.Name,
            null,
            null,
            null,
            null);
        profile.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.UserProfiles.AddAsync(profile, ct);

        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "User Created",
            Description: $"{_currentUser.FullName} registered user \"{user.FullName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["newUserId"] = user.Id,
                ["newUserFullName"] = user.FullName,
                ["newUserEmail"] = user.Email
            }
        );

        var created = await _uow.Users.GetByIdWithSkillsAsync(user.Id, ct);
        await _changes.NotifyAsync(DataChangeScopes.Users, user.Id.ToString(), null, ct);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, UserDto.FromEntityWithSkills(created!, UserRoleResolver.Resolve(created!)));
    }

    [HttpPut("{id}/departments")]
    [Authorize(Policy = AuthorizationPolicies.Director)]
    public async Task<IActionResult> AssignDepartments(
        string id,
        [FromBody] AssignUserDepartmentsRequest req,
        CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        var user = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        if (user == null)
        {
            return NotFound();
        }

        if (!await _scope.CanManageUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        if (!await AreDepartmentsInScopeAsync(req.DepartmentIds, req.PrimaryDepartmentId, ct))
        {
            return Forbid();
        }

        await AssignDepartmentsAsync(user, req.DepartmentIds, req.PrimaryDepartmentId, null, ct);
        await _uow.SaveChangesAsync(ct);

        var refreshed = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Users, parsedId.ToString(), null, ct);
        return Ok(UserDto.FromEntityWithSkills(refreshed!, UserRoleResolver.Resolve(refreshed!)));
    }

    [HttpPost("{id}/profile-picture")]
    [RequestSizeLimit(2_000_000)]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> UploadProfilePicture(
        string id,
        IFormFile file,
        CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        if (_currentUser.UserId != id && !await _scope.CanManageUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        if (file.Length == 0 || file.Length > 1_500_000)
        {
            return BadRequest(new { message = "Profile picture must be between 1 byte and 1.5 MB." });
        }

        var allowed = new[] { "image/jpeg", "image/png", "image/webp" };
        if (!allowed.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only JPEG, PNG, and WebP images are supported." });
        }

        var user = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        if (user == null)
        {
            return NotFound();
        }

        await using var stream = file.OpenReadStream();
        var extension = Path.GetExtension(file.FileName);
        var url = await _localFiles.UploadAvatarAsync(stream, user.EmployeeCode, extension, ct);
        user.UpdateProfile(user.FirstName, user.LastName, user.PhoneNumber, user.JobTitle, url);
        user.SetModified(_currentUser.UserId ?? "system");
        await _uow.Users.UpdateAsync(user, ct);
        await _uow.SaveChangesAsync(ct);

        await _changes.NotifyAsync(DataChangeScopes.Users, parsedId.ToString(), null, ct);
        return Ok(new { profilePictureUrl = url, user = UserDto.FromEntityWithSkills(user, UserRoleResolver.Resolve(user)) });
    }

    [HttpPatch("{id}/availability")]
    public async Task<IActionResult> UpdateAvailability(
        string id,
        [FromBody] UpdateAvailabilityRequest req,
        CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        var user = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        if (user == null)
        {
            return NotFound();
        }

        if (_currentUser.UserId != parsedId.ToString() && !await _scope.CanManageUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        user.UpdateAvailability(req.Status, req.AvailabilityPercentage);
        await _uow.Users.UpdateAsync(user, ct);
        await _uow.SaveChangesAsync(ct);
        await _changes.NotifyAsync(DataChangeScopes.Users, parsedId.ToString(), null, ct);
        return Ok(UserDto.FromEntityWithSkills(user, UserRoleResolver.Resolve(user)));
    }

    [HttpPost("{id}/skills")]
    public async Task<IActionResult> AddSkill(
        string id,
        [FromBody] AddUserSkillRequest req,
        CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        var user = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        if (user == null)
        {
            return NotFound();
        }

        if (_currentUser.UserId != parsedId.ToString() && !await _scope.CanManageUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        var existing = user.Skills.FirstOrDefault(s => s.SkillId == req.SkillId);

        if (existing != null)
        {
            existing.UpdateProficiency(req.ProficiencyLevel);
            existing.UpdateExperience(req.ExperienceMonths);
        }
        else
        {
            var skill = UserSkill.Create(
                user.Id,
                req.SkillId,
                req.ProficiencyLevel,
                req.ExperienceMonths);
            await _uow.UserSkills.AddAsync(skill, ct);
        }

        await _uow.SaveChangesAsync(ct);

        var refreshed = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        var skillDtos = refreshed!.Skills
            .Select(s => new UserSkillDto(
                s.SkillId,
                s.Skill?.Name ?? "",
                s.ProficiencyLevel,
                s.ExperienceMonths,
                s.LastUsed))
            .ToList();
            await _changes.NotifyAsync(DataChangeScopes.Users, parsedId.ToString(), null, ct);
            return Ok(new
            {
                User = UserDto.FromEntityWithSkills(refreshed, UserRoleResolver.Resolve(refreshed)),
            Skills = skillDtos
        });
    }

    [HttpPut("{id}/skills/{skillId:guid}")]
    public async Task<IActionResult> UpdateSkill(
        string id,
        Guid skillId,
        [FromBody] UpdateUserSkillRequest req,
        CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        var user = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        if (user == null)
        {
            return NotFound();
        }

        if (_currentUser.UserId != parsedId.ToString() && !await _scope.CanManageUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        var existing = user.Skills.FirstOrDefault(s => s.SkillId == skillId);
        if (existing == null)
        {
            return NotFound(new { message = "User does not have this skill." });
        }

        existing.UpdateProficiency(req.ProficiencyLevel);
        existing.UpdateExperience(req.ExperienceMonths);
        await _uow.SaveChangesAsync(ct);

        var refreshed = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        var skillDtos = refreshed!.Skills
            .Select(s => new UserSkillDto(
                s.SkillId,
                s.Skill?.Name ?? "",
                s.ProficiencyLevel,
                s.ExperienceMonths,
                s.LastUsed))
            .ToList();
            await _changes.NotifyAsync(DataChangeScopes.Users, parsedId.ToString(), null, ct);
            return Ok(new
            {
                User = UserDto.FromEntityWithSkills(refreshed, UserRoleResolver.Resolve(refreshed)),
            Skills = skillDtos
        });
    }

    [HttpDelete("{id}/skills/{skillId:guid}")]
    public async Task<IActionResult> RemoveSkill(
        string id,
        Guid skillId,
        CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        var user = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        if (user == null)
        {
            return NotFound();
        }

        if (_currentUser.UserId != parsedId.ToString() && !await _scope.CanManageUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        var existing = user.Skills.FirstOrDefault(s => s.SkillId == skillId);
        if (existing == null)
        {
            return NotFound(new { message = "User does not have this skill." });
        }

        await _uow.UserSkills.DeleteAsync(existing.Id, ct);
        await _uow.SaveChangesAsync(ct);

        var refreshed = await _uow.Users.GetByIdWithSkillsAsync(parsedId, ct);
        var skillDtos = refreshed!.Skills
            .Select(s => new UserSkillDto(
                s.SkillId,
                s.Skill?.Name ?? "",
                s.ProficiencyLevel,
                s.ExperienceMonths,
                s.LastUsed))
            .ToList();
            await _changes.NotifyAsync(DataChangeScopes.Users, parsedId.ToString(), null, ct);
            return Ok(new
            {
                User = UserDto.FromEntityWithSkills(refreshed, UserRoleResolver.Resolve(refreshed)),
            Skills = skillDtos
        });
    }

    [HttpGet("available")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> GetAvailable([FromQuery] PaginationQuery pagination, CancellationToken ct)
    {
        var query = await _scope.ScopeUsersAsync(
            UserGraph(includeSkills: true)
                .Where(u => u.IsActive && u.AvailabilityStatus == PMWDS.Domain.Enums.AvailabilityStatus.Available),
            ct);
        var totalCount = await query.CountAsync(ct);
        var users = await query
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .ToListAsync(ct);
        return Ok(PaginatedResponse<UserDto>.Create(
            users.Select(u => UserDto.FromEntityWithSkills(u, UserRoleResolver.Resolve(u))).ToList(),
            pagination,
            totalCount));
    }

    [HttpGet("workload")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> GetWorkload(
        [FromQuery] Guid? departmentId,
        CancellationToken ct)
    {
        if (departmentId.HasValue && !await _scope.CanAccessDepartmentAsync(departmentId.Value, ct))
        {
            return Forbid();
        }

        var scopedUsers = await (await _scope.ScopeUsersAsync(UserGraph(includeSkills: true), ct))
            .Select(user => user.Id)
            .ToListAsync(ct);
        return Ok(await Mediator.Send(new GetWorkloadDistributionQuery(departmentId, scopedUsers), ct));
    }

    [HttpPatch("{id}/deactivate")]
    [Authorize(Policy = AuthorizationPolicies.Director)]
    public async Task<IActionResult> Deactivate(string id, CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        var user = await _uow.Users.GetByIdAsync(parsedId, ct);
        if (user == null)
        {
            return NotFound();
        }

        if (!await _scope.CanManageUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        if (await IsLastActiveSuperAdminAsync(parsedId, ct))
        {
            return BadRequest(new { message = "The last active SuperAdmin user cannot be deactivated." });
        }

        user.Deactivate();
        await _uow.Users.UpdateAsync(user, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "User Deactivated",
            Description: $"{_currentUser.FullName} deactivated user \"{user.FullName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["targetUserId"] = user.Id,
                ["targetUserFullName"] = user.FullName
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Users, parsedId.ToString(), null, ct);

        return Ok();
    }

    [HttpPatch("{id}/reactivate")]
    [Authorize(Policy = AuthorizationPolicies.Director)]
    public async Task<IActionResult> Reactivate(string id, CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var parsedId))
        {
            return BadRequest("Invalid user id.");
        }

        var user = await _uow.Users.GetByIdAsync(parsedId, ct);
        if (user == null)
        {
            return NotFound();
        }

        if (!await _scope.CanManageUserAsync(parsedId, ct))
        {
            return Forbid();
        }

        user.Activate();
        await _uow.Users.UpdateAsync(user, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "User Reactivated",
            Description: $"{_currentUser.FullName} reactivated user \"{user.FullName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["targetUserId"] = user.Id,
                ["targetUserFullName"] = user.FullName
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Users, parsedId.ToString(), null, ct);

        return Ok(UserDto.FromEntityWithSkills(user, UserRoleResolver.Resolve(user)));
    }

    private async Task AssignDepartmentsAsync(
        ApplicationUser user,
        IReadOnlyCollection<Guid>? departmentIds,
        Guid? primaryDepartmentId,
        Guid? organizationId,
        CancellationToken ct)
    {
        var requested = (departmentIds ?? Array.Empty<Guid>())
            .Append(primaryDepartmentId ?? Guid.Empty)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        var existing = await _db.UserDepartments
            .Where(d => d.UserId == user.Id)
            .ToListAsync(ct);

        if (requested.Count == 0)
        {
            _db.UserDepartments.RemoveRange(existing);
            user.ClearPrimaryDepartment();
            if (organizationId.HasValue)
            {
                user.AssignToOrganization(organizationId.Value);
            }
            return;
        }

        var validDepartments = await _db.Departments
            .Where(d => requested.Contains(d.Id))
            .Select(d => d.Id)
            .ToListAsync(ct);

        foreach (var assignment in existing.Where(e => !validDepartments.Contains(e.DepartmentId)))
        {
            _db.UserDepartments.Remove(assignment);
        }

        var primary = primaryDepartmentId.HasValue && validDepartments.Contains(primaryDepartmentId.Value)
            ? primaryDepartmentId.Value
            : validDepartments.FirstOrDefault();

        foreach (var assignment in existing)
        {
            if (assignment.DepartmentId == primary)
            {
                assignment.MarkPrimary();
            }
            else
            {
                assignment.ClearPrimary();
            }
        }

        foreach (var departmentId in validDepartments.Where(id => existing.All(e => e.DepartmentId != id)))
        {
            var assignment = UserDepartment.Create(user.Id, departmentId, departmentId == primary);
            assignment.SetCreatedBy(_currentUser.UserId ?? "system");
            await _db.UserDepartments.AddAsync(assignment, ct);
        }

        if (primary != Guid.Empty)
        {
            user.AssignToDepartment(primary);
            var primaryOrganizationId = await GetOrganizationForDepartmentAsync(primary, ct);
            if (primaryOrganizationId.HasValue)
            {
                user.AssignToOrganization(primaryOrganizationId.Value);
            }
        }
        else if (organizationId.HasValue)
        {
            user.AssignToOrganization(organizationId.Value);
        }
    }

    private IQueryable<ApplicationUser> UserGraph(bool includeSkills)
    {
        var query = _db.Users
            .Include(u => u.Department)
            .Include(u => u.Organization)
            .Include(u => u.DepartmentAssignments)
            .ThenInclude(d => d.Department)
            .ThenInclude(d => d!.Organization)
            .Include(u => u.Profile)
            .Include(u => u.Roles)
            .AsQueryable();

        if (includeSkills)
        {
            query = query
                .Include(u => u.Skills)
                .ThenInclude(s => s.Skill);
        }

        return query;
    }

    private async Task<bool> AreDepartmentsInScopeAsync(
        IReadOnlyCollection<Guid>? departmentIds,
        Guid? primaryDepartmentId,
        CancellationToken ct)
    {
        if (_scope.IsSuperAdmin)
        {
            return true;
        }

        var requested = (departmentIds ?? Array.Empty<Guid>())
            .Append(primaryDepartmentId ?? Guid.Empty)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (requested.Count == 0)
        {
            return true;
        }

        var organizationIds = await _scope.GetOrganizationIdsAsync(ct);
        var validCount = await _db.Departments
            .CountAsync(department =>
                requested.Contains(department.Id) &&
                department.OrganizationId.HasValue &&
                organizationIds.Contains(department.OrganizationId.Value),
                ct);

        return validCount == requested.Count;
    }

    private async Task<bool> IsOrganizationInScopeAsync(Guid? organizationId, CancellationToken ct)
    {
        if (!organizationId.HasValue || _scope.IsSuperAdmin)
        {
            return true;
        }

        return await _scope.CanAccessOrganizationAsync(organizationId.Value, ct);
    }

    private async Task<List<Role>> ResolveRolesByInputAsync(IReadOnlyCollection<string> roleInputs, CancellationToken ct)
    {
        if (roleInputs.Count == 0)
        {
            return new List<Role>();
        }

        var normalizedInputs = roleInputs
            .Select(RoleKeys.Normalize)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var roles = await _db.Roles
            .Where(role => normalizedInputs.Contains(role.Key) || normalizedInputs.Contains(role.Name.ToLower()))
            .ToListAsync(ct);

        return roles
            .GroupBy(role => role.Key, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();
    }

    private async Task<Role?> ResolveRoleByInputAsync(string roleInput, CancellationToken ct)
    {
        var normalizedInput = RoleKeys.Normalize(roleInput);
        return await _db.Roles
            .FirstOrDefaultAsync(role => role.Key == normalizedInput || role.Name.ToLower() == normalizedInput, ct);
    }

    private async Task<int> GetCurrentUserMaxRoleLevelAsync(CancellationToken ct)
    {
        var currentUserId = _currentUser.UserId;
        if (!Guid.TryParse(currentUserId, out var currentUserGuid))
        {
            return 0;
        }

        var currentUserEntity = await _db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == currentUserGuid, ct);

        return currentUserEntity?.Roles.Max(r => r.PermissionLevel) ?? 0;
    }

    private async Task<bool> IsLastActiveSuperAdminAsync(Guid userId, CancellationToken ct)
    {
        var isSuperAdmin = await _db.Users
            .Where(user => user.Id == userId)
            .AnyAsync(user => user.Roles.Any(role => role.Key == RoleKeys.SuperAdmin), ct);
        if (!isSuperAdmin)
        {
            return false;
        }

        var activeSuperAdminCount = await _db.Users
            .CountAsync(user =>
                user.IsActive &&
                user.Roles.Any(role => role.Key == RoleKeys.SuperAdmin),
                ct);

        return activeSuperAdminCount <= 1;
    }

    private async Task<Guid?> GetOrganizationForDepartmentAsync(Guid? departmentId, CancellationToken ct)
    {
        if (!departmentId.HasValue)
        {
            return null;
        }

        return await _db.Departments
            .Where(department => department.Id == departmentId.Value)
            .Select(department => department.OrganizationId)
            .FirstOrDefaultAsync(ct);
    }
}
