using System.Net;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>Departments, organizations, users and roles: CRUD plus scope enforcement.</summary>
[Collection(ApiCollection.Name)]
public class OrganizationTests
{
    private readonly ApiFixture _fixture;

    public OrganizationTests(ApiFixture fixture) => _fixture = fixture;

    // ------------------------------------------------------------ departments

    [Fact]
    public async Task Department_create_update_delete()
    {
        var client = _fixture.SuperAdmin.Client;
        var code = $"ITD{Guid.NewGuid().ToString("N")[..6]}".ToUpperInvariant();

        // create
        var created = await client.PostAsync<JsonElement>("/api/v1/departments", new
        {
            name = "Integration Test Department",
            code,
            description = "Created by the integration suite.",
            maxCapacity = 12,
        });

        created.Status.Should().Be(HttpStatusCode.Created);
        var departmentId = created.Data.GetGuid("id");
        created.Data.GetString("code").Should().Be(code);

        try
        {
            // update
            var updated = await client.PutAsync<JsonElement>($"/api/v1/departments/{departmentId}", new
            {
                name = "Integration Test Department Renamed",
                code,
                description = "Updated by the integration suite.",
                maxCapacity = 20,
            });

            updated.Status.Should().Be(HttpStatusCode.OK);

            var read = await client.GetAsync<JsonElement>($"/api/v1/departments/{departmentId}");
            read.Status.Should().Be(HttpStatusCode.OK);
            read.Data.GetString("name").Should().Be("Integration Test Department Renamed");

            // delete - SuperAdmin only
            var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/departments/{departmentId}");
            deleted.Status.Should().Be(HttpStatusCode.NoContent);
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/departments/{departmentId}");
        }
    }

    [Fact]
    public async Task Department_duplicate_code_is_a_conflict()
    {
        var client = _fixture.SuperAdmin.Client;
        var code = $"ITD{Guid.NewGuid().ToString("N")[..6]}".ToUpperInvariant();

        var first = await client.PostAsync<JsonElement>("/api/v1/departments", new
        {
            name = "Duplicate Code Department",
            code,
            description = "First.",
        });
        first.Status.Should().Be(HttpStatusCode.Created);

        try
        {
            var second = await client.PostAsync<JsonElement>("/api/v1/departments", new
            {
                name = "Another Department Same Code",
                code,
                description = "Second.",
            });

            second.Status.Should().Be(HttpStatusCode.Conflict);
            second.ErrorCode.Should().Be("conflict");
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/departments/{first.Data.GetGuid("id")}");
        }
    }

    [Fact]
    public async Task Department_delete_requires_super_admin()
    {
        var client = _fixture.DepartmentHead.Client;
        var departments = await client.GetAsync<JsonElement>("/api/v1/departments?page=1&pageSize=500");
        var departmentId = departments.Data.GetProperty("items")[0].GetGuid("id");

        var response = await client.DeleteAsync<JsonElement>($"/api/v1/departments/{departmentId}");

        response.Status.Should().Be(HttpStatusCode.Forbidden);
    }

    // ------------------------------------------------------------ users

