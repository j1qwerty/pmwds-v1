using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class UsersSeeder
{
    /// <summary>
    /// Executive account addresses that were retired when the top two roles were relabelled:
    /// the SuperAdmin account became superadmin@org1.com and the Director account became
    /// admin@org1.com. The rename has to run before the specs below - the old SuperAdmin row
    /// still holds admin@org1.com, which is exactly the address the Director now needs.
    /// Applied in order with a save between each step so the unique index never sees a clash.
    /// </summary>
    private static readonly (string OldEmail, string NewEmail)[] EmailRenames =
    {
        ("admin@org1.com", "superadmin@org1.com"),
        ("director@org1.com", "admin@org1.com"),
    };

    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct, string? storageBasePath = null)
    {
        await RenameRetiredEmailsAsync(context, ct);

        var departments = await context.Departments.ToListAsync(ct);
        var roles = await context.Roles.ToDictionaryAsync(r => r.Key, ct);
        var org = await context.Organizations.FirstOrDefaultAsync(ct);
        var specs = BuildUserSpecs(departments);
        var imagePaths = await SeedProfileImagesAsync(ct, storageBasePath);

        foreach (var spec in specs)
        {
            var user = await context.Users
                .Include(u => u.Roles)
                .FirstOrDefaultAsync(u => u.Email == spec.Email || u.EmployeeCode == spec.EmployeeCode, ct);

            if (user == null)
            {
                user = ApplicationUser.Create(spec.Email, spec.FirstName, spec.LastName, spec.EmployeeCode, spec.JobTitle, spec.DepartmentId);
                user.SetCreatedBy(SeedConstants.SeedUser);
                user.SetPassword(PasswordHelper.HashPassword(user, SeedConstants.DefaultPassword));
                user.UpdateAvailability(spec.Availability, spec.AvailabilityPercent);
                user.UpdateAIScores(spec.Performance, spec.Workload, spec.Burnout);
                if (org != null && spec.Role != RoleKeys.SuperAdmin)
                    user.AssignToOrganization(org.Id);

                // A SuperAdmin is deliberately org- and department-less so it can see
                // everything. This runs once, at insert. It used to run on every boot,
                // which silently discarded department assignments an admin had made.
                if (spec.Role == RoleKeys.SuperAdmin)
                {
                    user.ClearPrimaryDepartment();
                    user.ClearOrganization();
                }

                await context.Users.AddAsync(user, ct);
            }
            else
            {
                // Non-destructive reconcile. This branch used to overwrite the user's
                // name, job title, availability, AI scores and avatar on every restart,
                // so an admin's edits to a seeded account silently reverted on the next
                // deploy. Only fill in what is genuinely still unset, and never remove a
                // role or department an admin granted.
                BackfillEmptyProfileFields(user, spec, imagePaths);

                if (spec.DepartmentId.HasValue && user.DepartmentId is null)
                    user.AssignToDepartment(spec.DepartmentId.Value);
                if (org != null && user.OrganizationId == null)
                    user.AssignToOrganization(org.Id);
            }

            if (roles.TryGetValue(spec.Role, out var role) && user.Roles.All(r => r.Id != role.Id))
                user.Roles.Add(role);
        }

        await context.SaveChangesAsync(ct);
        await SeedUserDepartmentsAsync(context, ct);
    }

    /// <summary>
    /// Fills in only the profile fields that are still empty on an existing user.
    /// </summary>
    /// <remarks>
    /// Deliberately one-way. The previous implementation re-applied the whole seed spec
    /// on every application start, which meant an edit to a seeded account - a renamed
    /// user, a corrected job title, an uploaded avatar - was reverted on the next restart
    /// and there was no way to tell that had happened. Seeding is a floor, not a reset.
    ///
    /// Availability and AI scores are left alone entirely once a row exists: they are
    /// live operational values, not seed metadata, and the seeder has no way to tell a
    /// deliberate change from a default.
    /// </remarks>
    private static void BackfillEmptyProfileFields(
        ApplicationUser user,
        SeedConstants.UserSpec spec,
        IReadOnlyDictionary<string, string> imagePaths)
    {
        var firstName = string.IsNullOrWhiteSpace(user.FirstName) ? spec.FirstName : user.FirstName;
        var lastName = string.IsNullOrWhiteSpace(user.LastName) ? spec.LastName : user.LastName;
        var jobTitle = string.IsNullOrWhiteSpace(user.JobTitle) ? spec.JobTitle : user.JobTitle;

        var profilePicUrl = !string.IsNullOrWhiteSpace(user.ProfilePictureUrl)
            ? user.ProfilePictureUrl
            : imagePaths.TryGetValue(spec.EmployeeCode, out var seededImagePath)
                ? seededImagePath
                : $"https://api.dicebear.com/9.x/initials/svg?seed={user.EmployeeCode}";

        user.UpdateProfile(firstName, lastName, user.PhoneNumber, jobTitle, profilePicUrl);
    }

    private static async Task RenameRetiredEmailsAsync(ApplicationDbContext context, CancellationToken ct)
    {
        foreach (var (oldEmail, newEmail) in EmailRenames)
        {
            var user = await context.Users.FirstOrDefaultAsync(u => u.Email == oldEmail, ct);
            if (user == null || await context.Users.AnyAsync(u => u.Email == newEmail, ct))
                continue;

            user.UpdateEmail(newEmail);
            await context.SaveChangesAsync(ct);
        }
    }

    private static async Task SeedUserDepartmentsAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var users = await context.Users.ToListAsync(ct);
        foreach (var user in users.Where(u => u.DepartmentId.HasValue))
        {
            var exists = await context.UserDepartments.AnyAsync(d => d.UserId == user.Id && d.DepartmentId == user.DepartmentId!.Value, ct);
            if (exists)
                continue;

            var assignment = UserDepartment.Create(user.Id, user.DepartmentId!.Value, isPrimary: true);
            assignment.SetCreatedBy(SeedConstants.SeedUser);
            await context.UserDepartments.AddAsync(assignment, ct);
        }

        await context.SaveChangesAsync(ct);
    }

    private static async Task<Dictionary<string, string>> SeedProfileImagesAsync(CancellationToken ct, string? storageBasePath)
    {
        var result = new Dictionary<string, string>();
        var seedImagesDir = Path.Combine(AppContext.BaseDirectory, "SeedData", "Images");
        if (!Directory.Exists(seedImagesDir))
            return result;

        // Fall back to the app base directory when the host did not supply a path. Do not walk up
        // parent directories: that resolves outside the publish folder once deployed.
        var storageBase = string.IsNullOrWhiteSpace(storageBasePath)
            ? Path.Combine(AppContext.BaseDirectory, "Data")
            : storageBasePath;
        Directory.CreateDirectory(storageBase);

        var extensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
        var files = Directory.GetFiles(seedImagesDir)
            .Where(f => extensions.Contains(Path.GetExtension(f).ToLowerInvariant()));

        foreach (var file in files)
        {
            var employeeCode = Path.GetFileNameWithoutExtension(file).ToUpperInvariant();
            var ext = Path.GetExtension(file);
            var folderName = employeeCode[..Math.Min(4, employeeCode.Length)];
            var destFolder = Path.Combine(storageBase, folderName);
            Directory.CreateDirectory(destFolder);
            var destFile = Path.Combine(destFolder, $"{employeeCode.ToLowerInvariant()}{ext}");

            if (!File.Exists(destFile))
                File.Copy(file, destFile, overwrite: false);

            // Served by AzureStorage:LocalBaseUrl (default "/files"), which is mounted at the storage root.
            // The previous "pmwds-files" segment did not match the directory actually written, so
            // every seeded avatar URL 404'd.
            result[employeeCode] = $"/files/{folderName}/{employeeCode.ToLowerInvariant()}{ext}";
        }

        return result;
    }

    private static SeedConstants.UserSpec[] BuildUserSpecs(List<Department> departments)
    {
        Guid Dept(string code) => departments.FirstOrDefault(d => d.Code == code)?.Id ?? departments.First().Id;
        return new[]
        {
            // Top two roles are presented as SuperAdmin and Admin; the backend role keys stay
            // RoleKeys.SuperAdmin / RoleKeys.Director so all authorization is unaffected.
            // SuperAdmin has no department on purpose: it must be able to see everything.
            new SeedConstants.UserSpec("superadmin@org1.com", "Aarav", "Sharma", "ADMIN001", "SuperAdmin", RoleKeys.SuperAdmin, null, AvailabilityStatus.Available, 100, 92, 26, 0.08),
            new SeedConstants.UserSpec("admin@org1.com", "Priya", "Menon", "DIR001", "Admin", RoleKeys.Director, Dept("PWD"), AvailabilityStatus.PartiallyBusy, 72, 86, 58, 0.24),
            new SeedConstants.UserSpec("manager@org1.com", "Dev", "Kapoor", "PM001", "ProjectManager", RoleKeys.ProjectManager, Dept("PWD"), AvailabilityStatus.PartiallyBusy, 72, 86, 58, 0.24),
            new SeedConstants.UserSpec("head.eng@org1.com", "Rohan", "Iyer", "DH001", "Engineering Head", RoleKeys.DepartmentHead, Dept("PWDC"), AvailabilityStatus.Busy, 64, 84, 66, 0.31),
            new SeedConstants.UserSpec("head.pmo@org1.com", "Sita", "Rao", "DH002", "PMO Head", RoleKeys.DepartmentHead, Dept("PWD"), AvailabilityStatus.PartiallyBusy, 70, 88, 54, 0.20),
            new SeedConstants.UserSpec("head.ops@org1.com", "Vikram", "Singh", "DH003", "Operations Head", RoleKeys.DepartmentHead, Dept("PROC"), AvailabilityStatus.Available, 84, 79, 44, 0.16),
            new SeedConstants.UserSpec("head.bstr@org1.com", "Meera", "Nair", "DH004", "Strategy Head", RoleKeys.DepartmentHead, Dept("REV"), AvailabilityStatus.Available, 100, 76, 35, 0.11),
            new SeedConstants.UserSpec("head.csv@org1.com", "Karan", "Verma", "DH005", "Client Services Head", RoleKeys.DepartmentHead, Dept("QA"), AvailabilityStatus.Available, 88, 73, 38, 0.12),
            new SeedConstants.UserSpec("member@org1.com", "Ananya", "Patel", "TM001", "TeamMember", RoleKeys.TeamMember, Dept("PWDC"), AvailabilityStatus.PartiallyBusy, 70, 88, 61, 0.25),
            new SeedConstants.UserSpec("viewer@org1.com", "Sneha", "Kulkarni", "VW001", "Viewer", RoleKeys.Viewer, Dept("PWD"), AvailabilityStatus.Available, 92, 60, 18, 0.05),

            // New government users - one per department
            new SeedConstants.UserSpec("rajesh.verma@pwd.up.gov.in", "Rajesh", "Verma", "CE001", "Chief Engineer", RoleKeys.ProjectManager, Dept("PWD"), AvailabilityStatus.Busy, 60, 90, 70, 0.30),
            new SeedConstants.UserSpec("sunil.yadav@up.gov.in", "Sunil", "Yadav", "REV001", "Tehsildar", RoleKeys.DepartmentHead, Dept("REV"), AvailabilityStatus.Available, 85, 75, 40, 0.15),
            new SeedConstants.UserSpec("vikas.gupta@up.gov.in", "Vikas", "Gupta", "APC001", "Senior Architect", RoleKeys.TeamMember, Dept("APC"), AvailabilityStatus.PartiallyBusy, 70, 82, 50, 0.20),
            new SeedConstants.UserSpec("amit.saxena@up.gov.in", "Amit", "Saxena", "TCP001", "Town Planner", RoleKeys.TeamMember, Dept("TCP"), AvailabilityStatus.Available, 90, 78, 35, 0.12),
            new SeedConstants.UserSpec("manoj.tiwari@up.gov.in", "Manoj", "Tiwari", "PROC001", "Procurement Officer", RoleKeys.TeamMember, Dept("PROC"), AvailabilityStatus.PartiallyBusy, 75, 80, 55, 0.22),
            new SeedConstants.UserSpec("dinesh.kumar@pwd.up.gov.in", "Dinesh", "Kumar", "PWDC001", "Executive Engineer", RoleKeys.TeamMember, Dept("PWDC"), AvailabilityStatus.Busy, 65, 85, 65, 0.28),
            new SeedConstants.UserSpec("pradeep.mishra@up.gov.in", "Pradeep", "Mishra", "JAL001", "Jal Nigam Engineer", RoleKeys.TeamMember, Dept("JAL"), AvailabilityStatus.PartiallyBusy, 70, 80, 48, 0.18),
            new SeedConstants.UserSpec("suresh.pandey@up.gov.in", "Suresh", "Pandey", "ELEC001", "Electrical Engineer", RoleKeys.TeamMember, Dept("ELEC"), AvailabilityStatus.Available, 88, 76, 42, 0.16),
            new SeedConstants.UserSpec("ramesh.yadav@up.gov.in", "Ramesh", "Yadav", "SEW001", "Sewerage Engineer", RoleKeys.TeamMember, Dept("SEW"), AvailabilityStatus.PartiallyBusy, 72, 78, 46, 0.19),
            new SeedConstants.UserSpec("harish.sharma@up.gov.in", "Harish", "Sharma", "HORT001", "Horticulture Officer", RoleKeys.TeamMember, Dept("HORT"), AvailabilityStatus.Available, 92, 72, 30, 0.10),
            new SeedConstants.UserSpec("alok.singh@pwd.up.gov.in", "Alok", "Singh", "QA001", "Quality Engineer", RoleKeys.TeamMember, Dept("QA"), AvailabilityStatus.Available, 85, 82, 38, 0.14),
        };
    }
}
