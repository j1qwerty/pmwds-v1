using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class ProfilesSeeder
{
    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var users = await context.Users.ToListAsync(ct);
        var skills = await context.Skills.ToDictionaryAsync(s => s.Name, ct);

        foreach (var user in users)
        {
            if (!await context.UserProfiles.AnyAsync(p => p.UserId == user.Id, ct))
            {
                var profile = UserProfile.Create(user.Id, $"Delivery profile for {user.FullName}", user.JobTitle, null, "Hybrid delivery center", "+91-90000-00000", $"https://linkedin.example/{user.EmployeeCode.ToLowerInvariant()}");
                profile.SetCreatedBy(SeedConstants.SeedUser);
                await context.UserProfiles.AddAsync(profile, ct);
            }

            await AddUserSkillAsync(context, user.Id, skills, "Project Management", 4, 48, ct);
            await AddUserSkillAsync(context, user.Id, skills, user.JobTitle.Contains("Engineer") ? "React" : "Agile", 3, 30, ct);
            await AddUserSkillAsync(context, user.Id, skills, user.JobTitle.Contains("Engineer") ? ".NET" : "Data Analysis", 4, 42, ct);
        }

        await context.SaveChangesAsync(ct);
    }

    private static async Task AddUserSkillAsync(ApplicationDbContext context, Guid userId, Dictionary<string, Skill> skills, string skillName, int level, int months, CancellationToken ct)
    {
        if (!skills.TryGetValue(skillName, out var skill))
            return;

        var exists = await context.UserSkills.AnyAsync(s => s.UserId == userId && s.SkillId == skill.Id, ct);
        if (exists)
            return;

        var userSkill = UserSkill.Create(userId, skill.Id, level, months);
        userSkill.SetAIConfidenceScore(Math.Clamp(level / 5d, 0, 1));
        await context.UserSkills.AddAsync(userSkill, ct);
    }
}
