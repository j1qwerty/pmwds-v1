using System.Reflection;
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

    /// <summary>
    /// Scope probes elsewhere select codes by substring ("_All", "_Own"). Those probes only
    /// work because every code is upper case, and a lower-cased constant would silently stop
    /// matching - which is exactly how the project scope checks stopped honouring
    /// PROJECT_ALL_* permissions while every direct permission assertion still passed.
    /// </summary>
    [Fact]
    public void Every_permission_code_is_upper_case_so_scope_probes_match()
    {
        var codes = typeof(PermissionCodes)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(field => field.IsLiteral && !field.IsInitOnly && field.FieldType == typeof(string))
            // PermissionClaimType names the claim, not a permission, so it is not a code.
            .Where(field => field.Name != nameof(PermissionCodes.PermissionClaimType))
            .Select(field => (string)field.GetRawConstantValue()!)
            .ToList();

        codes.Should().NotBeEmpty();
        codes.Should().OnlyContain(code => code == code.ToUpperInvariant(),
            "scope probes compare \"_All\"/\"_Own\" against these codes");
    }

    /// <summary>
    /// A scoped manage permission must only widen within its own scope: an all-department
    /// manage may not hand out an own-department action, or vice versa.
    /// </summary>
    [Fact]
    public void Scoped_manage_permissions_never_cross_the_own_all_boundary()
    {
        var offenders = PermissionCatalog.ManagePermissionCoverage
            .Where(entry => entry.Key.Contains("_OWN_") || entry.Key.Contains("_ALL_"))
            .SelectMany(entry => entry.Value.Select(covered => (Manage: entry.Key, Covered: covered)))
            .Where(pair =>
                pair.Manage.Contains("_OWN_") ? pair.Covered.Contains("_ALL_")
                : pair.Manage.Contains("_ALL_") ? pair.Covered.Contains("_OWN_")
                : false)
            .ToList();

        offenders.Should().BeEmpty();
    }
}
