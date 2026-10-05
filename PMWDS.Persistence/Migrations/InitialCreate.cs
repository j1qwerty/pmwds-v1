using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260630000000_InitialCreate")]
public partial class InitialCreate : Migration
{
   protected override void Up(MigrationBuilder m)
   {
      // Organizations
      m.CreateTable("Organizations", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Name = t.Column<string>(maxLength: 200, nullable: false),
         TaxId = t.Column<string>(maxLength: 100, nullable: false),
         Address = t.Column<string>(maxLength: 500, nullable: false),
         ContactEmail = t.Column<string>(maxLength: 200, nullable: false),
         ContactPhone = t.Column<string>(maxLength: 50, nullable: false),
         FoundedDate = t.Column<DateTime>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_Organizations", x => x.Id));
      m.CreateIndex("IX_Organizations_Name", "Organizations", "Name", unique: true);
      m.CreateIndex("IX_Organizations_TaxId", "Organizations", "TaxId", unique: true, filter: "[TaxId] IS NOT NULL AND [TaxId] <> ''");

      // Departments
      m.CreateTable("Departments", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Name = t.Column<string>(maxLength: 200, nullable: false),
         Code = t.Column<string>(maxLength: 50, nullable: false),
         Description = t.Column<string>(maxLength: 500, nullable: true),
         ParentDepartmentId = t.Column<Guid>(nullable: true),
         DepartmentHeadUserId = t.Column<string>(maxLength: 100, nullable: true),
         MaxCapacity = t.Column<int>(nullable: false),
         OrganizationId = t.Column<Guid>(nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_Departments", x => x.Id);
         t.ForeignKey("FK_Departments_Organizations_OrganizationId", x => x.OrganizationId, "Organizations", "Id", onDelete: ReferentialAction.SetNull);
         t.ForeignKey("FK_Departments_Departments_ParentDepartmentId", x => x.ParentDepartmentId, "Departments", "Id", onDelete: ReferentialAction.Restrict);
      });
      m.CreateIndex("IX_Departments_ParentDepartmentId", "Departments", "ParentDepartmentId");
      m.CreateIndex("IX_Departments_OrganizationId_Code", "Departments", new[] { "OrganizationId", "Code" }, unique: true);
      m.CreateIndex("IX_Departments_OrganizationId_Name", "Departments", new[] { "OrganizationId", "Name" }, unique: true);

      // Users
      m.CreateTable("Users", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Email = t.Column<string>(maxLength: 256, nullable: false),
         FirstName = t.Column<string>(maxLength: 100, nullable: false),
         LastName = t.Column<string>(maxLength: 100, nullable: false),
         PhoneNumber = t.Column<string>(nullable: false),
         ProfilePictureUrl = t.Column<string>(nullable: true),
         TimeZone = t.Column<string>(maxLength: 100, nullable: false),
         DepartmentId = t.Column<Guid>(nullable: true),
         JobTitle = t.Column<string>(maxLength: 200, nullable: false),
         EmployeeCode = t.Column<string>(maxLength: 50, nullable: false),
         AvailabilityStatus = t.Column<string>(maxLength: 30, nullable: false),
         AvailabilityPercentage = t.Column<decimal>(type: "decimal(5,2)", nullable: false),
         AIPerformanceScore = t.Column<decimal>(type: "decimal(5,2)", nullable: false),
         AIWorkloadScore = t.Column<decimal>(type: "decimal(5,2)", nullable: false),
         AIBurnoutRiskScore = t.Column<decimal>(type: "decimal(5,4)", nullable: false),
         LastAIScoreUpdate = t.Column<DateTime>(nullable: true),
         PasswordHash = t.Column<string>(nullable: true),
         PasswordResetTokenHash = t.Column<string>(maxLength: 128, nullable: true),
         PasswordResetTokenExpiresAt = t.Column<DateTime>(nullable: true),
         RefreshTokenHash = t.Column<string>(maxLength: 128, nullable: true),
         RefreshTokenExpiresAt = t.Column<DateTime>(nullable: true),
         RefreshTokenRevokedAt = t.Column<DateTime>(nullable: true),
         AccessTokenVersion = t.Column<int>(nullable: false, defaultValue: 0),
         OrganizationId = t.Column<Guid>(nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_Users", x => x.Id);
         t.ForeignKey("FK_Users_Departments_DepartmentId", x => x.DepartmentId, "Departments", "Id");
         t.ForeignKey("FK_Users_Organizations_OrganizationId", x => x.OrganizationId, "Organizations", "Id", onDelete: ReferentialAction.Restrict);
      });
      m.CreateIndex("IX_Users_DepartmentId", "Users", "DepartmentId");
      m.CreateIndex("IX_Users_Email", "Users", "Email", unique: true);
      m.CreateIndex("IX_Users_EmployeeCode", "Users", "EmployeeCode", unique: true);
      m.CreateIndex("IX_Users_OrganizationId", "Users", "OrganizationId");

      // Skills
      m.CreateTable("Skills", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Name = t.Column<string>(nullable: false),
         Category = t.Column<string>(nullable: false),
         Description = t.Column<string>(nullable: false),
         ParentSkillId = t.Column<string>(nullable: true),
         OrganizationId = t.Column<Guid>(nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_Skills", x => x.Id);
         t.ForeignKey("FK_Skills_Organizations_OrganizationId", x => x.OrganizationId, "Organizations", "Id");
      });
      m.CreateIndex("IX_Skills_OrganizationId", "Skills", "OrganizationId");

      // UserSkills
      m.CreateTable("UserSkills", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         UserId = t.Column<Guid>(nullable: false),
         SkillId = t.Column<Guid>(nullable: false),
         ProficiencyLevel = t.Column<int>(nullable: false),
         ExperienceMonths = t.Column<int>(nullable: false),
         LastUsed = t.Column<DateTime>(nullable: false),
         AIConfidenceScore = t.Column<double>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_UserSkills", x => x.Id);
         t.ForeignKey("FK_UserSkills_Users_UserId", x => x.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_UserSkills_Skills_SkillId", x => x.SkillId, "Skills", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_UserSkills_SkillId", "UserSkills", "SkillId");
      m.CreateIndex("IX_UserSkills_UserId", "UserSkills", "UserId");

      // UserProfiles
      m.CreateTable("UserProfiles", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         UserId = t.Column<Guid>(nullable: false),
         Bio = t.Column<string>(maxLength: 2000, nullable: true),
         JobTitle = t.Column<string>(maxLength: 200, nullable: true),
         DateOfBirth = t.Column<DateTime>(nullable: true),
         Address = t.Column<string>(maxLength: 500, nullable: true),
         EmergencyContact = t.Column<string>(maxLength: 200, nullable: true),
         LinkedInUrl = t.Column<string>(maxLength: 250, nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_UserProfiles", x => x.Id);
         t.ForeignKey("FK_UserProfiles_Users_UserId", x => x.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_UserProfiles_UserId", "UserProfiles", "UserId", unique: true);

      // UserDepartments
      m.CreateTable("UserDepartments", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         UserId = t.Column<Guid>(nullable: false),
         DepartmentId = t.Column<Guid>(nullable: false),
         IsPrimary = t.Column<bool>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_UserDepartments", x => x.Id);
         t.ForeignKey("FK_UserDepartments_Users_UserId", x => x.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_UserDepartments_Departments_DepartmentId", x => x.DepartmentId, "Departments", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_UserDepartments_DepartmentId", "UserDepartments", "DepartmentId");
      m.CreateIndex("IX_UserDepartments_IsPrimary", "UserDepartments", "IsPrimary");
      m.CreateIndex("IX_UserDepartments_UserId_DepartmentId", "UserDepartments", new[] { "UserId", "DepartmentId" }, unique: true);

      // Permissions
      m.CreateTable("Permissions", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Code = t.Column<string>(maxLength: 100, nullable: false),
         Name = t.Column<string>(maxLength: 150, nullable: false),
         Description = t.Column<string>(maxLength: 500, nullable: false),
         Module = t.Column<string>(maxLength: 100, nullable: false),
         IsGlobal = t.Column<bool>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_Permissions", x => x.Id));
      m.CreateIndex("IX_Permissions_Code", "Permissions", "Code", unique: true);
      m.CreateIndex("IX_Permissions_Module", "Permissions", "Module");

      // Roles
      m.CreateTable("Roles", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Key = t.Column<string>(maxLength: 100, nullable: false),
         Name = t.Column<string>(maxLength: 100, nullable: false),
         Description = t.Column<string>(maxLength: 500, nullable: false),
         PermissionLevel = t.Column<int>(nullable: false),
         PaginationPageSize = t.Column<int>(nullable: false, defaultValue: 10),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_Roles", x => x.Id));
      m.CreateIndex("IX_Roles_Key", "Roles", "Key", unique: true);
      m.CreateIndex("IX_Roles_Name", "Roles", "Name", unique: true);

      // RolePermissions (join table)
      m.CreateTable("RolePermissions", t => new
      {
         PermissionsId = t.Column<Guid>(nullable: false),
         RolesId = t.Column<Guid>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_RolePermissions", x => new { x.PermissionsId, x.RolesId });
         t.ForeignKey("FK_RolePermissions_Permissions_PermissionsId", x => x.PermissionsId, "Permissions", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_RolePermissions_Roles_RolesId", x => x.RolesId, "Roles", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_RolePermissions_RolesId", "RolePermissions", "RolesId");

      // UserRoles (join table)
      m.CreateTable("UserRoles", t => new
      {
         RolesId = t.Column<Guid>(nullable: false),
         UsersId = t.Column<Guid>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_UserRoles", x => new { x.RolesId, x.UsersId });
         t.ForeignKey("FK_UserRoles_Roles_RolesId", x => x.RolesId, "Roles", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_UserRoles_Users_UsersId", x => x.UsersId, "Users", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_UserRoles_UsersId", "UserRoles", "UsersId");

      // Projects
      m.CreateTable("Projects", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ProjectCode = t.Column<string>(maxLength: 50, nullable: false),
         Name = t.Column<string>(maxLength: 200, nullable: false),
         Description = t.Column<string>(maxLength: 2000, nullable: false),
         Category = t.Column<string>(maxLength: 100, nullable: false),
         Priority = t.Column<string>(maxLength: 20, nullable: false),
         Status = t.Column<string>(maxLength: 20, nullable: false),
         DepartmentId = t.Column<Guid>(nullable: false),
         ProjectManagerId = t.Column<Guid>(nullable: true),
         ClientName = t.Column<string>(nullable: true),
         StakeholderIds = t.Column<string>(nullable: true),
         PlannedStartDate = t.Column<DateTime>(nullable: false),
         PlannedEndDate = t.Column<DateTime>(nullable: false),
         ActualStartDate = t.Column<DateTime>(nullable: true),
         ActualEndDate = t.Column<DateTime>(nullable: true),
         BaselineEndDate = t.Column<DateTime>(nullable: false),
         PlannedBudget = t.Column<decimal>(type: "decimal(18,2)", nullable: false),
         ActualCost = t.Column<decimal>(type: "decimal(18,2)", nullable: false),
         ProgressPercentage = t.Column<double>(nullable: false),
         DelayJustification = t.Column<string>(nullable: true),
         AIHealthScore = t.Column<decimal>(type: "decimal(5,2)", nullable: false),
         AIDelayRiskScore = t.Column<decimal>(type: "decimal(5,4)", nullable: false),
         AIBudgetRiskScore = t.Column<decimal>(type: "decimal(5,4)", nullable: false),
         AIInsightsSummary = t.Column<string>(maxLength: 4000, nullable: true),
         LastAIAnalysis = t.Column<DateTime>(nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_Projects", x => x.Id);
         t.ForeignKey("FK_Projects_Departments_DepartmentId", x => x.DepartmentId, "Departments", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_Projects_Users_ProjectManagerId", x => x.ProjectManagerId, "Users", "Id");
      });
      m.CreateIndex("IX_Projects_AIDelayRiskScore", "Projects", "AIDelayRiskScore");
      m.CreateIndex("IX_Projects_DepartmentId", "Projects", "DepartmentId");
      m.CreateIndex("IX_Projects_ProjectCode", "Projects", "ProjectCode", unique: true);
      m.CreateIndex("IX_Projects_ProjectManagerId", "Projects", "ProjectManagerId");
      m.CreateIndex("IX_Projects_Status", "Projects", "Status");

      // ProjectDepartments
      m.CreateTable("ProjectDepartments", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ProjectId = t.Column<Guid>(nullable: false),
         DepartmentId = t.Column<Guid>(nullable: false),
         IsPrimary = t.Column<bool>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_ProjectDepartments", x => x.Id);
         t.ForeignKey("FK_ProjectDepartments_Projects_ProjectId", x => x.ProjectId, "Projects", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_ProjectDepartments_Departments_DepartmentId", x => x.DepartmentId, "Departments", "Id");
      });
      m.CreateIndex("IX_ProjectDepartments_DepartmentId", "ProjectDepartments", "DepartmentId");
      m.CreateIndex("IX_ProjectDepartments_ProjectId_DepartmentId", "ProjectDepartments", new[] { "ProjectId", "DepartmentId" }, unique: true);

      // Milestones
      m.CreateTable("Milestones", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ProjectId = t.Column<Guid>(nullable: false),
         DepartmentId = t.Column<Guid>(nullable: true),
         Name = t.Column<string>(maxLength: 300, nullable: false),
         Description = t.Column<string>(maxLength: 2000, nullable: false),
         Order = t.Column<int>(nullable: false),
         DueDate = t.Column<DateTime>(nullable: false),
         CompletedDate = t.Column<DateTime>(nullable: true),
         Status = t.Column<string>(maxLength: 20, nullable: false),
         IsCritical = t.Column<bool>(nullable: false),
         ProgressPercentage = t.Column<decimal>(type: "decimal(5,2)", nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_Milestones", x => x.Id);
         t.ForeignKey("FK_Milestones_Projects_ProjectId", x => x.ProjectId, "Projects", "Id");
         t.ForeignKey("FK_Milestones_Departments_DepartmentId", x => x.DepartmentId, "Departments", "Id", onDelete: ReferentialAction.SetNull);
      });
      m.CreateIndex("IX_Milestones_DepartmentId", "Milestones", "DepartmentId");
      m.CreateIndex("IX_Milestones_DueDate", "Milestones", "DueDate");
      m.CreateIndex("IX_Milestones_ProjectId", "Milestones", "ProjectId");
      m.CreateIndex("IX_Milestones_Status", "Milestones", "Status");
      m.CreateIndex("IX_Milestones_IsDeleted", "Milestones", "IsDeleted");
      m.CreateIndex("IX_Milestones_IsDeleted_DepartmentId", "Milestones", new[] { "IsDeleted", "DepartmentId" });
      m.CreateIndex("IX_Milestones_IsDeleted_ProjectId_Status_DueDate", "Milestones", new[] { "IsDeleted", "ProjectId", "Status", "DueDate" });

      // MilestoneDependencies
      m.CreateTable("MilestoneDependencies", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ProjectId = t.Column<Guid>(nullable: false),
         PrerequisiteMilestoneId = t.Column<Guid>(nullable: false),
         DependentMilestoneId = t.Column<Guid>(nullable: false),
         Type = t.Column<string>(maxLength: 30, nullable: false),
         ThresholdPercentage = t.Column<decimal>(type: "decimal(5,2)", nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_MilestoneDependencies", x => x.Id);
         t.ForeignKey("FK_MilestoneDependencies_Projects_ProjectId", x => x.ProjectId, "Projects", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_MilestoneDependencies_Milestones_PrerequisiteMilestoneId", x => x.PrerequisiteMilestoneId, "Milestones", "Id", onDelete: ReferentialAction.Restrict);
         t.ForeignKey("FK_MilestoneDependencies_Milestones_DependentMilestoneId", x => x.DependentMilestoneId, "Milestones", "Id", onDelete: ReferentialAction.Restrict);
      });
      m.CreateIndex("IX_MilestoneDependencies_ProjectId", "MilestoneDependencies", "ProjectId");
      m.CreateIndex("IX_MilestoneDependencies_PrerequisiteMilestoneId", "MilestoneDependencies", "PrerequisiteMilestoneId");
      m.CreateIndex("IX_MilestoneDependencies_DependentMilestoneId", "MilestoneDependencies", "DependentMilestoneId");

      // Tasks
      m.CreateTable("Tasks", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ProjectId = t.Column<Guid>(nullable: false),
         MilestoneId = t.Column<Guid>(nullable: true),
         ParentTaskId = t.Column<Guid>(nullable: true),
         Title = t.Column<string>(maxLength: 500, nullable: false),
         Description = t.Column<string>(maxLength: 4000, nullable: false),
         Status = t.Column<string>(maxLength: 20, nullable: false),
         Priority = t.Column<string>(maxLength: 20, nullable: false),
         AssignedToUserId = t.Column<Guid>(nullable: true),
         AssignedByUserId = t.Column<Guid>(nullable: true),
         AssignedDate = t.Column<DateTime>(nullable: true),
         StartDate = t.Column<DateTime>(nullable: false),
         DueDate = t.Column<DateTime>(nullable: false),
         CompletedDate = t.Column<DateTime>(nullable: true),
         IsRecurring = t.Column<bool>(nullable: false),
         RecurrencePattern = t.Column<string>(nullable: true),
         EstimatedHours = t.Column<int>(nullable: false),
         ActualHours = t.Column<int>(nullable: false),
         ProgressPercentage = t.Column<decimal>(type: "decimal(5,2)", nullable: false),
         CompletionNotes = t.Column<string>(nullable: true),
         IsEscalated = t.Column<bool>(nullable: false),
         EscalationLevel = t.Column<int>(nullable: false),
         EscalatedDate = t.Column<DateTime>(nullable: true),
         AIDelayProbability = t.Column<decimal>(type: "decimal(5,4)", nullable: false),
         AIPredictedCompletionDate = t.Column<DateTime>(nullable: true),
         AIOptimalAssigneeScore = t.Column<decimal>(type: "decimal(5,4)", nullable: false),
         AIRecommendedAssigneeId = t.Column<Guid>(nullable: true),
         AIRiskFactors = t.Column<string>(maxLength: 2000, nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_Tasks", x => x.Id);
         t.ForeignKey("FK_Tasks_Projects_ProjectId", x => x.ProjectId, "Projects", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_Tasks_Milestones_MilestoneId", x => x.MilestoneId, "Milestones", "Id", onDelete: ReferentialAction.SetNull);
         t.ForeignKey("FK_Tasks_Tasks_ParentTaskId", x => x.ParentTaskId, "Tasks", "Id", onDelete: ReferentialAction.Restrict);
         t.ForeignKey("FK_Tasks_Users_AssignedToUserId", x => x.AssignedToUserId, "Users", "Id");
      });
      m.CreateIndex("IX_Tasks_AIDelayProbability", "Tasks", "AIDelayProbability");
      m.CreateIndex("IX_Tasks_AssignedToUserId", "Tasks", "AssignedToUserId");
      m.CreateIndex("IX_Tasks_DueDate", "Tasks", "DueDate");
      m.CreateIndex("IX_Tasks_IsEscalated", "Tasks", "IsEscalated");
      m.CreateIndex("IX_Tasks_MilestoneId", "Tasks", "MilestoneId");
      m.CreateIndex("IX_Tasks_ParentTaskId", "Tasks", "ParentTaskId");
      m.CreateIndex("IX_Tasks_ProjectId", "Tasks", "ProjectId");
      m.CreateIndex("IX_Tasks_Status", "Tasks", "Status");
      m.CreateIndex("IX_Tasks_IsDeleted", "Tasks", "IsDeleted");
      m.CreateIndex("IX_Tasks_IsDeleted_AssignedToUserId", "Tasks", new[] { "IsDeleted", "AssignedToUserId" });
      m.CreateIndex("IX_Tasks_IsDeleted_MilestoneId", "Tasks", new[] { "IsDeleted", "MilestoneId" });
      m.CreateIndex("IX_Tasks_IsDeleted_ProjectId_Status", "Tasks", new[] { "IsDeleted", "ProjectId", "Status" });

      // TaskAssignments
      m.CreateTable("TaskAssignments", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         TaskId = t.Column<Guid>(nullable: false),
         UserId = t.Column<Guid>(nullable: false),
         AssignedAt = t.Column<DateTime>(nullable: false),
         ReleasedAt = t.Column<DateTime>(nullable: true),
         IsActive = t.Column<bool>(nullable: false),
         AIMatchScore = t.Column<double>(nullable: false),
         AIRationale = t.Column<string>(maxLength: 2000, nullable: true),
         IsAIRecommended = t.Column<bool>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_TaskAssignments", x => x.Id);
         t.ForeignKey("FK_TaskAssignments_Tasks_TaskId", x => x.TaskId, "Tasks", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_TaskAssignments_Users_UserId", x => x.UserId, "Users", "Id");
      });
      m.CreateIndex("IX_TaskAssignments_IsActive", "TaskAssignments", "IsActive");
      m.CreateIndex("IX_TaskAssignments_TaskId", "TaskAssignments", "TaskId");
      m.CreateIndex("IX_TaskAssignments_UserId", "TaskAssignments", "UserId");
      m.CreateIndex("IX_TaskAssignments_IsDeleted", "TaskAssignments", "IsDeleted");
      m.CreateIndex("IX_TaskAssignments_IsDeleted_TaskId_UserId_IsActive", "TaskAssignments", new[] { "IsDeleted", "TaskId", "UserId", "IsActive" });

      // TaskAttachments
      m.CreateTable("TaskAttachments", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         TaskId = t.Column<Guid>(nullable: false),
         FileName = t.Column<string>(nullable: false),
         FilePath = t.Column<string>(nullable: false),
         ContentType = t.Column<string>(nullable: false),
         FileSizeBytes = t.Column<long>(nullable: false),
         UploadedByUserId = t.Column<string>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_TaskAttachments", x => x.Id);
         t.ForeignKey("FK_TaskAttachments_Tasks_TaskId", x => x.TaskId, "Tasks", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_TaskAttachments_TaskId", "TaskAttachments", "TaskId");

      // TaskComments
      m.CreateTable("TaskComments", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         TaskId = t.Column<Guid>(nullable: false),
         UserId = t.Column<Guid>(nullable: true),
         Content = t.Column<string>(nullable: false),
         IsSystemGenerated = t.Column<bool>(nullable: false),
         ParentCommentId = t.Column<Guid>(nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_TaskComments", x => x.Id);
         t.ForeignKey("FK_TaskComments_Tasks_TaskId", x => x.TaskId, "Tasks", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_TaskComments_TaskId", "TaskComments", "TaskId");

      // TaskDependencies
      m.CreateTable("TaskDependencies", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         PredecessorTaskId = t.Column<Guid>(nullable: false),
         SuccessorTaskId = t.Column<Guid>(nullable: false),
         Type = t.Column<string>(maxLength: 32, nullable: false),
         LagDays = t.Column<int>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_TaskDependencies", x => x.Id);
         t.ForeignKey("FK_TaskDependencies_Tasks_PredecessorTaskId", x => x.PredecessorTaskId, "Tasks", "Id", onDelete: ReferentialAction.Restrict);
         t.ForeignKey("FK_TaskDependencies_Tasks_SuccessorTaskId", x => x.SuccessorTaskId, "Tasks", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_TaskDependencies_PredecessorTaskId", "TaskDependencies", "PredecessorTaskId");
      m.CreateIndex("IX_TaskDependencies_SuccessorTaskId", "TaskDependencies", "SuccessorTaskId");
      m.CreateIndex("IX_TaskDependencies_PredecessorTaskId_SuccessorTaskId", "TaskDependencies", new[] { "PredecessorTaskId", "SuccessorTaskId" }, unique: true);

      // ProjectDocuments
      m.CreateTable("ProjectDocuments", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ProjectId = t.Column<Guid>(nullable: false),
         Title = t.Column<string>(nullable: false),
         FilePath = t.Column<string>(nullable: false),
         ContentType = t.Column<string>(nullable: false),
         FileSizeBytes = t.Column<long>(nullable: false),
         UploadedByUserId = t.Column<string>(nullable: false),
         Description = t.Column<string>(nullable: true),
         Version = t.Column<string>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_ProjectDocuments", x => x.Id);
         t.ForeignKey("FK_ProjectDocuments_Projects_ProjectId", x => x.ProjectId, "Projects", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_ProjectDocuments_ProjectId", "ProjectDocuments", "ProjectId");

      // Notifications
      m.CreateTable("Notifications", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         UserId = t.Column<string>(maxLength: 64, nullable: false),
         Title = t.Column<string>(maxLength: 500, nullable: false),
         Message = t.Column<string>(maxLength: 2000, nullable: false),
         Type = t.Column<string>(maxLength: 50, nullable: false),
         Priority = t.Column<string>(maxLength: 20, nullable: false),
         IsRead = t.Column<bool>(nullable: false),
         ReadDate = t.Column<DateTime>(nullable: true),
         ActionUrl = t.Column<string>(maxLength: 500, nullable: true),
         RelatedEntityId = t.Column<string>(maxLength: 100, nullable: true),
         RelatedEntityType = t.Column<string>(maxLength: 100, nullable: true),
         IsAIGenerated = t.Column<bool>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_Notifications", x => x.Id));
      m.CreateIndex("IX_Notifications_CreatedDate", "Notifications", "CreatedDate");
      m.CreateIndex("IX_Notifications_IsRead", "Notifications", "IsRead");
      m.CreateIndex("IX_Notifications_UserId", "Notifications", "UserId");
      m.CreateIndex("IX_Notifications_IsDeleted", "Notifications", "IsDeleted");
      m.CreateIndex("IX_Notifications_IsDeleted_UserId_IsRead_CreatedDate", "Notifications", new[] { "IsDeleted", "UserId", "IsRead", "CreatedDate" });

      // AuditLogs
      m.CreateTable("AuditLogs", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         UserId = t.Column<string>(nullable: false),
         Action = t.Column<string>(nullable: false),
         EntityType = t.Column<string>(nullable: false),
         EntityId = t.Column<string>(nullable: false),
         OldValues = t.Column<string>(nullable: true),
         NewValues = t.Column<string>(nullable: true),
         IPAddress = t.Column<string>(nullable: true),
         UserAgent = t.Column<string>(nullable: true),
         IsAIAction = t.Column<bool>(nullable: false),
         AIModelUsed = t.Column<string>(nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_AuditLogs", x => x.Id));

      // ActivityLogs
      m.CreateTable("ActivityLogs", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         UserId = t.Column<Guid>(nullable: false),
         ActivityType = t.Column<string>(maxLength: 100, nullable: false),
         Description = t.Column<string>(maxLength: 2000, nullable: false),
         Timestamp = t.Column<DateTime>(nullable: false),
         MetadataJson = t.Column<string>(nullable: false),
         ProjectId = t.Column<Guid>(nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_ActivityLogs", x => x.Id));
      m.CreateIndex("IX_ActivityLogs_ProjectId", "ActivityLogs", "ProjectId");
      m.CreateIndex("IX_ActivityLogs_Timestamp", "ActivityLogs", "Timestamp");
      m.CreateIndex("IX_ActivityLogs_UserId", "ActivityLogs", "UserId");

      // AlertRules
      m.CreateTable("AlertRules", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Name = t.Column<string>(maxLength: 200, nullable: false),
         ConditionType = t.Column<string>(maxLength: 100, nullable: false),
         ConditionExpression = t.Column<string>(maxLength: 2000, nullable: false),
         ActionType = t.Column<string>(maxLength: 100, nullable: false),
         ActionParametersJson = t.Column<string>(nullable: false),
         IsEnabled = t.Column<bool>(nullable: false),
         LastTriggered = t.Column<DateTime>(nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_AlertRules", x => x.Id));

      // Dashboards
      m.CreateTable("Dashboards", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         UserId = t.Column<Guid>(nullable: false),
         Name = t.Column<string>(maxLength: 200, nullable: false),
         LayoutType = t.Column<string>(maxLength: 100, nullable: false),
         IsDefault = t.Column<bool>(nullable: false),
         LastAccessed = t.Column<DateTime>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_Dashboards", x => x.Id));
      m.CreateIndex("IX_Dashboards_UserId", "Dashboards", "UserId");

      // DashboardWidgets
      m.CreateTable("DashboardWidgets", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         DashboardId = t.Column<Guid>(nullable: false),
         WidgetType = t.Column<string>(maxLength: 100, nullable: false),
         Title = t.Column<string>(maxLength: 200, nullable: false),
         ConfigurationJson = t.Column<string>(nullable: false),
         RefreshInterval = t.Column<int>(nullable: false),
         LastRefreshed = t.Column<DateTime>(nullable: false),
         RequiredPermissionsJson = t.Column<string>(nullable: false),
         DisplayOrder = t.Column<int>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_DashboardWidgets", x => x.Id);
         t.ForeignKey("FK_DashboardWidgets_Dashboards_DashboardId", x => x.DashboardId, "Dashboards", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_DashboardWidgets_DashboardId", "DashboardWidgets", "DashboardId");

      // Integrations
      m.CreateTable("Integrations", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         IntegrationType = t.Column<string>(maxLength: 100, nullable: false),
         Name = t.Column<string>(maxLength: 200, nullable: false),
         ConfigurationJson = t.Column<string>(nullable: false),
         LastSync = t.Column<DateTime>(nullable: true),
         Status = t.Column<string>(maxLength: 50, nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_Integrations", x => x.Id));

      // Webhooks
      m.CreateTable("Webhooks", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         IntegrationId = t.Column<Guid>(nullable: true),
         EventType = t.Column<string>(maxLength: 100, nullable: false),
         CallbackUrl = t.Column<string>(maxLength: 500, nullable: false),
         Secret = t.Column<string>(maxLength: 500, nullable: false),
         HeadersJson = t.Column<string>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_Webhooks", x => x.Id);
         t.ForeignKey("FK_Webhooks_Integrations_IntegrationId", x => x.IntegrationId, "Integrations", "Id", onDelete: ReferentialAction.SetNull);
      });
      m.CreateIndex("IX_Webhooks_IntegrationId", "Webhooks", "IntegrationId");

      // WebhookDeliveries
      m.CreateTable("WebhookDeliveries", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         WebhookId = t.Column<Guid>(nullable: false),
         AttemptedAt = t.Column<DateTime>(nullable: false),
         StatusCode = t.Column<int>(nullable: false),
         ResponseBody = t.Column<string>(maxLength: 4000, nullable: false),
         Success = t.Column<bool>(nullable: false),
         ErrorMessage = t.Column<string>(maxLength: 1000, nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_WebhookDeliveries", x => x.Id);
         t.ForeignKey("FK_WebhookDeliveries_Webhooks_WebhookId", x => x.WebhookId, "Webhooks", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_WebhookDeliveries_WebhookId", "WebhookDeliveries", "WebhookId");

      // NotificationTemplates
      m.CreateTable("NotificationTemplates", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         TemplateType = t.Column<string>(maxLength: 100, nullable: false),
         SubjectTemplate = t.Column<string>(maxLength: 500, nullable: false),
         BodyTemplate = t.Column<string>(maxLength: 4000, nullable: false),
         VariablesJson = t.Column<string>(nullable: false),
         SupportedChannelsJson = t.Column<string>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_NotificationTemplates", x => x.Id));

      // KnowledgeArticles
      m.CreateTable("KnowledgeArticles", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ProjectId = t.Column<Guid>(nullable: true),
         Title = t.Column<string>(maxLength: 250, nullable: false),
         Content = t.Column<string>(maxLength: 8000, nullable: false),
         Category = t.Column<string>(maxLength: 100, nullable: false),
         TagsJson = t.Column<string>(nullable: false),
         AuthorId = t.Column<Guid>(nullable: false),
         LastUpdated = t.Column<DateTime>(nullable: false),
         ViewCount = t.Column<int>(nullable: false),
         RelevanceScore = t.Column<double>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_KnowledgeArticles", x => x.Id));
      m.CreateIndex("IX_KnowledgeArticles_AuthorId", "KnowledgeArticles", "AuthorId");
      m.CreateIndex("IX_KnowledgeArticles_ProjectId", "KnowledgeArticles", "ProjectId");

      // LessonsLearned
      m.CreateTable("LessonsLearned", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ProjectId = t.Column<Guid>(nullable: false),
         Title = t.Column<string>(maxLength: 250, nullable: false),
         Description = t.Column<string>(maxLength: 4000, nullable: false),
         Category = t.Column<string>(maxLength: 100, nullable: false),
         Impact = t.Column<string>(maxLength: 200, nullable: false),
         KeywordsJson = t.Column<string>(nullable: false),
         RecordedDate = t.Column<DateTime>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_LessonsLearned", x => x.Id));
      m.CreateIndex("IX_LessonsLearned_ProjectId", "LessonsLearned", "ProjectId");

      // Reports
      m.CreateTable("Reports", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Name = t.Column<string>(maxLength: 200, nullable: false),
         ReportType = t.Column<string>(maxLength: 100, nullable: false),
         ParametersJson = t.Column<string>(nullable: false),
         GeneratedDate = t.Column<DateTime>(nullable: false),
         Format = t.Column<string>(maxLength: 50, nullable: false),
         Data = t.Column<byte[]>(nullable: false),
         GeneratedByUserId = t.Column<Guid>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_Reports", x => x.Id));
      m.CreateIndex("IX_Reports_GeneratedByUserId", "Reports", "GeneratedByUserId");
      m.CreateIndex("IX_Reports_GeneratedDate", "Reports", "GeneratedDate");

      // ReportSchedules
      m.CreateTable("ReportSchedules", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ReportId = t.Column<Guid>(nullable: false),
         Frequency = t.Column<string>(maxLength: 50, nullable: false),
         NextRun = t.Column<DateTime>(nullable: false),
         LastRun = t.Column<DateTime>(nullable: true),
         RecipientsJson = t.Column<string>(nullable: false),
         DeliveryOptionsJson = t.Column<string>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_ReportSchedules", x => x.Id);
         t.ForeignKey("FK_ReportSchedules_Reports_ReportId", x => x.ReportId, "Reports", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_ReportSchedules_NextRun", "ReportSchedules", "NextRun");
      m.CreateIndex("IX_ReportSchedules_ReportId", "ReportSchedules", "ReportId");

      // AIModels (TPH base)
      m.CreateTable("AIModels", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Name = t.Column<string>(maxLength: 200, nullable: false),
         Version = t.Column<string>(maxLength: 50, nullable: false),
         ModelType = t.Column<string>(maxLength: 100, nullable: false),
         LastTrainedDate = t.Column<DateTime>(nullable: true),
         AccuracyScore = t.Column<double>(nullable: false),
         PrecisionScore = t.Column<double>(nullable: false),
         RecallScore = t.Column<double>(nullable: false),
         ModelPath = t.Column<string>(maxLength: 500, nullable: true),
         HyperparametersJson = t.Column<string>(nullable: false),
         FeaturesJson = t.Column<string>(nullable: false),
         ModelDiscriminator = t.Column<string>(maxLength: 21, nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_AIModels", x => x.Id));
      m.CreateIndex("IX_AIModels_ModelType_Name_Version", "AIModels", new[] { "ModelType", "Name", "Version" }, unique: true);

      // AIProviderCredentials
      m.CreateTable("AIProviderCredentials", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         Provider = t.Column<string>(maxLength: 80, nullable: false),
         DisplayName = t.Column<string>(maxLength: 120, nullable: false),
         Enabled = t.Column<bool>(nullable: false),
         UseEnvironmentDefault = t.Column<bool>(nullable: false),
         BaseUrl = t.Column<string>(maxLength: 500, nullable: false),
         DefaultModel = t.Column<string>(maxLength: 200, nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_AIProviderCredentials", x => x.Id));
      m.CreateIndex("IX_AIProviderCredentials_Enabled", "AIProviderCredentials", "Enabled");
      m.CreateIndex("IX_AIProviderCredentials_Provider", "AIProviderCredentials", "Provider", unique: true);

      // AIGlobalSettings
      m.CreateTable("AIGlobalSettings", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         DefaultProvider = t.Column<string>(maxLength: 80, nullable: false),
         DefaultModel = t.Column<string>(maxLength: 200, nullable: false),
         RiskThreshold = t.Column<double>(nullable: false),
         UseLocalModel = t.Column<bool>(nullable: false),
         MLModelPath = t.Column<string>(maxLength: 500, nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_AIGlobalSettings", x => x.Id));
      m.CreateIndex("IX_AIGlobalSettings_DefaultProvider", "AIGlobalSettings", "DefaultProvider");

      // TrainingDataPoints
      m.CreateTable("TrainingDataPoints", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         DataType = t.Column<string>(maxLength: 100, nullable: false),
         FeaturesJson = t.Column<string>(nullable: false),
         LabelsJson = t.Column<string>(nullable: false),
         Source = t.Column<string>(maxLength: 200, nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t => t.PrimaryKey("PK_TrainingDataPoints", x => x.Id));
      m.CreateIndex("IX_TrainingDataPoints_DataType", "TrainingDataPoints", "DataType");
      m.CreateIndex("IX_TrainingDataPoints_Source", "TrainingDataPoints", "Source");

      // AllocationRecommendations
      m.CreateTable("AllocationRecommendations", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         TaskId = t.Column<Guid>(nullable: false),
         ModelId = t.Column<Guid>(nullable: false),
         RecommendedUserId = t.Column<Guid>(nullable: false),
         MatchScore = t.Column<double>(nullable: false),
         RationaleJson = t.Column<string>(nullable: false),
         FeatureScoresJson = t.Column<string>(nullable: false),
         AlternativesJson = t.Column<string>(nullable: false),
         Status = t.Column<string>(maxLength: 50, nullable: false),
         DecisionReason = t.Column<string>(maxLength: 1000, nullable: true),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_AllocationRecommendations", x => x.Id);
         t.ForeignKey("FK_AllocationRecommendations_AIModels_ModelId", x => x.ModelId, "AIModels", "Id", onDelete: ReferentialAction.Restrict);
         t.ForeignKey("FK_AllocationRecommendations_Tasks_TaskId", x => x.TaskId, "Tasks", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_AllocationRecommendations_ModelId", "AllocationRecommendations", "ModelId");
      m.CreateIndex("IX_AllocationRecommendations_RecommendedUserId", "AllocationRecommendations", "RecommendedUserId");
      m.CreateIndex("IX_AllocationRecommendations_TaskId", "AllocationRecommendations", "TaskId");

      // DelayPredictions
      m.CreateTable("DelayPredictions", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         TaskId = t.Column<Guid>(nullable: false),
         ModelId = t.Column<Guid>(nullable: false),
         DelayProbability = t.Column<double>(nullable: false),
         ExpectedDelayDays = t.Column<int>(nullable: false),
         PredictedCompletionDate = t.Column<DateTime>(nullable: true),
         ContributingFactorsJson = t.Column<string>(nullable: false),
         FactorWeightsJson = t.Column<string>(nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_DelayPredictions", x => x.Id);
         t.ForeignKey("FK_DelayPredictions_AIModels_ModelId", x => x.ModelId, "AIModels", "Id", onDelete: ReferentialAction.Restrict);
         t.ForeignKey("FK_DelayPredictions_Tasks_TaskId", x => x.TaskId, "Tasks", "Id", onDelete: ReferentialAction.Cascade);
      });
      m.CreateIndex("IX_DelayPredictions_ModelId", "DelayPredictions", "ModelId");
      m.CreateIndex("IX_DelayPredictions_PredictedCompletionDate", "DelayPredictions", "PredictedCompletionDate");
      m.CreateIndex("IX_DelayPredictions_TaskId", "DelayPredictions", "TaskId");

      // PredictionResults
      m.CreateTable("PredictionResults", t => new
      {
         Id = t.Column<Guid>(nullable: false),
         ModelId = t.Column<Guid>(nullable: false),
         TaskId = t.Column<Guid>(nullable: true),
         PredictionDate = t.Column<DateTime>(nullable: false),
         InputFeaturesJson = t.Column<string>(nullable: false),
         OutputPredictionsJson = t.Column<string>(nullable: false),
         ConfidenceScore = t.Column<double>(nullable: false),
         Recommendation = t.Column<string>(maxLength: 1000, nullable: false),
         CreatedDate = t.Column<DateTime>(nullable: false),
         CreatedBy = t.Column<string>(nullable: false),
         ModifiedDate = t.Column<DateTime>(nullable: true),
         ModifiedBy = t.Column<string>(nullable: true),
         IsDeleted = t.Column<bool>(nullable: false),
         RowVersion = t.Column<int>(nullable: false),
         Notes = t.Column<string>(nullable: true),
         Tags = t.Column<string>(nullable: true),
         IsActive = t.Column<bool>(nullable: false)
      }, constraints: t =>
      {
         t.PrimaryKey("PK_PredictionResults", x => x.Id);
         t.ForeignKey("FK_PredictionResults_AIModels_ModelId", x => x.ModelId, "AIModels", "Id", onDelete: ReferentialAction.Cascade);
         t.ForeignKey("FK_PredictionResults_Tasks_TaskId", x => x.TaskId, "Tasks", "Id", onDelete: ReferentialAction.SetNull);
      });
      m.CreateIndex("IX_PredictionResults_ModelId", "PredictionResults", "ModelId");
      m.CreateIndex("IX_PredictionResults_PredictionDate", "PredictionResults", "PredictionDate");
      m.CreateIndex("IX_PredictionResults_TaskId", "PredictionResults", "TaskId");
   }

   protected override void Down(MigrationBuilder m)
   {
      m.DropTable("AllocationRecommendations");
      m.DropTable("DelayPredictions");
      m.DropTable("PredictionResults");
      m.DropTable("TrainingDataPoints");
      m.DropTable("AIGlobalSettings");
      m.DropTable("AIProviderCredentials");
      m.DropTable("AIModels");
      m.DropTable("ReportSchedules");
      m.DropTable("Reports");
      m.DropTable("LessonsLearned");
      m.DropTable("KnowledgeArticles");
      m.DropTable("NotificationTemplates");
      m.DropTable("WebhookDeliveries");
      m.DropTable("Webhooks");
      m.DropTable("Integrations");
      m.DropTable("DashboardWidgets");
      m.DropTable("Dashboards");
      m.DropTable("AlertRules");
      m.DropTable("ActivityLogs");
      m.DropTable("AuditLogs");
      m.DropTable("Notifications");
      m.DropTable("ProjectDocuments");
      m.DropTable("TaskDependencies");
      m.DropTable("TaskComments");
      m.DropTable("TaskAttachments");
      m.DropTable("TaskAssignments");
      m.DropTable("Tasks");
      m.DropTable("MilestoneDependencies");
      m.DropTable("Milestones");
      m.DropTable("ProjectDepartments");
      m.DropTable("Projects");
      m.DropTable("UserRoles");
      m.DropTable("RolePermissions");
      m.DropTable("Roles");
      m.DropTable("Permissions");
      m.DropTable("UserDepartments");
      m.DropTable("UserProfiles");
      m.DropTable("UserSkills");
      m.DropTable("Skills");
      m.DropTable("Users");
      m.DropTable("Departments");
      m.DropTable("Organizations");
   }
}
