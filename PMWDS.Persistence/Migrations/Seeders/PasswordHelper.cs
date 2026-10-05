using Microsoft.AspNetCore.Identity;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class PasswordHelper
{
    internal static string HashPassword(ApplicationUser user, string password)
        => new PasswordHasher<ApplicationUser>().HashPassword(user, password.Trim());
}
