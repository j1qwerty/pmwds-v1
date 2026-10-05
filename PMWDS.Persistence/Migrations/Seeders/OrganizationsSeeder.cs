using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class OrganizationsSeeder
{
    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var organizations = new[]
        {
            Organization.Create("org1", "ORG-001", "Main Office", "admin@org1.com", "+1-555-0100", DateTime.UtcNow.Date.AddYears(-3)),
        };

        foreach (var organization in organizations)
        {
            if (await context.Organizations.AnyAsync(o => o.Name == organization.Name || o.TaxId == organization.TaxId, ct))
                continue;

            organization.SetCreatedBy(SeedConstants.SeedUser);
            await context.Organizations.AddAsync(organization, ct);
        }

        await context.SaveChangesAsync(ct);
    }
}
