using System.Net;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>
/// Smoke coverage for the list endpoints the client calls on page load.
///
/// The suite runs against SQLite, which is the point. Two of these endpoints built their
/// results from a collection-correlated <c>SelectMany</c>, which EF translates to SQL Server's
/// <c>APPLY</c>. That compiled and ran fine on SQL Server, so the breakage was invisible until
/// the application fell back to SQLite and returned 500 for the organizations and users lists -
/// taking the departments, users, profiles and activity-log pages down with them.
///
/// Every endpoint here is asserted on status only. The point of the test is "this query
/// translates on this provider", not the shape of the payload.
/// </summary>
[Collection(ApiCollection.Name)]
public class ListEndpointTests
{
    private readonly ApiFixture _fixture;

    public ListEndpointTests(ApiFixture fixture) => _fixture = fixture;

    /// <summary>Every list endpoint the client loads on sign-in, for one seeded identity.</summary>
    public static TheoryData<string> ListPaths => new()
    {
        "/api/v1/organizations",
        "/api/v1/organizations?page=1&pageSize=500",
        "/api/v1/departments",
        "/api/v1/departments?page=1&pageSize=500",
        "/api/v1/users",
        "/api/v1/users?pageSize=500",
        "/api/v1/users/me",
        "/api/v1/roles",
        "/api/v1/roles/permissions",
        "/api/v1/skills",
        "/api/v1/projects",
        "/api/v1/tasks?page=1&pageSize=50",
        "/api/v1/notifications",
        "/api/v1/activitylogs?count=50",
        "/api/v1/activitylogs/all?count=50",
        "/api/v1/activitylogs/team?count=50",
        "/api/v1/workspace/bootstrap",
        "/api/v1/projects/dashboard",
    };

    [Theory]
    [MemberData(nameof(ListPaths))]
    public async Task List_endpoint_succeeds_for_super_admin(string path)
        => await AssertListsSucceed(_fixture.SuperAdmin, path);

    /// <summary>
    /// The same sweep as a non-superadmin. Several endpoints resolve the caller's effective
    /// permissions by walking roles and their permissions; that path is skipped entirely for a
    /// superadmin, so without this it would never run in the suite.
    /// </summary>
    [Theory]
    [MemberData(nameof(ListPaths))]
    public async Task List_endpoint_succeeds_for_director(string path)
        => await AssertListsSucceed(_fixture.Admin, path);

    private async Task AssertListsSucceed(Session session, string path)
    {
        var response = await session.Client.GetAsync<JsonElement>(path);

        response.Status.Should().Be(
            HttpStatusCode.OK,
            because: $"{path} must translate on every supported database provider " +
                     $"for {session.Email}");
    }

    /// <summary>
    /// The organizations list embeds a director summary per organization, which was the
    /// collection-correlated query that broke. Assert the summary actually resolved so the
    /// test cannot pass by returning organizations with a permanently null director.
    /// </summary>
    [Fact]
    public async Task Organization_list_includes_director_summaries()
    {
        var response = await _fixture.SuperAdmin.Client.GetAsync<JsonElement>("/api/v1/organizations");
        response.Status.Should().Be(HttpStatusCode.OK);

        var organizations = response.Data.GetProperty("items").EnumerateArray().ToList();
        organizations.Should().NotBeEmpty();

        // At least one organization is seeded with a director, so the join must find them.
        var withDirector = organizations.Where(organization =>
        {
            if (!organization.TryGetProperty("director", out var director)) return false;
            if (director.ValueKind != JsonValueKind.Object) return false;
            return !string.IsNullOrWhiteSpace(director.GetProperty("fullName").GetString());
        }).ToList();

        withDirector.Should().NotBeEmpty(
            because: "the director summary join must return rows, not silently none");
    }

    /// <summary>
    /// Effective permissions are resolved by crossing user -> roles -> permissions. That walk was
    /// rewritten to stay translatable on SQLite, so assert it still returns rows - a silently
    /// empty permission set would degrade every authorization decision into a 403 at runtime
    /// rather than failing loudly.
    /// </summary>
    [Theory]
    [MemberData(nameof(ListPaths))]
    public async Task Bootstrap_resolves_effective_permissions(string path)
    {
        if (path != "/api/v1/workspace/bootstrap")
        {
            return;
        }

        var response = await _fixture.SuperAdmin.Client.GetAsync<JsonElement>(path);
        response.Status.Should().Be(HttpStatusCode.OK);

        var permissions = ReadStrings(response.Data, "permissions");
        permissions.Should().NotBeEmpty(
            because: "the role -> permission walk must return rows, not silently none");
    }

    /// <summary>
    /// The users list resolves each user's roles. Roles are read from the UserRoles join table,
    /// which also had to be rewritten to avoid APPLY.
    /// </summary>
    [Fact]
    public async Task User_list_resolves_roles()
    {
        var response = await _fixture.SuperAdmin.Client.GetAsync<JsonElement>("/api/v1/users?pageSize=500");
        response.Status.Should().Be(HttpStatusCode.OK);

        var users = response.Data.GetProperty("items").EnumerateArray().ToList();
        users.Should().NotBeEmpty();

        var withRoles = users.Where(user =>
        {
            if (!user.TryGetProperty("roles", out var roles)) return false;
            if (roles.ValueKind != JsonValueKind.Array) return false;
            return roles.GetArrayLength() > 0;
        }).ToList();

        withRoles.Should().NotBeEmpty(
            because: "every seeded user carries a role, so the UserRoles join must resolve");
    }

    private static List<string> ReadStrings(JsonElement element, string property)
        => element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().Select(item => item.GetString() ?? string.Empty).ToList()
            : [];
}