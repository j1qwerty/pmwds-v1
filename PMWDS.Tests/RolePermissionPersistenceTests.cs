using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>
/// The role editor sends the exact set of permission ids it wants a role to hold. Whatever
/// the editor sends and the editor is allowed to give must come back out of the API again,
/// otherwise the next save drops more permissions and the grid slowly empties itself.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class RolePermissionPersistenceTests
{
    private readonly ApiFixture _fixture;

    public RolePermissionPersistenceTests(ApiFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Saving_a_role_stores_every_selected_permission()
    {
        var superAdmin = _fixture.SuperAdmin.Client;

        var catalogue = await superAdmin.GetAsync<JsonElement>("/api/v1/roles/permissions");
        catalogue.Status.Should().Be(System.Net.HttpStatusCode.OK);

        var ids = catalogue.Data!.EnumerateArray()
            .ToDictionary(p => p.GetString("code") ?? "", p => p.GetGuid("id"), StringComparer.OrdinalIgnoreCase);

        // A spread that mixes umbrella codes with the permissions they cover, plus the
        // extras an umbrella does not imply (uploads, review, primary-department control).
        var wanted = new[]
        {
            "AI_VIEW",
            "AI_PROJECT_VIEW",
            "AI_MANAGE",
            "TASK_ALL_MANAGE",
            "TASK_ALL_ASSIGN",
            "TASK_ALL_COMMENT_CREATE",
            "PROJECT_ALL_MANAGE",
            "PROJECT_PRIMARY_DEPARTMENT_MANAGE",
            "UTILIZATION_CERTIFICATE_ALL_MANAGE",
            "UTILIZATION_CERTIFICATE_ALL_REVIEW",
            "UTILIZATION_CERTIFICATE_ALL_TASK_UPLOAD",
            "ROLE_MANAGE",
            "ROLE_VIEW",
            "ROLE_EDIT",
            "NOTIFICATION_ALL_MANAGE",
            "NOTIFICATION_VIEW",
            "KNOWLEDGE_VIEW",
            "KNOWLEDGE_EDIT",
        };

        foreach (var code in wanted)
        {
            ids.Should().ContainKey(code, $"'{code}' must exist to be assignable");
        }

        var name = $"Persist Probe {Guid.NewGuid():N}"[..24];
        var created = await superAdmin.PostAsync<JsonElement>("/api/v1/roles", new
        {
            name,
            description = "Round-trip probe.",
            permissionLevel = 15,
            paginationPageSize = 10,
            permissionIds = wanted.Select(code => ids[code]).ToArray(),
        });
        created.Status.Should().Be(System.Net.HttpStatusCode.Created);
        var roleId = created.Data!.GetGuid("id");

        try
        {
            var stored = await ReadRoleCodesAsync(superAdmin, roleId);
            stored.Should().BeEquivalentTo(wanted,
                "the API must persist exactly the permission ids the role editor submitted");

            // A second save with the same selection must not shrink the role either.
            var updated = await superAdmin.PutAsync<JsonElement>($"/api/v1/roles/{roleId}", new
            {
                name,
                description = "Round-trip probe.",
                permissionLevel = 15,
                paginationPageSize = 10,
                permissionIds = wanted.Select(code => ids[code]).ToArray(),
            });
            updated.Status.Should().Be(System.Net.HttpStatusCode.OK);

            var afterUpdate = await ReadRoleCodesAsync(superAdmin, roleId);
            afterUpdate.Should().BeEquivalentTo(wanted,
                "re-saving the same selection must be idempotent");
        }
        finally
        {
            (await superAdmin.DeleteAsync<JsonElement>($"/api/v1/roles/{roleId}"))
                .Status.Should().Be(System.Net.HttpStatusCode.NoContent);
        }
    }

    /// <summary>
    /// A Director may only hand out what it holds itself, so ORGANIZATION_VIEW is invisible
    /// in its copy of the role editor and never tickable. Saving the role must not read
    /// that as "remove it".
    /// </summary>
    [Fact]
    public async Task Saving_a_role_keeps_permissions_the_editor_cannot_grant()
    {
        var superAdmin = _fixture.SuperAdmin.Client;
        var director = _fixture.Admin;

        var ids = await ReadPermissionIdsAsync(superAdmin);
        var organizationViewId = ids["ORGANIZATION_VIEW"];
        var projectAllViewId = ids["PROJECT_ALL_VIEW"];

        var name = $"Preserve Probe {Guid.NewGuid():N}"[..24];
        var created = await superAdmin.PostAsync<JsonElement>("/api/v1/roles", new
        {
            name,
            description = "Preservation probe.",
            permissionLevel = 15,
            paginationPageSize = 10,
            permissionIds = new[] { organizationViewId, projectAllViewId },
        });
        created.Status.Should().Be(System.Net.HttpStatusCode.Created);
        var roleId = created.Data!.GetGuid("id");

        try
        {
            director.Permissions.Should().NotContain("ORGANIZATION_VIEW",
                "precondition: the Director cannot grant this one, so the editor never shows it");

            // Exactly what the Director's editor would submit: everything the role already
            // holds (it never renders the ones it cannot grant, so it cannot untick them
            // either) plus whatever the person actually changed.
            (await director.Client.PutAsync<JsonElement>($"/api/v1/roles/{roleId}", new
            {
                name,
                description = "Preservation probe.",
                permissionLevel = 15,
                paginationPageSize = 10,
                permissionIds = new[] { organizationViewId, projectAllViewId },
            })).Status.Should().Be(System.Net.HttpStatusCode.OK);

            var stored = await ReadRoleCodesAsync(superAdmin, roleId);
            stored.Should().Contain("ORGANIZATION_VIEW",
                "a save must not strip what the editor was never able to see");
            stored.Should().Contain("PROJECT_ALL_VIEW");
        }
        finally
        {
            (await superAdmin.DeleteAsync<JsonElement>($"/api/v1/roles/{roleId}"))
                .Status.Should().Be(System.Net.HttpStatusCode.NoContent);
        }
    }

    private static async Task<Dictionary<string, Guid>> ReadPermissionIdsAsync(ApiClient client)
    {
        var catalogue = await client.GetAsync<JsonElement>("/api/v1/roles/permissions");
        catalogue.Status.Should().Be(System.Net.HttpStatusCode.OK);

        return catalogue.Data!.EnumerateArray()
            .ToDictionary(p => p.GetString("code") ?? "", p => p.GetGuid("id"), StringComparer.OrdinalIgnoreCase);
    }

    private static async Task<string[]> ReadRoleCodesAsync(ApiClient client, Guid roleId)
    {
        var roles = await client.GetAsync<JsonElement>("/api/v1/roles");
        roles.Status.Should().Be(System.Net.HttpStatusCode.OK);

        var role = roles.Data!.EnumerateArray()
            .Single(r => r.GetGuid("id") == roleId);

        return role.GetProperty("permissions").EnumerateArray()
            .Select(p => p.GetString("code") ?? "")
            .ToArray();
    }

    /// <summary>
    /// The reported symptom end to end: an admin grants the AI project permission to the
    /// TeamMember role from the role editor, and the TeamMember then has to actually get
    /// it - in the token they log in with and at the endpoint that checks it. Saving the
    /// role must not quietly shrink the set on the way.
    /// </summary>
    [Fact]
    public async Task Granting_the_ai_project_permission_to_team_member_takes_effect_after_a_save()
    {
        var superAdmin = _fixture.SuperAdmin.Client;
        var http = _fixture.CreateAnonymousClient();

        var catalogue = await superAdmin.GetAsync<JsonElement>("/api/v1/roles/permissions");
        var catalogueIds = catalogue.Data!.EnumerateArray()
            .ToDictionary(p => p.GetString("code"), p => p.GetGuid("id"), StringComparer.OrdinalIgnoreCase);

        // "Grant all" on the AI group: the manage code plus the two views it covers. Folding
        // the covered views away here is what used to empty the AI group on every save.
        var aiGroup = new[] { "AI_MANAGE", "AI_VIEW", "AI_PROJECT_VIEW" };
        var aiIds = aiGroup.Select(code => catalogueIds[code]).ToArray();

        var roles = await superAdmin.GetAsync<JsonElement>("/api/v1/roles");
        var teamMember = roles.Data!.EnumerateArray()
            .Single(r => r.GetString("key") == "team-member");
        var roleId = teamMember.GetGuid("id");
        var originalIds = teamMember.GetProperty("permissions").EnumerateArray()
            .Select(p => p.GetGuid("id"))
            .ToArray();

        var grantedIds = originalIds.Concat(aiIds).Distinct().ToArray();

        var saveBody = new
        {
            name = teamMember.GetString("name"),
            description = teamMember.GetString("description"),
            permissionLevel = teamMember.GetProperty("permissionLevel").GetInt32(),
            paginationPageSize = 10,
            permissionIds = grantedIds,
        };

        // A project the TeamMember can already see, in the department they belong to, so
        // the only thing that decides the AI tab is the permission under test.
        var director = _fixture.Admin.Client;
        var pwdc = await WizardFlowTests.DepartmentForCodeAsync(director, "PWDC");
        var project = await new WizardBuilder(director)
            .WithName($"AI Grant {Guid.NewGuid():N}"[..24])
            .WithDepartments(pwdc)
            .BuildAsync();

        try
        {
            using var before = await Session.LoginAsync(http, SeededUsers.TeamMember);
            var capabilitiesBefore = await before.Client.GetAsync<JsonElement>(
                $"/api/v1/ai/project/{project.ProjectId}/capabilities");
            capabilitiesBefore.Status.Should().Be(System.Net.HttpStatusCode.OK,
                $"precondition: the TeamMember must already see the project ({capabilitiesBefore.RawBody})");
            capabilitiesBefore.Data!.GetProperty("ai").GetBoolean().Should().BeFalse(
                "precondition: the TeamMember starts without the AI project permission");

            (await superAdmin.PutAsync<JsonElement>($"/api/v1/roles/{roleId}", saveBody))
                .Status.Should().Be(System.Net.HttpStatusCode.OK);

            var stored = await ReadRoleCodesAsync(superAdmin, roleId);
            stored.Should().Contain("AI_PROJECT_VIEW",
                "the editor ticked it, so the role must hold it");
            stored.Should().Contain("AI_VIEW",
                "a manage code must not swallow the views it covers");
            stored.Should().Contain("PROJECT_OWN_VIEW",
                "the permissions the role started with must survive the save");

            // Saving the same selection again must not shrink it any further.
            (await superAdmin.PutAsync<JsonElement>($"/api/v1/roles/{roleId}", saveBody))
                .Status.Should().Be(System.Net.HttpStatusCode.OK);
            (await ReadRoleCodesAsync(superAdmin, roleId)).Should().BeEquivalentTo(stored,
                "a repeated save must be idempotent");

            using var after = await Session.LoginAsync(http, SeededUsers.TeamMember);
            after.Permissions.Should().Contain("AI_PROJECT_VIEW",
                "the permission has to survive into the session the TeamMember logs in with");

            // RoleScopeService memoises a user's permission set in IMemoryCache for five
            // seconds, and the probe above just primed it. Wait it out so the second call
            // reads the role we just saved rather than the pre-save snapshot.
            await Task.Delay(TimeSpan.FromSeconds(6));

            var capabilitiesAfter = await after.Client.GetAsync<JsonElement>(
                $"/api/v1/ai/project/{project.ProjectId}/capabilities");
            capabilitiesAfter.Status.Should().Be(System.Net.HttpStatusCode.OK);
            capabilitiesAfter.Data!.GetProperty("ai").GetBoolean().Should().BeTrue(
                "the saved permission has to switch the project AI tab on");
        }
        finally
        {
            (await superAdmin.PutAsync<JsonElement>($"/api/v1/roles/{roleId}", new
            {
                name = teamMember.GetString("name"),
                description = teamMember.GetString("description"),
                permissionLevel = teamMember.GetProperty("permissionLevel").GetInt32(),
                paginationPageSize = 10,
                permissionIds = originalIds,
            })).Status.Should().Be(System.Net.HttpStatusCode.OK);

            (await superAdmin.DeleteAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}"))
                .Status.Should().Be(System.Net.HttpStatusCode.NoContent);
        }
    }
}