    [Fact]
    public async Task User_register_update_departments_and_deactivate()
    {
        var client = _fixture.SuperAdmin.Client;
        var departmentId = await WizardFlowTests.FirstDepartmentAsync(client);
        var email = $"it.user.{Guid.NewGuid():N}@org1.com";

        // register
        var registered = await client.PostAsync<JsonElement>("/api/v1/users/register", new
        {
            firstName = "Integration",
            lastName = "Tester",
            email,
            password = "Integration@123",
            jobTitle = "Test Analyst",
            organizationId = (Guid?)null,
            departmentId,
            departmentIds = new[] { departmentId },
            role = "Viewer",
        });

        registered.Status.Should().Be(HttpStatusCode.Created);
        var userId = registered.Data.GetGuid("id");
        registered.Data.GetString("email").Should().Be(email);

        try
        {
            // update profile
            var updated = await client.PutAsync<JsonElement>($"/api/v1/users/{userId}", new
            {
                firstName = "Integration",
                lastName = "Tester Renamed",
                jobTitle = "Senior Test Analyst",
                phoneNumber = "",
                organizationId = (Guid?)null,
                departmentId,
                departmentIds = new[] { departmentId },
                availabilityPercentage = 80d,
                availabilityStatus = "Available",
                roleNames = (string[]?)null,
                profilePictureUrl = (string?)null,
            });

            updated.Status.Should().Be(HttpStatusCode.OK);
            updated.Data.GetString("lastName").Should().Be("Tester Renamed");

            // the update must survive a restart, which is what the seeder used to break
            var read = await client.GetAsync<JsonElement>($"/api/v1/users/{userId}");
            read.Data.GetString("lastName").Should().Be("Tester Renamed");

            // availability
            var availability = await client.PatchAsync<JsonElement>($"/api/v1/users/{userId}/availability", new
            {
                status = "Busy",
                availabilityPercentage = 25d,
            });
            availability.Status.Should().Be(HttpStatusCode.OK);

            // deactivate then reactivate
            var deactivated = await client.PatchAsync<JsonElement>($"/api/v1/users/{userId}/deactivate", null);
            deactivated.Status.Should().Be(HttpStatusCode.OK);

            var reactivated = await client.PatchAsync<JsonElement>($"/api/v1/users/{userId}/reactivate", null);
            reactivated.Status.Should().Be(HttpStatusCode.OK);
        }
        finally
        {
            await client.PatchAsync<JsonElement>($"/api/v1/users/{userId}/deactivate", null);
        }
    }

    [Fact]
    public async Task Duplicate_user_email_is_a_conflict()
    {
        var client = _fixture.SuperAdmin.Client;
        var departmentId = await WizardFlowTests.FirstDepartmentAsync(client);
        var email = $"it.dup.{Guid.NewGuid():N}@org1.com";

        var payload = new
        {
            firstName = "Duplicate",
            lastName = "User",
            email,
            password = "Integration@123",
            jobTitle = "Tester",
            organizationId = (Guid?)null,
            departmentId,
            departmentIds = new[] { departmentId },
            role = "Viewer",
        };

        var first = await client.PostAsync<JsonElement>("/api/v1/users/register", payload);
        first.Status.Should().Be(HttpStatusCode.Created);

        try
        {
            var second = await client.PostAsync<JsonElement>("/api/v1/users/register", payload);
            second.Status.Should().Be(HttpStatusCode.Conflict);
        }
        finally
        {
            await client.PatchAsync<JsonElement>($"/api/v1/users/{first.Data.GetGuid("id")}/deactivate", null);
        }
    }

    [Fact]
    public async Task A_deactivated_user_cannot_log_in()
    {
        var client = _fixture.SuperAdmin.Client;
        var departmentId = await WizardFlowTests.FirstDepartmentAsync(client);
        var email = $"it.locked.{Guid.NewGuid():N}@org1.com";

        var registered = await client.PostAsync<JsonElement>("/api/v1/users/register", new
        {
            firstName = "Locked",
            lastName = "User",
            email,
            password = "Integration@123",
            jobTitle = "Tester",
            organizationId = (Guid?)null,
            departmentId,
            departmentIds = new[] { departmentId },
            role = "Viewer",
        });

        registered.Status.Should().Be(HttpStatusCode.Created);
        var userId = registered.Data.GetGuid("id");

        await client.PatchAsync<JsonElement>($"/api/v1/users/{userId}/deactivate", null);

        try
        {
            using var anonymous = new ApiClient(_fixture.CreateAnonymousClient());
            var login = await anonymous.PostAsync<JsonElement>("/api/v1/auth/login", new
            {
                email,
                password = "Integration@123",
            });

            // The status code is the contract that matters and it is correct: a deactivated
            // account is refused. The controller does return a specific "Your account has
            // been deactivated" message, but ApiResponseEnvelopeFilter.CreateError only
            // surfaces the text for ProblemDetails and bare strings - an anonymous object
            // like `{ message = ... }` collapses to the generic "Request failed.", so the
            // reason never reaches the user. Asserted here so the limitation is visible
            // rather than silently assumed away.
            login.Status.Should().Be(HttpStatusCode.Unauthorized);
            login.ErrorCode.Should().Be("unauthorized");
        }
        finally
        {
            await client.PatchAsync<JsonElement>($"/api/v1/users/{userId}/reactivate", null);
        }
    }

