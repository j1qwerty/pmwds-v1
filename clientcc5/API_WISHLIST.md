# Suggested backend additions

The new Command Center dashboard works with today's endpoints. These additions would make it
faster and let the UI go further. Each is optional and independent.

1. GET /dashboard/summary
   One call returning { projects: counts, tasks: counts, budget: {planned, spent},
   topProjects: [top 8 by urgency with progress, risk, plannedEnd], escalations: [...],
   activity7d: [{date, count, byType}] }.
   Today the page makes 6 requests (projects/dashboard, projects, tasks/dashboard-summary,
   tasks/escalated, notifications, activitylogs/team?limit=200) and buckets 200 log rows in the
   browser. A server-side summary removes that fan-out.

2. GET /projects?fields=nav,progress,risk&sort=urgency&limit=8
   A slim, server-sorted project list so the dashboard does not download full Project objects.

3. GET /me/work
   "My work": tasks assigned to me due today / this week / overdue, with project names.
   Enables a personal "Today" panel at the top of the dashboard.

4. GET /projects/{id}/health-timeline
   Weekly progress and risk score history. Enables a trend line per project.

5. GET /search?q=
   Single ranked endpoint (projects, tasks, people, documents) for the Ctrl K palette.

6. PATCH /notifications/read-all
   "Mark all as read" button on the inbox and dashboard.

7. GET /activitylogs/team/summary?days=7
   Pre-aggregated counts by day and type (replaces the 200-row fetch).
