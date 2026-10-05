using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class TasksSeeder
{
    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var project = await context.Projects.FirstOrDefaultAsync(p => p.ProjectCode == "UPPWD-COLONY-2026-001", ct);
        if (project == null) return;

        var users = await context.Users.ToListAsync(ct);
        await SeedTasksForProjectAsync(context, project, users, ct);
        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedTasksForProjectAsync(ApplicationDbContext context, Project project, List<ApplicationUser> users, CancellationToken ct)
    {
        var milestones = await context.Milestones
            .Where(m => m.ProjectId == project.Id)
            .OrderBy(m => m.Order)
            .ToListAsync(ct);

        var taskSpecs = BuildTaskSpecs(project, milestones, users);

        foreach (var spec in taskSpecs)
        {
            var task = await UpsertTaskAsync(context, spec, ct);
            var assignedBy = project.ProjectManagerId ?? users.First().Id;
            await EnsureAssignmentAsync(context, task, spec.AssigneeId, assignedBy, ct);
            await SeedSubtasksAsync(context, task, spec, assignedBy, ct);
        }
    }

    private static async Task<ProjectTask> UpsertTaskAsync(ApplicationDbContext context, SeedConstants.TaskSpec spec, CancellationToken ct)
    {
        var task = await context.Tasks.FirstOrDefaultAsync(t => t.ProjectId == spec.ProjectId && t.Title == spec.Title, ct);
        if (task != null)
            return task;

        task = ProjectTask.Create(spec.ProjectId, spec.Title, spec.Description, spec.Priority, spec.Start, spec.Due, spec.EstimatedHours, spec.MilestoneId, spec.ParentTaskId);
        task.SetCreatedBy(SeedConstants.SeedUser);
        task.AssignTo(spec.AssigneeId, spec.AssignedById);
        task.UpdateStatus(spec.Status);
        task.UpdateProgress(spec.Progress, spec.Notes);
        task.UpdateAIPrediction(spec.DelayProbability, spec.Due.AddDays(spec.ExpectedDelayDays), "[\"Scope variance\",\"Dependency wait\"]", spec.AssigneeId);
        await context.Tasks.AddAsync(task, ct);
        return task;
    }

    private static async Task SeedSubtasksAsync(ApplicationDbContext context, ProjectTask parent, SeedConstants.TaskSpec spec, Guid assignedById, CancellationToken ct)
    {
        var subtaskSpecs = GetSubtaskSpecs(spec.Title);

        foreach (var sub in subtaskSpecs)
        {
            if (await context.Tasks.AnyAsync(t => t.ParentTaskId == parent.Id && t.Title == sub.Title, ct))
                continue;

            var subtask = ProjectTask.Create(parent.ProjectId, sub.Title, sub.Description, TaskPriority.Medium, parent.StartDate.AddDays(1), parent.DueDate, sub.Hours, parent.MilestoneId, parent.Id);
            subtask.SetCreatedBy(SeedConstants.SeedUser);
            subtask.AssignTo(spec.AssigneeId, assignedById);
            subtask.UpdateProgress(sub.Progress, sub.Notes);
            await context.Tasks.AddAsync(subtask, ct);
        }
    }

    private static SubtaskSpec[] GetSubtaskSpecs(string parentTitle) => parentTitle switch
    {
        // M1 Tasks
        "Land Ownership Verification" => new[]
        {
            new SubtaskSpec("Collect Khatauni records", "Gather land records from tehsil office", 8, 100, "Completed"),
            new SubtaskSpec("Verify ownership", "Cross-check with revenue department records", 6, 80, "In progress"),
            new SubtaskSpec("Check litigation status", "Verify any pending court cases on land", 4, 60, "In progress"),
            new SubtaskSpec("Upload land documents", "Digitize and upload all ownership documents", 4, 20, "In progress"),
        },
        "Physical Survey" => new[]
        {
            new SubtaskSpec("DGPS Survey", "Conduct differential GPS survey of site", 12, 50, "In progress"),
            new SubtaskSpec("Boundary marking", "Mark physical boundaries with pillars", 8, 30, "Not started"),
            new SubtaskSpec("Topographical survey", "Map terrain contours and features", 10, 20, "Not started"),
            new SubtaskSpec("GIS Mapping", "Create GIS layers of the site", 6, 10, "Not started"),
        },
        "Land Handover" => new[]
        {
            new SubtaskSpec("Prepare possession certificate", "Draft and sign possession certificate", 4, 0, "Not started"),
            new SubtaskSpec("Remove encroachments", "Clear any unauthorized occupants", 8, 0, "Not started"),
            new SubtaskSpec("Joint inspection", "Joint inspection with PWD officials", 4, 0, "Not started"),
            new SubtaskSpec("Handover to PWD", "Formal handover with documentation", 3, 0, "Not started"),
        },
        // M2 Tasks
        "Master Layout Preparation" => new[]
        {
            new SubtaskSpec("Residential zoning", "Define residential plot sizes and布局", 10, 0, "Not started"),
            new SubtaskSpec("Road planning", "Design internal road network", 8, 0, "Not started"),
            new SubtaskSpec("Park planning", "Allocate green spaces and parks", 6, 0, "Not started"),
            new SubtaskSpec("Utility zoning", "Plan utility corridors for water, sewer, power", 6, 0, "Not started"),
        },
        "Building Design" => new[]
        {
            new SubtaskSpec("Floor plans", "Prepare floor plans for residential units", 16, 0, "Not started"),
            new SubtaskSpec("Elevation", "Design building elevations and facades", 10, 0, "Not started"),
            new SubtaskSpec("Structural drawings", "Prepare structural engineering drawings", 14, 0, "Not started"),
            new SubtaskSpec("Fire exit planning", "Design fire safety and evacuation routes", 6, 0, "Not started"),
        },
        "Drawing Approval" => new[]
        {
            new SubtaskSpec("Internal review", "Internal department review of drawings", 6, 0, "Not started"),
            new SubtaskSpec("Technical review", "Technical scrutiny by review committee", 8, 0, "Not started"),
            new SubtaskSpec("Final approval", "Obtain final approval signatures", 4, 0, "Not started"),
            new SubtaskSpec("Publish drawings", "Publish finalized drawings for tendering", 4, 0, "Not started"),
        },
        // M3 Tasks
        "Building Plan Approval" => new[]
        {
            new SubtaskSpec("Upload drawings", "Submit drawings to town planning portal", 4, 0, "Not started"),
            new SubtaskSpec("Technical scrutiny", "Technical examination by planning department", 8, 0, "Not started"),
            new SubtaskSpec("Correction cycle", "Address review comments and resubmit", 10, 0, "Not started"),
            new SubtaskSpec("Final approval", "Obtain building plan approval certificate", 4, 0, "Not started"),
        },
        "Development Permission" => new[]
        {
            new SubtaskSpec("Layout verification", "Verify layout as per approved plan", 6, 0, "Not started"),
            new SubtaskSpec("Utility verification", "Verify utility clearances from departments", 8, 0, "Not started"),
            new SubtaskSpec("Issue permission", "Issue development permission letter", 4, 0, "Not started"),
        },
        "Approval Documentation" => new[]
        {
            new SubtaskSpec("Digital certificate", "Generate digitally signed approval certificate", 3, 0, "Not started"),
            new SubtaskSpec("Physical certificate", "Prepare physical copy of approval", 3, 0, "Not started"),
            new SubtaskSpec("Upload approval", "Upload approval to project document portal", 2, 0, "Not started"),
        },
        // M4 Tasks
        "Prepare BOQ" => new[]
        {
            new SubtaskSpec("Material estimation", "Estimate quantities of construction materials", 10, 0, "Not started"),
            new SubtaskSpec("Labour estimation", "Calculate labour requirements and costs", 6, 0, "Not started"),
            new SubtaskSpec("Cost estimation", "Prepare detailed cost estimates", 8, 0, "Not started"),
        },
        "Tender Publication" => new[]
        {
            new SubtaskSpec("Publish tender", "Publish tender on e-procurement portal", 4, 0, "Not started"),
            new SubtaskSpec("Vendor notification", "Notify registered vendors about tender", 3, 0, "Not started"),
            new SubtaskSpec("Bid schedule", "Prepare bid opening and evaluation schedule", 3, 0, "Not started"),
        },
        "Bid Evaluation" => new[]
        {
            new SubtaskSpec("Technical evaluation", "Evaluate technical bids as per criteria", 12, 0, "Not started"),
            new SubtaskSpec("Financial evaluation", "Evaluate financial bids of qualified bidders", 10, 0, "Not started"),
            new SubtaskSpec("Ranking", "Prepare bidder ranking and recommendation", 4, 0, "Not started"),
        },
        "Award Contract" => new[]
        {
            new SubtaskSpec("Issue LOA", "Issue Letter of Acceptance to selected bidder", 4, 0, "Not started"),
            new SubtaskSpec("Contract signing", "Sign formal contract agreement", 6, 0, "Not started"),
            new SubtaskSpec("Work order generation", "Generate and issue work order", 4, 0, "Not started"),
        },
        // M5 Tasks
        "Temporary Site Office" => new[]
        {
            new SubtaskSpec("Office cabins", "Install prefabricated office cabins", 4, 0, "Not started"),
            new SubtaskSpec("Internet setup", "Establish internet and communication lines", 2, 0, "Not started"),
            new SubtaskSpec("Electricity connection", "Arrange temporary power connection", 3, 0, "Not started"),
        },
        "Site Clearance" => new[]
        {
            new SubtaskSpec("Vegetation removal", "Clear trees, bushes and vegetation", 6, 0, "Not started"),
            new SubtaskSpec("Debris removal", "Remove debris and waste materials", 4, 0, "Not started"),
            new SubtaskSpec("Leveling", "Grade and level the construction site", 6, 0, "Not started"),
        },
        "Construction Mobilization" => new[]
        {
            new SubtaskSpec("Machinery deployment", "Deploy construction equipment and machinery", 6, 0, "Not started"),
            new SubtaskSpec("Labour mobilization", "Arrange skilled and unskilled labour", 4, 0, "Not started"),
            new SubtaskSpec("Material stock", "Stockpile initial construction materials", 6, 0, "Not started"),
        },
        // M6 Tasks
        "Excavation" => new[]
        {
            new SubtaskSpec("Mark excavation", "Mark excavation boundaries as per drawings", 3, 0, "Not started"),
            new SubtaskSpec("Dig foundation", "Excavate trenches for foundation", 10, 0, "Not started"),
            new SubtaskSpec("Soil disposal", "Dispose excavated soil to designated area", 4, 0, "Not started"),
        },
        "PCC Work" => new[]
        {
            new SubtaskSpec("Base preparation", "Prepare and level PCC base", 4, 0, "Not started"),
            new SubtaskSpec("PCC pouring", "Pour plain cement concrete layer", 6, 0, "Not started"),
            new SubtaskSpec("Initial curing", "Initial curing of PCC for 24 hours", 3, 0, "Not started"),
        },
        "Reinforcement" => new[]
        {
            new SubtaskSpec("Steel cutting", "Cut steel reinforcement as per bar schedule", 8, 0, "Not started"),
            new SubtaskSpec("Steel tying", "Tie reinforcement bars as per drawings", 10, 0, "Not started"),
            new SubtaskSpec("Inspection", "Inspect reinforcement before concreting", 3, 0, "Not started"),
        },
        "Foundation Concrete" => new[]
        {
            new SubtaskSpec("Concrete pouring", "Pour foundation concrete continuously", 10, 0, "Not started"),
            new SubtaskSpec("Vibration", "Vibrate concrete to remove air pockets", 4, 0, "Not started"),
            new SubtaskSpec("Final curing", "Cure foundation for 7 days minimum", 14, 0, "Not started"),
        },
        // M7 Tasks
        "Columns & Beams" => new[]
        {
            new SubtaskSpec("Column reinforcement", "Reinforcement and shuttering for columns", 12, 0, "Not started"),
            new SubtaskSpec("Column concreting", "Pour concrete for ground floor columns", 8, 0, "Not started"),
            new SubtaskSpec("Beam shuttering", "Shuttering and reinforcement for beams", 12, 0, "Not started"),
            new SubtaskSpec("Beam concreting", "Pour concrete for beams", 8, 0, "Not started"),
        },
        "Slabs & Roofing" => new[]
        {
            new SubtaskSpec("Slab shuttering", "Shuttering for floor slabs", 14, 0, "Not started"),
            new SubtaskSpec("Slab reinforcement", "Steel reinforcement for slabs", 12, 0, "Not started"),
            new SubtaskSpec("Slab concreting", "Pour concrete for slabs", 10, 0, "Not started"),
            new SubtaskSpec("Roof waterproofing", "Apply waterproofing treatment on roof", 6, 0, "Not started"),
        },
        "Brickwork & Staircases" => new[]
        {
            new SubtaskSpec("External brickwork", "External wall brickwork as per drawings", 16, 0, "Not started"),
            new SubtaskSpec("Internal brickwork", "Internal partition wall brickwork", 14, 0, "Not started"),
            new SubtaskSpec("Staircase construction", "Construct reinforced concrete staircases", 10, 0, "Not started"),
        },
        "Structural Inspection" => new[]
        {
            new SubtaskSpec("Load testing", "Conduct structural load tests on slabs", 8, 0, "Not started"),
            new SubtaskSpec("Quality audit", "Structural quality audit by QA team", 6, 0, "Not started"),
            new SubtaskSpec("Defect rectification", "Rectify any structural defects identified", 10, 0, "Not started"),
        },
        // M8 Tasks
        "Water Pipeline & Plumbing" => new[]
        {
            new SubtaskSpec("Pipeline trenching", "Excavate trenches for water pipelines", 12, 0, "Not started"),
            new SubtaskSpec("Pipe laying", "Lay water supply pipes with joints", 14, 0, "Not started"),
            new SubtaskSpec("Internal plumbing", "Install internal plumbing in buildings", 16, 0, "Not started"),
        },
        "Pump House & OHT" => new[]
        {
            new SubtaskSpec("Pump house construction", "Construct pump house structure", 10, 0, "Not started"),
            new SubtaskSpec("Overhead tank erection", "Erect overhead water tank", 12, 0, "Not started"),
            new SubtaskSpec("Pump installation", "Install pumps and control panels", 8, 0, "Not started"),
        },
        "Pressure Testing" => new[]
        {
            new SubtaskSpec("Line flushing", "Flush pipelines to remove debris", 4, 0, "Not started"),
            new SubtaskSpec("Hydro testing", "Hydrostatic pressure testing of pipelines", 6, 0, "Not started"),
            new SubtaskSpec("Leak rectification", "Fix any leaks identified during testing", 6, 0, "Not started"),
        },
        // M9 Tasks
        "Transformer & Cables" => new[]
        {
            new SubtaskSpec("Transformer installation", "Install distribution transformer", 10, 0, "Not started"),
            new SubtaskSpec("HT cable laying", "Lay HT cables from grid to transformer", 8, 0, "Not started"),
            new SubtaskSpec("LT cable laying", "Lay LT cables for distribution", 10, 0, "Not started"),
        },
        "Internal Wiring & Meters" => new[]
        {
            new SubtaskSpec("Main panel installation", "Install main distribution panel", 6, 0, "Not started"),
            new SubtaskSpec("Internal wiring", "Internal electrical wiring in buildings", 16, 0, "Not started"),
            new SubtaskSpec("Meter installation", "Install individual unit electricity meters", 8, 0, "Not started"),
        },
        "Street Lighting & Earthing" => new[]
        {
            new SubtaskSpec("Street light poles", "Install street light poles and fixtures", 8, 0, "Not started"),
            new SubtaskSpec("Street light cabling", "Lay cabling for street lighting", 6, 0, "Not started"),
            new SubtaskSpec("Earthing system", "Install earthing system for all buildings", 8, 0, "Not started"),
        },
        // M10 Tasks
        "Sewer Pipeline & Manholes" => new[]
        {
            new SubtaskSpec("Sewer trenching", "Excavate trenches for sewer lines", 14, 0, "Not started"),
            new SubtaskSpec("Pipe laying", "Lay sewer pipes with proper gradient", 16, 0, "Not started"),
            new SubtaskSpec("Manhole construction", "Construct manholes at junctions", 10, 0, "Not started"),
        },
        "Storm Drains & STP" => new[]
        {
            new SubtaskSpec("Storm drain construction", "Construct storm water drainage system", 14, 0, "Not started"),
            new SubtaskSpec("STP connection", "Connect sewer lines to STP", 8, 0, "Not started"),
            new SubtaskSpec("STP commissioning", "Commission sewage treatment plant", 10, 0, "Not started"),
        },
        "Leak Testing" => new[]
        {
            new SubtaskSpec("Smoke testing", "Smoke test sewer lines for leaks", 4, 0, "Not started"),
            new SubtaskSpec("Water test", "Water tightness test of pipelines", 4, 0, "Not started"),
            new SubtaskSpec("Defect rectification", "Fix defects found during testing", 6, 0, "Not started"),
        },
        // M11 Tasks
        "Internal Roads & Footpaths" => new[]
        {
            new SubtaskSpec("Subgrade preparation", "Prepare and compact road subgrade", 12, 0, "Not started"),
            new SubtaskSpec("Base course laying", "Lay granular base course", 10, 0, "Not started"),
            new SubtaskSpec("Asphalt paving", "Lay asphalt wearing course", 12, 0, "Not started"),
            new SubtaskSpec("Footpath construction", "Construct concrete footpaths on both sides", 8, 0, "Not started"),
        },
        "Kerbs, Parking & Marking" => new[]
        {
            new SubtaskSpec("Kerb installation", "Install concrete kerbs along roads", 6, 0, "Not started"),
            new SubtaskSpec("Parking area", "Construct designated parking areas", 8, 0, "Not started"),
            new SubtaskSpec("Road marking", "Paint road markings and signage", 4, 0, "Not started"),
        },
        // M12 Tasks
        "Lawn & Plantation" => new[]
        {
            new SubtaskSpec("Soil preparation", "Prepare soil beds for landscaping", 6, 0, "Not started"),
            new SubtaskSpec("Lawn development", "Sodding or seeding of lawns", 8, 0, "Not started"),
            new SubtaskSpec("Tree plantation", "Plant trees as per landscape plan", 6, 0, "Not started"),
            new SubtaskSpec("Shrub planting", "Plant shrubs and ornamental plants", 4, 0, "Not started"),
        },
        "Irrigation & Children's Park" => new[]
        {
            new SubtaskSpec("Sprinkler system", "Install automatic sprinkler irrigation", 8, 0, "Not started"),
            new SubtaskSpec("Children's park", "Construct children's play area with equipment", 10, 0, "Not started"),
            new SubtaskSpec("Benches & fixtures", "Install benches, lights and other fixtures", 4, 0, "Not started"),
        },
        // M13 Tasks
        "Material Testing & Audit" => new[]
        {
            new SubtaskSpec("Concrete core test", "Test concrete cores for strength", 6, 0, "Not started"),
            new SubtaskSpec("Steel tensile test", "Test steel reinforcement samples", 4, 0, "Not started"),
            new SubtaskSpec("Structural audit", "Complete structural audit of all buildings", 10, 0, "Not started"),
        },
        "Snag Correction" => new[]
        {
            new SubtaskSpec("Snag list preparation", "Prepare comprehensive snag list", 4, 0, "Not started"),
            new SubtaskSpec("Contractor rectification", "Contractor rectification of identified snags", 10, 0, "Not started"),
            new SubtaskSpec("Re-inspection", "Re-inspect after snag rectification", 4, 0, "Not started"),
        },
        "Final Inspection & Handover" => new[]
        {
            new SubtaskSpec("Final inspection", "Final joint inspection by all departments", 8, 0, "Not started"),
            new SubtaskSpec("Completion certificate", "Prepare and issue completion certificate", 4, 0, "Not started"),
            new SubtaskSpec("Handover report", "Prepare handover report for client", 4, 0, "Not started"),
        },
        _ => new[]
        {
            new SubtaskSpec("Prepare acceptance checklist", "Checklist for completion criteria", 4, 0, "Not started"),
            new SubtaskSpec("Review implementation notes", "Confirm delivery notes and blockers", 3, 0, "Not started"),
        }
    };

    private static SeedConstants.TaskSpec[] BuildTaskSpecs(Project project, List<Milestone> milestones, List<ApplicationUser> users)
    {
        var projectId = project.Id;
        var assignedBy = project.ProjectManagerId ?? users.First().Id;
        var rng = new Random(42);

        Guid DeptMilo(string milestoneName) => milestones.FirstOrDefault(m => m.Name == milestoneName)?.Id ?? Guid.Empty;

        Guid RandomUser(Guid? milestoneId)
        {
            var deptId = milestones.FirstOrDefault(m => m.Id == milestoneId)?.DepartmentId;
            var deptUsers = deptId.HasValue
                ? users.Where(u => u.DepartmentId == deptId.Value).ToList()
                : users;
            if (deptUsers.Count == 0) deptUsers = users;
            return deptUsers[rng.Next(deptUsers.Count)].Id;
        }

        DateTime Dt(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);

        return new[]
        {
            // M1 - Land Acquisition & Site Readiness
            new SeedConstants.TaskSpec(projectId, DeptMilo("Land Acquisition & Site Readiness"), null, "Land Ownership Verification", "Collect and verify land ownership records from revenue department", TaskPriority.Critical, Dt(2026,7,1), Dt(2026,7,8), 22, RandomUser(DeptMilo("Land Acquisition & Site Readiness")), assignedBy, TaskStatus.InProgress, 50, 0.10, 0, "Ownership records being compiled"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Land Acquisition & Site Readiness"), null, "Physical Survey", "Conduct DGPS survey, boundary marking and topographical mapping", TaskPriority.High, Dt(2026,7,1), Dt(2026,7,15), 36, RandomUser(DeptMilo("Land Acquisition & Site Readiness")), assignedBy, TaskStatus.InProgress, 30, 0.20, 2, "DGPS survey in progress"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Land Acquisition & Site Readiness"), null, "Land Handover", "Prepare possession certificate, remove encroachments and handover to PWD", TaskPriority.Critical, Dt(2026,7,16), Dt(2026,7,31), 19, RandomUser(DeptMilo("Land Acquisition & Site Readiness")), assignedBy, TaskStatus.NotStarted, 0, 0.25, 0, "Awaiting survey completion"),

            // M2 - Master Planning & Design
            new SeedConstants.TaskSpec(projectId, DeptMilo("Master Planning & Design"), null, "Master Layout Preparation", "Residential zoning, road planning, park and utility zoning", TaskPriority.High, Dt(2026,8,1), Dt(2026,8,8), 30, RandomUser(DeptMilo("Master Planning & Design")), assignedBy, TaskStatus.NotStarted, 0, 0.10, 0, "Pending land handover"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Master Planning & Design"), null, "Building Design", "Floor plans, elevation, structural drawings and fire exit planning", TaskPriority.Critical, Dt(2026,8,1), Dt(2026,8,18), 46, RandomUser(DeptMilo("Master Planning & Design")), assignedBy, TaskStatus.NotStarted, 0, 0.15, 0, "Pending layout approval"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Master Planning & Design"), null, "Drawing Approval", "Internal review, technical review, final approval and publish drawings", TaskPriority.High, Dt(2026,8,19), Dt(2026,8,31), 22, RandomUser(DeptMilo("Master Planning & Design")), assignedBy, TaskStatus.NotStarted, 0, 0.12, 0, "Pending design completion"),

            // M3 - Statutory Approvals
            new SeedConstants.TaskSpec(projectId, DeptMilo("Statutory Approvals"), null, "Building Plan Approval", "Upload drawings, technical scrutiny, correction cycle and final approval", TaskPriority.Critical, Dt(2026,9,1), Dt(2026,9,10), 26, RandomUser(DeptMilo("Statutory Approvals")), assignedBy, TaskStatus.NotStarted, 0, 0.20, 3, "Pending drawing handover"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Statutory Approvals"), null, "Development Permission", "Layout verification, utility verification and issue permission", TaskPriority.High, Dt(2026,9,11), Dt(2026,9,20), 18, RandomUser(DeptMilo("Statutory Approvals")), assignedBy, TaskStatus.NotStarted, 0, 0.15, 0, "Pending plan approval"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Statutory Approvals"), null, "Approval Documentation", "Digital certificate, physical certificate and upload approval", TaskPriority.Medium, Dt(2026,9,21), Dt(2026,9,30), 8, RandomUser(DeptMilo("Statutory Approvals")), assignedBy, TaskStatus.NotStarted, 0, 0.05, 0, "Pending permission"),

            // M4 - Tendering & Contractor Selection
            new SeedConstants.TaskSpec(projectId, DeptMilo("Tendering & Contractor Selection"), null, "Prepare BOQ", "Material, labour and cost estimation for all work packages", TaskPriority.Critical, Dt(2026,9,15), Dt(2026,9,20), 24, RandomUser(DeptMilo("Tendering & Contractor Selection")), assignedBy, TaskStatus.NotStarted, 0, 0.10, 0, "Pending approved drawings"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Tendering & Contractor Selection"), null, "Tender Publication", "Publish tender, vendor notification and bid schedule", TaskPriority.High, Dt(2026,9,21), Dt(2026,9,30), 10, RandomUser(DeptMilo("Tendering & Contractor Selection")), assignedBy, TaskStatus.NotStarted, 0, 0.08, 0, "Pending BOQ"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Tendering & Contractor Selection"), null, "Bid Evaluation", "Technical evaluation, financial evaluation and ranking", TaskPriority.High, Dt(2026,10,1), Dt(2026,10,20), 26, RandomUser(DeptMilo("Tendering & Contractor Selection")), assignedBy, TaskStatus.NotStarted, 0, 0.18, 2, "Pending bid submission"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Tendering & Contractor Selection"), null, "Award Contract", "Issue LOA, contract signing and work order generation", TaskPriority.Critical, Dt(2026,10,21), Dt(2026,10,31), 14, RandomUser(DeptMilo("Tendering & Contractor Selection")), assignedBy, TaskStatus.NotStarted, 0, 0.12, 0, "Pending evaluation"),

            // M5 - Site Preparation
            new SeedConstants.TaskSpec(projectId, DeptMilo("Site Preparation"), null, "Temporary Site Office", "Office cabins, internet setup and electricity connection", TaskPriority.Medium, Dt(2026,11,1), Dt(2026,11,5), 9, RandomUser(DeptMilo("Site Preparation")), assignedBy, TaskStatus.NotStarted, 0, 0.05, 0, "Pending contractor mobilization"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Site Preparation"), null, "Site Clearance", "Vegetation removal, debris removal and leveling", TaskPriority.High, Dt(2026,11,1), Dt(2026,11,10), 16, RandomUser(DeptMilo("Site Preparation")), assignedBy, TaskStatus.NotStarted, 0, 0.08, 0, "Pending site handover"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Site Preparation"), null, "Construction Mobilization", "Machinery deployment, labour mobilization and material stock", TaskPriority.High, Dt(2026,11,11), Dt(2026,11,20), 16, RandomUser(DeptMilo("Site Preparation")), assignedBy, TaskStatus.NotStarted, 0, 0.10, 0, "Pending site clearance"),

            // M6 - Foundation Construction
            new SeedConstants.TaskSpec(projectId, DeptMilo("Foundation Construction"), null, "Excavation", "Mark excavation, dig foundation and soil disposal", TaskPriority.High, Dt(2026,11,21), Dt(2026,12,5), 17, RandomUser(DeptMilo("Foundation Construction")), assignedBy, TaskStatus.NotStarted, 0, 0.15, 0, "Pending mobilization"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Foundation Construction"), null, "PCC Work", "Base preparation, PCC pouring and initial curing", TaskPriority.High, Dt(2026,12,6), Dt(2026,12,15), 13, RandomUser(DeptMilo("Foundation Construction")), assignedBy, TaskStatus.NotStarted, 0, 0.10, 0, "Pending excavation"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Foundation Construction"), null, "Reinforcement", "Steel cutting, steel tying and inspection", TaskPriority.Critical, Dt(2026,12,16), Dt(2027,1,5), 21, RandomUser(DeptMilo("Foundation Construction")), assignedBy, TaskStatus.NotStarted, 0, 0.12, 0, "Pending PCC curing"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Foundation Construction"), null, "Foundation Concrete", "Concrete pouring, vibration and final curing", TaskPriority.Critical, Dt(2027,1,6), Dt(2027,1,31), 28, RandomUser(DeptMilo("Foundation Construction")), assignedBy, TaskStatus.NotStarted, 0, 0.15, 0, "Pending reinforcement"),

            // M7 - Superstructure Construction
            new SeedConstants.TaskSpec(projectId, DeptMilo("Superstructure Construction"), null, "Columns & Beams", "Column and beam reinforcement, shuttering and concreting", TaskPriority.Critical, Dt(2027,2,1), Dt(2027,2,28), 40, RandomUser(DeptMilo("Superstructure Construction")), assignedBy, TaskStatus.NotStarted, 0, 0.20, 0, "Pending foundation completion"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Superstructure Construction"), null, "Slabs & Roofing", "Slab shuttering, reinforcement, concreting and roof waterproofing", TaskPriority.Critical, Dt(2027,3,1), Dt(2027,4,15), 42, RandomUser(DeptMilo("Superstructure Construction")), assignedBy, TaskStatus.NotStarted, 0, 0.18, 0, "Pending columns"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Superstructure Construction"), null, "Brickwork & Staircases", "External and internal brickwork and staircase construction", TaskPriority.High, Dt(2027,4,16), Dt(2027,5,31), 40, RandomUser(DeptMilo("Superstructure Construction")), assignedBy, TaskStatus.NotStarted, 0, 0.15, 0, "Pending slabs"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Superstructure Construction"), null, "Structural Inspection", "Load testing, quality audit and defect rectification", TaskPriority.High, Dt(2027,6,1), Dt(2027,7,31), 24, RandomUser(DeptMilo("Superstructure Construction")), assignedBy, TaskStatus.NotStarted, 0, 0.10, 0, "Pending brickwork"),

            // M8 - Water Supply Infrastructure
            new SeedConstants.TaskSpec(projectId, DeptMilo("Water Supply Infrastructure"), null, "Water Pipeline & Plumbing", "Pipeline trenching, pipe laying and internal plumbing", TaskPriority.High, Dt(2027,5,1), Dt(2027,6,30), 42, RandomUser(DeptMilo("Water Supply Infrastructure")), assignedBy, TaskStatus.NotStarted, 0, 0.20, 0, "Awaiting superstructure progress"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Water Supply Infrastructure"), null, "Pump House & OHT", "Pump house construction, overhead tank erection and pump installation", TaskPriority.High, Dt(2027,7,1), Dt(2027,7,31), 30, RandomUser(DeptMilo("Water Supply Infrastructure")), assignedBy, TaskStatus.NotStarted, 0, 0.15, 0, "Pending pipeline"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Water Supply Infrastructure"), null, "Pressure Testing", "Line flushing, hydro testing and leak rectification", TaskPriority.Medium, Dt(2027,8,1), Dt(2027,8,30), 16, RandomUser(DeptMilo("Water Supply Infrastructure")), assignedBy, TaskStatus.NotStarted, 0, 0.10, 0, "Pending pump house"),

            // M9 - Electrical Infrastructure
            new SeedConstants.TaskSpec(projectId, DeptMilo("Electrical Infrastructure"), null, "Transformer & Cables", "Transformer installation, HT and LT cable laying", TaskPriority.High, Dt(2027,5,15), Dt(2027,6,30), 28, RandomUser(DeptMilo("Electrical Infrastructure")), assignedBy, TaskStatus.NotStarted, 0, 0.15, 0, "Awaiting superstructure progress"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Electrical Infrastructure"), null, "Internal Wiring & Meters", "Main panel, internal wiring and meter installation", TaskPriority.High, Dt(2027,7,1), Dt(2027,8,15), 30, RandomUser(DeptMilo("Electrical Infrastructure")), assignedBy, TaskStatus.NotStarted, 0, 0.18, 0, "Pending transformer"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Electrical Infrastructure"), null, "Street Lighting & Earthing", "Street light poles, cabling and earthing system", TaskPriority.Medium, Dt(2027,8,16), Dt(2027,9,15), 22, RandomUser(DeptMilo("Electrical Infrastructure")), assignedBy, TaskStatus.NotStarted, 0, 0.12, 0, "Pending internal wiring"),

            // M10 - Sewerage & Drainage
            new SeedConstants.TaskSpec(projectId, DeptMilo("Sewerage & Drainage"), null, "Sewer Pipeline & Manholes", "Sewer trenching, pipe laying and manhole construction", TaskPriority.High, Dt(2027,6,1), Dt(2027,7,31), 40, RandomUser(DeptMilo("Sewerage & Drainage")), assignedBy, TaskStatus.NotStarted, 0, 0.18, 0, "Awaiting superstructure progress"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Sewerage & Drainage"), null, "Storm Drains & STP", "Storm drain construction, STP connection and commissioning", TaskPriority.High, Dt(2027,8,1), Dt(2027,9,15), 32, RandomUser(DeptMilo("Sewerage & Drainage")), assignedBy, TaskStatus.NotStarted, 0, 0.20, 0, "Pending sewer pipeline"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Sewerage & Drainage"), null, "Leak Testing", "Smoke testing, water test and defect rectification", TaskPriority.Medium, Dt(2027,9,16), Dt(2027,9,30), 14, RandomUser(DeptMilo("Sewerage & Drainage")), assignedBy, TaskStatus.NotStarted, 0, 0.08, 0, "Pending STP"),

            // M11 - Roads & External Development
            new SeedConstants.TaskSpec(projectId, DeptMilo("Roads & External Development"), null, "Internal Roads & Footpaths", "Subgrade preparation, base course, asphalt paving and footpaths", TaskPriority.High, Dt(2027,9,1), Dt(2027,10,15), 42, RandomUser(DeptMilo("Roads & External Development")), assignedBy, TaskStatus.NotStarted, 0, 0.20, 0, "Awaiting superstructure and utilities"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Roads & External Development"), null, "Kerbs, Parking & Marking", "Kerb installation, parking area construction and road marking", TaskPriority.Medium, Dt(2027,10,1), Dt(2027,10,31), 18, RandomUser(DeptMilo("Roads & External Development")), assignedBy, TaskStatus.NotStarted, 0, 0.10, 0, "Pending road completion"),

            // M12 - Landscaping
            new SeedConstants.TaskSpec(projectId, DeptMilo("Landscaping"), null, "Lawn & Plantation", "Soil preparation, lawn development, tree and shrub plantation", TaskPriority.Medium, Dt(2027,10,15), Dt(2027,11,5), 24, RandomUser(DeptMilo("Landscaping")), assignedBy, TaskStatus.NotStarted, 0, 0.12, 0, "Awaiting road completion"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Landscaping"), null, "Irrigation & Children's Park", "Sprinkler system, children's park and benches", TaskPriority.Medium, Dt(2027,11,1), Dt(2027,11,20), 22, RandomUser(DeptMilo("Landscaping")), assignedBy, TaskStatus.NotStarted, 0, 0.15, 0, "Pending lawn"),

            // M13 - Quality Inspection & Handover
            new SeedConstants.TaskSpec(projectId, DeptMilo("Quality Inspection & Handover"), null, "Material Testing & Audit", "Concrete core test, steel tensile test and structural audit", TaskPriority.High, Dt(2027,11,21), Dt(2027,12,5), 20, RandomUser(DeptMilo("Quality Inspection & Handover")), assignedBy, TaskStatus.NotStarted, 0, 0.10, 0, "Awaiting project completion"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Quality Inspection & Handover"), null, "Snag Correction", "Snag list preparation, contractor rectification and re-inspection", TaskPriority.High, Dt(2027,12,1), Dt(2027,12,15), 18, RandomUser(DeptMilo("Quality Inspection & Handover")), assignedBy, TaskStatus.NotStarted, 0, 0.15, 0, "Pending audit"),
            new SeedConstants.TaskSpec(projectId, DeptMilo("Quality Inspection & Handover"), null, "Final Inspection & Handover", "Final inspection, completion certificate and handover report", TaskPriority.Critical, Dt(2027,12,16), Dt(2027,12,31), 16, RandomUser(DeptMilo("Quality Inspection & Handover")), assignedBy, TaskStatus.NotStarted, 0, 0.08, 0, "Pending snag correction"),
        };
    }

    private static async Task EnsureAssignmentAsync(ApplicationDbContext context, ProjectTask task, Guid userId, Guid assignedById, CancellationToken ct)
    {
        var exists = await context.TaskAssignments.AnyAsync(a => a.TaskId == task.Id && a.UserId == userId, ct);
        if (exists)
            return;

        var assignment = TaskAssignment.Create(task.Id, userId, 0.82, "Seeded based on capacity and skills", true);
        await context.TaskAssignments.AddAsync(assignment, ct);
    }

    private sealed record SubtaskSpec(string Title, string Description, int Hours, double Progress, string Notes);
}
