using System.Net;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>Login, token handling, and the authorization boundary for each seeded role.</summary>
[Collection(ApiCollection.Name)]
public class AuthenticationTests
{
    private readonly ApiFixture _fixture;

    public AuthenticationTests(ApiFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Every_seeded_identity_can_log_in()
    {
        // Role names as stored. Note the top two are presented as SuperAdmin/Admin in the UI
        // but the seeded role name for the second is "Director" - its backend role key stays
        // RoleKeys.Director so authorization is unaffected.
        _fixture.SuperAdmin.Roles.Should().Contain("SuperAdmin");
        _fixture.Admin.Roles.Should().Contain("Director");
        _fixture.DepartmentHead.Roles.Should().Contain("DepartmentHead");
        _fixture.ProjectManager.Roles.Should().Contain("ProjectManager");
        _fixture.TeamMember.Roles.Should().Contain("TeamMember");
        _fixture.Viewer.Roles.Should().Contain("Viewer");
    }

    /// <summary>
    /// Guards the fixture itself. ApiClient.UseToken writes to HttpClient.DefaultRequestHeaders,
    /// so if two sessions ever shared a client the tokens would overwrite each other and the
    /// "permission sets differ by role" test would pass for the wrong reason.
    /// </summary>
    [Fact]
    public async Task Sessions_do_not_share_a_bearer_token()
    {
        _fixture.SuperAdmin.Client.Token.Should().NotBe(_fixture.Viewer.Client.Token);
        _fixture.Admin.Client.Token.Should().NotBe(_fixture.Viewer.Client.Token);

        // Each client must still authenticate as its own identity.
        var me = await _fixture.Viewer.Client.GetAsync<JsonElement>("/api/v1/users/me");
        me.Status.Should().Be(HttpStatusCode.OK);
        me.Data.GetString("email").Should().Be(SeededUsers.Viewer);

        var meAsSuperAdmin = await _fixture.SuperAdmin.Client.GetAsync<JsonElement>("/api/v1/users/me");
        meAsSuperAdmin.Data.GetString("email").Should().Be(SeededUsers.SuperAdmin);
    }

    [Fact]
    public async Task Login_returns_a_usable_bearer_token()
    {
        using var client = new ApiClient(_fixture.CreateAnonymousClient());

        var login = await client.PostAsync<JsonElement>("/api/v1/auth/login", new
        {
            email = SeededUsers.SuperAdmin,
            password = SeededUsers.Password,
        });

        login.Status.Should().Be(HttpStatusCode.OK);
        login.Data!.GetString("token").Should().NotBeNullOrWhiteSpace();
        login.Data.GetString("userId").Should().NotBeEmpty();

        client.UseToken(login.Data.GetString("token"));
        var me = await client.GetAsync<JsonElement>("/api/v1/users/me");
        me.Status.Should().Be(HttpStatusCode.OK);
        me.Data!.GetString("email").Should().Be(SeededUsers.SuperAdmin);
    }

    [Fact]
    public async Task Wrong_password_is_rejected_with_401()
    {
        using var client = new ApiClient(_fixture.CreateAnonymousClient());

        var login = await client.PostAsync<JsonElement>("/api/v1/auth/login", new
        {
            email = SeededUsers.SuperAdmin,
            password = "definitely-not-the-password",
        });

        login.Status.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Unknown_email_is_rejected_with_401()
    {
        using var client = new ApiClient(_fixture.CreateAnonymousClient());

        var login = await client.PostAsync<JsonElement>("/api/v1/auth/login", new
        {
            email = "nobody@nowhere.test",
            password = SeededUsers.Password,
        });

        login.Status.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_validates_its_input()
    {
        using var client = new ApiClient(_fixture.CreateAnonymousClient());

        var login = await client.PostAsync<JsonElement>("/api/v1/auth/login", new { email = "", password = "" });

        login.Status.Should().Be(HttpStatusCode.BadRequest);
        login.ErrorCode.Should().Be("validation_failed");
    }

    [Fact]
    public async Task Protected_endpoints_reject_anonymous_callers()
    {
        using var client = new ApiClient(_fixture.CreateAnonymousClient());
        client.UseToken(null);

        var projects = await client.GetAsync<JsonElement>("/api/v1/projects");
        projects.Status.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Garbage_token_is_rejected()
    {
        using var client = new ApiClient(_fixture.CreateAnonymousClient());
        client.UseToken("not.a.real.jwt");

        var projects = await client.GetAsync<JsonElement>("/api/v1/projects");
        projects.Status.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("PROJECT_MANAGE")]
    [InlineData("MILESTONE_MANAGE")]
    [InlineData("TASK_MANAGE")]
    public async Task SuperAdmin_holds_every_umbrella_permission(string permission)
        => _fixture.SuperAdmin.Can(permission).Should().BeTrue();

    [Fact]
    public async Task Permission_sets_differ_by_role()
    {
        // The core of the seeded role model. If these collapse, the whole permission layer
        // is broken and every other authorization test becomes meaningless.
        _fixture.SuperAdmin.Can("PROJECT_MANAGE").Should().BeTrue();

        _fixture.DepartmentHead.Can("PROJECT_MANAGE").Should().BeTrue();
        _fixture.DepartmentHead.Can("MILESTONE_MANAGE").Should().BeTrue();

        _fixture.ProjectManager.Can("PROJECT_MANAGE").Should().BeTrue();

        _fixture.Viewer.Can("PROJECT_MANAGE").Should().BeFalse();
        _fixture.Viewer.Can("TASK_EDIT").Should().BeFalse();
        _fixture.Viewer.Can("PROJECT_VIEW").Should().BeTrue();

        // Department heads carry the finance sign-off; viewers do not.
        _fixture.DepartmentHead.Can("UTILIZATION_CERTIFICATE_REVIEW").Should().BeTrue();
        _fixture.Viewer.Can("UTILIZATION_CERTIFICATE_REVIEW").Should().BeFalse();
    }
}
