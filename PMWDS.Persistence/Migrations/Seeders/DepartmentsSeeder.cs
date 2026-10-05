using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class DepartmentsSeeder
{
    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var orgs = await context.Organizations.ToDictionaryAsync(o => o.Name, ct);
        var specs = new[]
        {
            new SeedConstants.DepartmentSpec("org1", "Public Works Department", "PWD", "Overall project ownership and coordination for government capital works", 15),
            new SeedConstants.DepartmentSpec("org1", "Revenue Department", "REV", "Land acquisition, ownership verification and site readiness", 10),
            new SeedConstants.DepartmentSpec("org1", "Architecture & Planning Cell", "APC", "Master planning, building design and layout preparation", 8),
            new SeedConstants.DepartmentSpec("org1", "Town & Country Planning", "TCP", "Statutory approvals, building plan approval and development permission", 8),
            new SeedConstants.DepartmentSpec("org1", "Procurement & Finance", "PROC", "Tendering, BOQ preparation, bid evaluation and contract award", 10),
            new SeedConstants.DepartmentSpec("org1", "PWD Civil Division", "PWDC", "Site preparation, foundation, superstructure and road construction", 20),
            new SeedConstants.DepartmentSpec("org1", "Jal Nigam", "JAL", "Water supply infrastructure, pipelines and pump house", 10),
            new SeedConstants.DepartmentSpec("org1", "Electricity Distribution Division", "ELEC", "Electrical infrastructure, HT/LT cables and street lighting", 10),
            new SeedConstants.DepartmentSpec("org1", "Sewerage Division", "SEW", "Sewerage network, drainage and STP connection", 10),
            new SeedConstants.DepartmentSpec("org1", "Horticulture Department", "HORT", "Landscaping, plantation, irrigation and parks", 8),
            new SeedConstants.DepartmentSpec("org1", "Quality Assurance Cell", "QA", "Quality inspection, material testing and handover", 8)
        };

        foreach (var spec in specs)
        {
            if (!orgs.TryGetValue(spec.OrganizationName, out var org))
                continue;

            if (await context.Departments.AnyAsync(d => d.OrganizationId == org.Id && d.Code == spec.Code, ct))
                continue;

            var department = Department.Create(spec.Name, spec.Code, spec.Description);
            department.AssignToOrganization(org.Id);
            department.SetMaxCapacity(spec.Capacity);
            department.SetCreatedBy(SeedConstants.SeedUser);
            await context.Departments.AddAsync(department, ct);
        }

        await context.SaveChangesAsync(ct);
        await AssignDepartmentHeadsAsync(context, ct);
    }

    private static async Task AssignDepartmentHeadsAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var users = await context.Users.ToListAsync(ct);
        var departments = await context.Departments.ToListAsync(ct);

        var headMap = new Dictionary<string, string>
        {
            ["PWD"] = users.FirstOrDefault(u => u.Email == "admin@org1.com")?.Id.ToString() ?? "",
            ["REV"] = users.FirstOrDefault(u => u.Email == "head.bstr@org1.com")?.Id.ToString() ?? "",
            ["PROC"] = users.FirstOrDefault(u => u.Email == "head.ops@org1.com")?.Id.ToString() ?? "",
            ["PWDC"] = users.FirstOrDefault(u => u.Email == "head.eng@org1.com")?.Id.ToString() ?? "",
            ["QA"] = users.FirstOrDefault(u => u.Email == "head.csv@org1.com")?.Id.ToString() ?? "",
        };

        foreach (var department in departments)
        {
            if (headMap.TryGetValue(department.Code, out var userId) && !string.IsNullOrWhiteSpace(userId))
                department.AssignHead(userId);
        }

        await context.SaveChangesAsync(ct);
    }
}
