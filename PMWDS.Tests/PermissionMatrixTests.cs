using FluentAssertions;
using PMWDS.Application.Security;
using Xunit;

namespace PMWDS.Tests;

public class PermissionMatrixTests
{
    [Fact]
    public void Scoped_manage_permissions_cover_only_crud_actions()
    {
        PermissionCatalog.ManagePermissionCoverage[PermissionCodes.ProjectOwnManage]
            .Should().BeEquivalentTo(new[]
            {
                PermissionCodes.ProjectOwnView,
                PermissionCodes.ProjectOwnCreate,
                PermissionCodes.ProjectOwnEdit,
                PermissionCodes.ProjectOwnDelete
            });

        PermissionCatalog.ManagePermissionCoverage[PermissionCodes.DocumentAllManage]
            .Should().BeEquivalentTo(new[]
            {
                PermissionCodes.DocumentAllView,
                PermissionCodes.DocumentAllCreate,
                PermissionCodes.DocumentAllEdit,
                PermissionCodes.DocumentAllDelete
            });

        PermissionCatalog.ManagePermissionCoverage[PermissionCodes.DocumentAllManage]
            .Should().NotContain(PermissionCodes.DocumentAllProjectUpload);
    }

    [Fact]
    public void Legacy_permissions_map_to_all_department_scope()
    {
        PermissionCatalog.GetScopedAliases(PermissionCodes.ProjectManage)
            .Should().ContainSingle()
            .Which.Should().Be(PermissionCodes.ProjectAllManage);

        PermissionCatalog.GetScopedAliases(PermissionCodes.KnowledgeView)
            .Should().ContainSingle()
            .Which.Should().Be(PermissionCodes.KnowledgeAllView);
    }

    [Fact]
    public void Primary_department_is_not_part_of_project_manage_coverage()
    {
        PermissionCatalog.ManagePermissionCoverage[PermissionCodes.ProjectAllManage]
            .Should().NotContain(PermissionCodes.ProjectPrimaryDepartmentManage);
    }
}