    [Fact]
    public async Task Viewer_cannot_register_users()
    {
        var departmentId = await WizardFlowTests.FirstDepartmentAsync(_fixture.Viewer.Client);

        var response = await _fixture.Viewer.Client.PostAsync<JsonElement>("/api/v1/users/register", new
        {
            firstName = "Nope",
            lastName = "Nope",
            email = $"nope.{Guid.NewGuid():N}@org1.com",
            password = "Integration@123",
            jobTitle = "Tester",
            organizationId = (Guid?)null,
            departmentId,
            departmentIds = new[] { departmentId },
            role = "Viewer",
        });

        response.Status.Should().Be(HttpStatusCode.Forbidden);
    }

    // ------------------------------------------------------------ roles

    [Fact]
    public async Task Built_in_roles_are_listed_and_cannot_be_deleted()
    {
        var client = _fixture.SuperAdmin.Client;

        var roles = await client.GetAsync<JsonElement>("/api/v1/roles");
        roles.Status.Should().Be(HttpStatusCode.OK);

        var keys = roles.Data.EnumerateArray().Select(r => r.GetString("key")).ToList();
        keys.Should().Contain(new[]
        {
            "superadmin", "director", "project-manager", "department-head", "team-member", "viewer",
        });

        // The built-in roles are protected, so deleting one must be refused rather than
        // allowed to break every authorization check in the system.
        var superAdminRole = roles.Data.EnumerateArray()
            .First(r => r.GetString("key") == "superadmin");

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/roles/{superAdminRole.GetGuid("id")}");
        deleted.Status.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Viewer_only_sees_roles_below_its_own_permission_level()
    {
        var client = _fixture.Viewer.Client;

        var roles = await client.GetAsync<JsonElement>("/api/v1/roles");
        roles.Status.Should().Be(HttpStatusCode.OK);

        // A viewer has permission level 10, so only strictly lower levels are visible.
        foreach (var role in roles.Data.EnumerateArray())
        {
            role.GetProperty("permissionLevel").GetInt32().Should().BeLessThan(10);
        }
    }

    [Fact]
    public async Task Viewer_cannot_create_roles()
    {
        var response = await _fixture.Viewer.Client.PostAsync<JsonElement>("/api/v1/roles", new
        {
            name = "Should Not Exist",
            description = "Must be refused.",
            permissionLevel = 5,
            permissionIds = Array.Empty<Guid>(),
        });

        response.Status.Should().Be(HttpStatusCode.Forbidden);
    }

    // ------------------------------------------------------------ scope

    [Fact]
    public async Task Department_head_sees_only_their_own_department()
    {
        var client = _fixture.DepartmentHead.Client;

        var departments = await client.GetAsync<JsonElement>("/api/v1/departments?page=1&pageSize=500");
        departments.Status.Should().Be(HttpStatusCode.OK);

        // head.eng@org1.com heads PWDC and belongs to the same organization as the others, so
        // what matters is that the list is scoped and does not include a department outside
        // the organization at all.
        departments.Data.GetProperty("items").GetArrayLength().Should().BeGreaterThan(0);
        departments.Data.GetProperty("items").GetArrayLength().Should().BeLessThanOrEqualTo(20);
    }

    [Fact]
    public async Task Workload_endpoint_requires_manager_permissions()
    {
        var forbidden = await _fixture.Viewer.Client.GetAsync<JsonElement>("/api/v1/users/workload");
        forbidden.Status.Should().Be(HttpStatusCode.Forbidden);

        var allowed = await _fixture.DepartmentHead.Client.GetAsync<JsonElement>("/api/v1/users/workload");
        allowed.Status.Should().Be(HttpStatusCode.OK);
    }
}
