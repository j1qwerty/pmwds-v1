using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Middleware;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Common;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

public class OrganizationsController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly RoleScopeService _scope;
    private readonly ICurrentUserService _currentUser;
    private readonly ApplicationDbContext _db;
    private readonly IDataChangeNotifier _changes;

    public OrganizationsController(IMediator mediator, IUnitOfWork uow, RoleScopeService scope, ICurrentUserService currentUser, ApplicationDbContext db, IDataChangeNotifier changes) : base(mediator)
    {
        _uow = uow;
        _scope = scope;
        _currentUser = currentUser;
        _db = db;
        _changes = changes;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PaginationQuery pagination, CancellationToken ct)
    {
        var query = await _scope.ScopeOrganizationsAsync(
            _db.Organizations.AsNoTracking(),
            ct);

        var totalCount = await query.CountAsync(ct);
        var organizations = await query
            .OrderBy(organization => organization.Name)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .Select(organization => new
            {
                organization.Id,
                organization.Name,
                organization.TaxId,
                organization.Address,
                organization.ContactEmail,
                organization.ContactPhone,
                organization.FoundedDate
            })
            .ToListAsync(ct);

        var organizationIds = organizations.Select(organization => organization.Id).ToHashSet();

        var departments = await _db.Departments
            .AsNoTracking()
            .Where(department =>
                department.OrganizationId.HasValue &&
                organizationIds.Contains(department.OrganizationId.Value))
            .Select(department => new
            {
                OrganizationId = department.OrganizationId!.Value,
                department.Id,
                department.Name,
                department.Code
            })
            .ToListAsync(ct);

        var directors = await GetDirectorSummariesAsync(organizationIds, ct);

        var items = organizations.Select(organization =>
        {
            var organizationDepartments = departments
                .Where(department => department.OrganizationId == organization.Id)
                .Select(department => new OrganizationDepartmentResponse(
                    department.Id,
                    department.Name,
                    department.Code))
                .ToList();

            return new OrganizationResponse(
                organization.Id,
                organization.Name,
                organization.TaxId,
                organization.Address,
                organization.ContactEmail,
                organization.ContactPhone,
                organization.FoundedDate,
                directors.GetValueOrDefault(organization.Id),
                organizationDepartments,
                organizationDepartments.Count);
        }).ToList();

        return Ok(PaginatedResponse<OrganizationResponse>.Create(items, pagination, totalCount));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var organization = await _uow.Organizations.GetByIdAsync(id, ct);
        if (organization == null)
        {
            return NotFound();
        }

        if (!await _scope.CanAccessOrganizationAsync(id, ct))
        {
            return Forbid();
        }

        var departments = (await _uow.Departments.FindAsync(d => d.OrganizationId == id, ct)).ToList();
        var directors = await GetDirectorSummariesAsync(new HashSet<Guid> { id }, ct);
        return Ok(MapOrganization(organization, departments, directors.GetValueOrDefault(id)));
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> Create([FromBody] UpsertOrganizationRequest req, CancellationToken ct)
    {
        var organization = Organization.Create(req.Name, req.TaxId, req.Address, req.ContactEmail, req.ContactPhone, req.FoundedDate);
        organization.SetCreatedBy("system");
        await _uow.Organizations.AddAsync(organization, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Organization Created",
            Description: $"{_currentUser.FullName} created organization \"{organization.Name}\"",
            Metadata: new Dictionary<string, object>
            {
                ["organizationId"] = organization.Id,
                ["organizationName"] = organization.Name
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Organizations, organization.Id.ToString(), null, ct);
        return CreatedAtAction(nameof(GetById), new { id = organization.Id }, MapOrganization(organization, new List<Department>(), null));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Director)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertOrganizationRequest req, CancellationToken ct)
    {
        var organization = await _uow.Organizations.GetByIdAsync(id, ct);
        if (organization == null)
        {
            return NotFound();
        }

        if (!await _scope.CanManageOrganizationAsync(id, ct))
        {
            return Forbid();
        }

        organization.Update(req.Name, req.TaxId, req.Address, req.ContactEmail, req.ContactPhone, req.FoundedDate);
        await _uow.Organizations.UpdateAsync(organization, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Organization Updated",
            Description: $"{_currentUser.FullName} updated organization \"{organization.Name}\"",
            Metadata: new Dictionary<string, object>
            {
                ["organizationId"] = organization.Id,
                ["organizationName"] = organization.Name
            }
        );

        var departments = (await _uow.Departments.FindAsync(d => d.OrganizationId == id, ct)).ToList();
        var directors = await GetDirectorSummariesAsync(new HashSet<Guid> { id }, ct);
        await _changes.NotifyAsync(DataChangeScopes.Organizations, id.ToString(), null, ct);
        return Ok(MapOrganization(organization, departments, directors.GetValueOrDefault(id)));
    }

    [HttpPut("{id:guid}/departments/{departmentId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> AssignDepartment(Guid id, Guid departmentId, CancellationToken ct)
    {
        var organization = await _uow.Organizations.GetByIdAsync(id, ct);
        var department = await _uow.Departments.GetByIdAsync(departmentId, ct);
        if (organization == null || department == null)
        {
            return NotFound();
        }

        department.AssignToOrganization(id);
        await _uow.Departments.UpdateAsync(department, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Department Assigned",
            Description: $"{_currentUser.FullName} assigned department \"{department.Name}\" to organization \"{organization.Name}\"",
            Metadata: new Dictionary<string, object>
            {
                ["organizationId"] = id,
                ["organizationName"] = organization.Name,
                ["departmentId"] = departmentId,
                ["departmentName"] = department.Name
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Organizations, id.ToString(), null, ct);
        await _changes.NotifyAsync(DataChangeScopes.Departments, departmentId.ToString(), null, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}/departments/{departmentId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> RemoveDepartment(Guid id, Guid departmentId, CancellationToken ct)
    {
        var department = await _uow.Departments.GetByIdAsync(departmentId, ct);
        if (department == null || department.OrganizationId != id)
        {
            return NotFound();
        }

        var deptName = department.Name;
        var org = await _uow.Organizations.GetByIdAsync(id, ct);
        var orgName = org?.Name ?? "Unknown";

        department.AssignToOrganization(null);
        await _uow.Departments.UpdateAsync(department, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Department Removed",
            Description: $"{_currentUser.FullName} removed department \"{deptName}\" from organization \"{orgName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["organizationId"] = id,
                ["organizationName"] = orgName,
                ["departmentId"] = departmentId,
                ["departmentName"] = deptName
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Organizations, id.ToString(), null, ct);
        await _changes.NotifyAsync(DataChangeScopes.Departments, departmentId.ToString(), null, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var org = await _uow.Organizations.GetByIdAsync(id, ct);
        var orgName = org?.Name ?? "Unknown";

        await _uow.Organizations.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Organization Deleted",
            Description: $"{_currentUser.FullName} deleted organization \"{orgName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["organizationName"] = orgName
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Organizations, id.ToString(), null, ct);
        return NoContent();
    }

    private async Task<Dictionary<Guid, OrganizationDirectorResponse>> GetDirectorSummariesAsync(HashSet<Guid> organizationIds, CancellationToken ct)
    {
        if (organizationIds.Count == 0)
        {
            return new Dictionary<Guid, OrganizationDirectorResponse>();
        }

        // Two flat queries rather than one SelectMany over a collection navigation.
        // The collection-correlated SelectMany translated to SQL Server's APPLY, which SQLite
        // cannot generate, so the whole organizations list failed whenever the app ran on its
        // SQLite fallback. Splitting it keeps every query translatable on both providers.
        var directors = await _db.Users
            .AsNoTracking()
            .Where(user =>
                user.Roles.Any(role => role.Key == RoleKeys.Director) &&
                user.DepartmentAssignments.Any(assignment =>
                    assignment.Department != null &&
                    assignment.Department.OrganizationId.HasValue &&
                    organizationIds.Contains(assignment.Department.OrganizationId.Value)))
            .Select(user => new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                user.ProfilePictureUrl
            })
            .ToListAsync(ct);

        if (directors.Count == 0)
        {
            return new Dictionary<Guid, OrganizationDirectorResponse>();
        }

        var directorById = directors.ToDictionary(director => director.Id);
        // A List<Guid>.Contains translates to IN. Dictionary.ContainsKey does not - EF turns it
        // into an APPLY, which is exactly the construct SQLite cannot generate.
        var directorIds = directorById.Keys.ToList();

        var assignments = await _db.UserDepartments
            .AsNoTracking()
            .Where(assignment =>
                assignment.Department != null &&
                assignment.Department.OrganizationId.HasValue &&
                organizationIds.Contains(assignment.Department.OrganizationId.Value) &&
                directorIds.Contains(assignment.UserId))
            .Select(assignment => new
            {
                OrganizationId = assignment.Department!.OrganizationId!.Value,
                assignment.UserId
            })
            .ToListAsync(ct);

        return assignments
            .Where(assignment => directorById.ContainsKey(assignment.UserId))
            .GroupBy(assignment => assignment.OrganizationId)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var director = directorById[group.First().UserId];
                    return new OrganizationDirectorResponse(
                        director.Id,
                        director.FirstName + " " + director.LastName,
                        director.Email,
                        director.ProfilePictureUrl);
                });
    }

    private static OrganizationResponse MapOrganization(Organization organization, List<Department> departments, OrganizationDirectorResponse? director)
        => new(
            organization.Id,
            organization.Name,
            organization.TaxId,
            organization.Address,
            organization.ContactEmail,
            organization.ContactPhone,
            organization.FoundedDate,
            director,
            departments.Select(d => new OrganizationDepartmentResponse(d.Id, d.Name, d.Code)).ToList(),
            departments.Count);
}
