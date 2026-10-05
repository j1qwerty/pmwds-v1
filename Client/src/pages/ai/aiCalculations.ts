import type { BurnoutRiskRecord, DelayPrediction, Project, ProjectHealth, Task, User } from "../../types";

export type HeatmapItem = {
  name: string;
  value: number;
  risk: boolean;
  tasks: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const daysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));

function activeTasksForUser(userId: string, tasks: Task[]) {
  return tasks.filter((task) => {
    const assigned =
      task.assignedToUserId === userId ||
      task.assignees?.some((member) => member.userId === userId);
    return assigned && task.status !== "Completed" && task.status !== "Cancelled";
  });
}

export function calculateFallbackProjectHealth(
  project: Project | null,
  tasks: Task[],
  users: User[],
): ProjectHealth | null {
  if (!project) return null;

  const now = new Date();
  const start = new Date(project.plannedStartDate);
  const end = new Date(project.plannedEndDate);
  const totalDays = Math.max(1, daysBetween(start, end));
  const elapsedDays = Math.min(totalDays, daysBetween(start, now));
  const expectedProgress = clamp(elapsedDays / totalDays) * 100;
  const actualProgress = clamp(project.progressPercentage / 100) * 100;
  const scheduleLag = Math.max(0, expectedProgress - actualProgress);
  const overdueDays = now > end && actualProgress < 100 ? daysBetween(end, now) : 0;

  const scheduleHealth = clamp(
    1 -
      scheduleLag / 100 -
      Math.min(overdueDays / Math.max(totalDays, 1), 0.5),
  );
  const budgetHealth =
    project.plannedBudget > 0
      ? clamp(
          1 -
            Math.max(0, project.actualCost - project.plannedBudget) /
              project.plannedBudget,
        )
      : 1;

  const members = users.filter((user) => user.isActive);
  const averageAvailability = members.length
    ? members.reduce(
        (sum, user) => sum + clamp(user.availabilityPercentage / 100),
        0,
      ) / members.length
    : 0.85;
  const activeTaskPressure = members.length
    ? clamp(
        tasks.filter(
          (task) => task.status !== "Completed" && task.status !== "Cancelled",
        ).length / Math.max(1, members.length * 6),
      )
    : clamp(tasks.length / 12);
  const teamHealth = clamp(
    1 - activeTaskPressure * 0.65 - (1 - averageAvailability) * 0.35,
  );

  const completed = tasks.filter(
    (task) => task.status === "Completed" || task.progressPercentage >= 100,
  ).length;
  const overdue = tasks.filter((task) => task.isOverdue).length;
  const qualityHealth = tasks.length
    ? clamp(
        completed / tasks.length -
          overdue / Math.max(tasks.length * 2, 1) +
          0.5,
      )
    : 0.85;
  const overall = clamp(
    scheduleHealth * 0.4 +
      budgetHealth * 0.25 +
      teamHealth * 0.2 +
      qualityHealth * 0.15,
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (actualProgress >= expectedProgress) {
    strengths.push("Delivery progress is at or ahead of the expected schedule.");
  }
  if (budgetHealth >= 0.8) {
    strengths.push("Current spending is within the planned budget.");
  }
  if (teamHealth >= 0.8) {
    strengths.push("Team capacity is currently healthy.");
  }
  if (scheduleLag > 10) {
    weaknesses.push(
      String(Math.round(scheduleLag)) +
        " percentage points behind the expected schedule.",
    );
  }
  if (overdue > 0) {
    weaknesses.push(String(overdue) + " task(s) are overdue.");
  }
  if (budgetHealth < 0.8) {
    weaknesses.push("Current cost is putting pressure on the project budget.");
  }

  return {
    projectId: project.id,
    projectName: project.name,
    overallHealthScore: overall,
    scheduleHealth,
    budgetHealth,
    teamHealth,
    qualityHealth,
    healthStatus:
      overall >= 0.75 ? "Healthy" : overall >= 0.5 ? "At Risk" : "Critical",
    strengths,
    weaknesses,
    recommendations: [
      scheduleLag > 10
        ? "Review overdue work and rebalance the near-term plan."
        : "Keep monitoring milestone progress.",
      budgetHealth < 0.8
        ? "Review current spend against the remaining planned budget."
        : "Continue tracking actual cost against the approved budget.",
      teamHealth < 0.7
        ? "Review assignment load and team availability."
        : "Maintain the current workload balance.",
    ],
    risks: [
      {
        category: "Schedule",
        description:
          scheduleLag > 10
            ? "Current progress is below the expected schedule."
            : "No major schedule gap detected.",
        probability: clamp(scheduleLag / 100),
        severity:
          scheduleLag > 25 ? "High" : scheduleLag > 10 ? "Medium" : "Low",
        mitigationStrategy:
          "Review due dates and reprioritize delayed work.",
      },
      {
        category: "Budget",
        description:
          budgetHealth < 0.8
            ? "Actual cost is putting pressure on the planned budget."
            : "Budget position is stable.",
        probability: clamp(1 - budgetHealth),
        severity:
          budgetHealth < 0.6 ? "High" : budgetHealth < 0.8 ? "Medium" : "Low",
        mitigationStrategy:
          "Review remaining spend and upcoming commitments.",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function calculateFallbackDelay(task: Task | null): DelayPrediction | null {
  if (!task) return null;

  const now = new Date();
  const start = new Date(task.startDate);
  const due = new Date(task.dueDate);
  const progress = clamp(task.progressPercentage / 100);

  if (progress >= 1 || task.status === "Completed") {
    return {
      taskId: task.id,
      delayProbability: 0,
      expectedDelayDays: 0,
      predictedCompletionDate: task.completedDate ?? task.dueDate,
      riskLevel: "Low",
      contributingFactors: [],
      mitigationStrategies: ["Task is already complete."],
      shouldEscalate: false,
    };
  }

  const elapsedDays = Math.max(1, daysBetween(start, now));
  const observedRate = progress / elapsedDays;
  const projectedTotalDays =
    observedRate > 0
      ? Math.ceil(1 / observedRate)
      : Math.max(1, daysBetween(start, due));
  const projectedCompletion = new Date(
    start.getTime() + projectedTotalDays * 86_400_000,
  );
  const expectedDelayDays =
    projectedCompletion > due
      ? daysBetween(due, projectedCompletion)
      : 0;
  const overdueDays = now > due ? daysBetween(due, now) : 0;
  const delayProbability = clamp(
    (expectedDelayDays / Math.max(daysBetween(start, due), 1)) * 0.7 +
      Math.min(overdueDays / 14, 1) * 0.3 +
      (task.isEscalated ? 0.15 : 0),
  );

  const contributingFactors: string[] = [];
  if (expectedDelayDays > 0) {
    contributingFactors.push(
      String(expectedDelayDays) + " projected delay day(s)",
    );
  }
  if (task.isOverdue) contributingFactors.push("Task is overdue");
  if (task.isEscalated) contributingFactors.push("Task is escalated");
  if (task.progressPercentage < 25 && now > due) {
    contributingFactors.push("Progress is still low");
  }

  return {
    taskId: task.id,
    delayProbability,
    expectedDelayDays,
    predictedCompletionDate: projectedCompletion.toISOString(),
    riskLevel:
      delayProbability >= 0.7
        ? "High"
        : delayProbability >= 0.4
          ? "Medium"
          : "Low",
    contributingFactors,
    mitigationStrategies: [
      expectedDelayDays > 0
        ? "Reprioritize the remaining work and check blockers."
        : "Keep the task on the current plan.",
      "Review the next due milestone before committing additional work.",
    ],
    shouldEscalate: delayProbability >= 0.7,
  };
}

export function calculateFallbackBurnout(
  users: User[],
  tasks: Task[],
  departmentId?: string | null,
): BurnoutRiskRecord[] {
  return users
    .filter(
      (user) =>
        user.isActive &&
        (!departmentId || user.departmentId === departmentId),
    )
    .map((user) => {
      const activeTasks = activeTasksForUser(user.id, tasks);
      const overdueTasks = activeTasks.filter((task) => task.isOverdue).length;
      const estimatedHours = activeTasks.reduce(
        (sum, task) => sum + Math.max(0, task.estimatedHours || 0),
        0,
      );
      const workloadScore = clamp(
        (activeTasks.length / 6) * 0.55 +
          (estimatedHours / 40) * 0.35 +
          (overdueTasks / 3) * 0.1,
      );
      const availabilityPressure = 1 - clamp(user.availabilityPercentage / 100);
      const burnoutRisk = clamp(
        workloadScore * 0.65 +
          availabilityPressure * 0.25 +
          (overdueTasks / 3) * 0.1,
      );

      return {
        userId: user.id,
        fullName: user.fullName,
        burnoutRisk,
        workloadScore,
        activeTasks: activeTasks.length,
        riskLevel:
          burnoutRisk >= 0.8
            ? "Critical"
            : burnoutRisk >= 0.6
              ? "High"
              : burnoutRisk >= 0.4
                ? "Medium"
                : "Low",
        recommendations: [
          activeTasks.length > 5
            ? "Review task assignments and shift non-critical work."
            : "Keep the current task load under review.",
          overdueTasks > 0
            ? "Address overdue tasks before adding more work."
            : "No overdue work is currently affecting the workload estimate.",
        ],
      };
    })
    .sort((a, b) => b.burnoutRisk - a.burnoutRisk);
}

export function calculateHeatmap(tasks: Task[], users: User[]): HeatmapItem[] {
  const groups = new Map<
    string,
    { tasks: number; overdue: number; hours: number }
  >();

  tasks
    .filter((task) => task.status !== "Completed" && task.status !== "Cancelled")
    .forEach((task) => {
      const user = task.assignedToUserId
        ? users.find((candidate) => candidate.id === task.assignedToUserId)
        : null;
      const name = user?.department || "Unassigned";
      const current = groups.get(name) ?? { tasks: 0, overdue: 0, hours: 0 };
      current.tasks += 1;
      current.overdue += task.isOverdue ? 1 : 0;
      current.hours += Math.max(0, task.estimatedHours || 0);
      groups.set(name, current);
    });

  const entries = Array.from(groups.entries()).map(([name, value]) => {
    const intensity =
      clamp(
        (value.tasks * 0.45 +
          (value.hours / 40) * 0.4 +
          value.overdue * 0.15) /
          3,
      ) * 100;

    return {
      name,
      value: Math.round(intensity),
      risk: intensity >= 70 || value.overdue >= 2,
      tasks: value.tasks,
    };
  });

  return entries.length
    ? entries.sort((a, b) => b.value - a.value).slice(0, 8)
    : [{ name: "No active work", value: 0, risk: false, tasks: 0 }];
}

export function calculateTimelinePrediction(project: Project) {
  const now = new Date();
  const start = new Date(project.plannedStartDate);
  const due = new Date(project.plannedEndDate);
  const totalDays = Math.max(1, daysBetween(start, due));
  const elapsedRatio = clamp(daysBetween(start, now) / totalDays);
  const expectedProgress = elapsedRatio * 100;
  const progress = clamp(project.progressPercentage / 100) * 100;
  const lag = expectedProgress - progress;

  let status = "On Track";
  let color = "indigo";
  if (project.status === "Delayed" || lag > 20) {
    status = "At Risk";
    color = "red";
  } else if (lag < -10) {
    status = "Ahead";
    color = "emerald";
  }

  let projectedEnd = due;
  if (progress > 0) {
    const totalProjectedDays =
      daysBetween(start, now) / (progress / 100);
    if (Number.isFinite(totalProjectedDays)) {
      projectedEnd = new Date(
        start.getTime() + totalProjectedDays * 86_400_000,
      );
    }
  }

  const statusText =
    projectedEnd > due
      ? "Estimated completion: " + projectedEnd.toLocaleDateString()
      : "Planned completion: " + due.toLocaleDateString();

  return {
    name: project.name,
    progress: Math.round(progress),
    status,
    color,
    text: statusText,
  };
}
