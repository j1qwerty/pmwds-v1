# PMWDS Demo — Human Walkthrough (client2 UI)

Step-by-step instructions for a human driving the app in a browser. No test
runner, no code — just the running API + **client2** UI.

Automated coverage of the same journey lives in `tests.md` (browser E2E) and
`browser-tests/`. This file is the manual version.

## 0. Before you start

You need two terminals running:

```powershell
# terminal 1 - API (required)
dotnet run --project PMWDS.API --urls http://localhost:5179

# terminal 2 - client2 UI (required)
cd client2
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

Then open:

```text
client2: http://localhost:5175
API swagger (optional): http://localhost:5179/swagger
```

> Only one of `Client/` / `client2/` can hold port `5175` at a time. If the page
> does not load, stop the other client first.

Seeded password for every account below:

```text
Pmwds@123
```

If login fails for all accounts, the seed password is wrong — check
`Seed__DefaultPassword` in the repository `.env` (the seeder and the E2E runner
both read it).

## 1. Log in

1. Go to `http://localhost:5175/login`.
2. Enter any account from the table below + password `Pmwds@123`.
3. Click **Sign In**. You land on `/` (Dashboard).
4. The login page also offers **Dev Quick Login** buttons — clicking one fills
   the form and submits it.

### Demo accounts (password `Pmwds@123` for all)

| Who | Email | What to show |
|---|---|---|
| SuperAdmin | `superadmin@org1.com` | Everything; final delete at the end |
| Director / Admin | `admin@org1.com` | Milestone + task creation, project edits |
| Project Manager | `manager@org1.com` | Creates the demo project |
| Chief Engineer | `rajesh.verma@pwd.up.gov.in` | Project visibility (PM view) |
| Dept Head A — Civil | `head.eng@org1.com` | Scoped milestone/task work (PWDC) |
| Dept Head B — PMO | `head.pmo@org1.com` | Scoped work (PWD) |
| Dept Head C — Operations | `head.ops@org1.com` | Scoped work + task deletion (PROC) |
| Team Member A | `member@org1.com` | Subtask progress, document upload |
| Team Member B | `dinesh.kumar@pwd.up.gov.in` | Subtask progress, document upload |
| Team Member C | `manoj.tiwari@up.gov.in` | Subtask progress, document upload |
| Viewer | `viewer@org1.com` | Read-only: sees the project, no New buttons |

## 2. Guided demo script (~15 minutes)

### Act 1 — Project Manager creates the project (3 min)

1. Log in as **Project Manager** (`manager@org1.com`).
2. Sidebar → **Projects** (`/projects`) → **New Project**.
3. **Step 1 — Project Details:** name it `Demo <today's date>`, description
   `Demo lifecycle project.`, Priority `High`, budget `12.5` (lakhs), start
   `2026-11-01`, end `2027-06-30`. Click **Next**.
4. **Step 2 — Milestones:** leave empty for now (Director adds them later).
   Click **Next**.
5. **Step 3 — Assign Departments:** leave empty. Click **Next**.
6. **Step 4 — Dependencies:** leave empty. Click **Next** — or **Create
   project** if it is the last visible step. (The wizard persists a draft in
   `localStorage`; **History** restores it.)
7. If a Departments step appears, tick **Public Works Department**,
   **PWD Civil Division**, **Procurement & Finance** — milestones later must
   belong to a department assigned to the project, or the API rejects them (400).
8. Finish. You land on `/projects/<id>` (overview / milestones tab). Note the
   project name — every later act uses it.
9. Go back to **Projects** and confirm the new card is listed.

### Act 2 — Director adds structure (4 min)

1. Log out (avatar → logout) and log in as **Director** (`admin@org1.com`).
2. **Projects** → open the demo project → **Milestones** tab
   (`/projects/<id>/milestones`).
3. **New milestone** × 3:
   - `PWD Coordination Milestone` — Department `Public Works Department`, due `2027-03-31`
   - `Civil Works Milestone` — Department `PWD Civil Division`, due `2027-03-31`
   - `Procurement Milestone` — Department `Procurement & Finance`, due `2027-03-31`
4. Edit `PWD Coordination Milestone` → rename to
   `PWD Coordination Milestone Updated` → **Save**.
5. Open a milestone → **New task** × 4 (title, description, start `2026-11-05`,
   due `2027-02-28`, `24` est. hours, Priority `High`):
   - `Civil Site Review Task`, `Civil Quality Review Task` (under Civil milestone)
   - `Coordination Review Task` (under PWD milestone)
   - `Procurement Review Task` (under Procurement milestone)
6. **Tasks** tab (`/projects/<id>/tasks`) — confirm all four tasks render.
7. **Dependencies** tab (`/projects/<id>/dependencies`) → **New** → Prerequisite
   `PWD Coordination Milestone Updated`, Dependent `Civil Works Milestone` →
   **Add**.

### Act 3 — Department Heads do scoped work (3 min)

Repeat per head (log out/in each time):

| Head | Sees | Does |
|---|---|---|
| A — Civil (`head.eng@org1.com`) | Civil milestone + its tasks | Open task → **Add subtask** (`<task> Subtask`) → edit task description → Save |
| B — PMO (`head.pmo@org1.com`) | PWD milestone + Coordination task | Same: subtask + edit |
| C — Operations (`head.ops@org1.com`) | Procurement milestone + task | Same: subtask + edit |

Note: some heads intentionally have no **New milestone** button — that is the
scoped-permission behaviour, not a bug.

### Act 4 — Team Members execute (3 min)

Repeat per member:

| Member | Task | Does |
|---|---|---|
| A (`member@org1.com`) | `Civil Site Review Task` | Open task → open subtask → drag progress to ~65 → add comment → Enter |
| B (`dinesh.kumar@pwd.up.gov.in`) | `Civil Quality Review Task` | Same |
| C (`manoj.tiwari@up.gov.in`) | `Procurement Review Task` | Same + upload: **Documents** tab → **Upload document** → pick any small `.txt` → level `task` → select the task → **Upload** |

### Act 5 — Verify, edit, clean up (2 min)

1. Log in as **Chief Engineer** → Projects → open the demo project (visibility check).
2. Log in as **Viewer** (`viewer@org1.com`) → open the project → confirm **no**
   New task / New milestone buttons (read-only).
3. Log in as **Dept Head C** → Milestones tab → open `Procurement Review Task`
   → Delete task → **Delete Permanently** → confirm it disappears.
4. Log in as **Project Manager** → project page → **Edit project** (pencil) →
   change Description → **Save**.
5. Log in as **Director** → **Edit project** → change Name → **Save**.
6. Log in as **SuperAdmin** → project page → **Delete project** →
   **Delete Permanently** → you return to `/projects`.
7. On **Projects**, confirm the demo project is gone.

## 3. Other pages worth opening

Sidebar (visibility is permission-gated, so some roles hide some entries):

- `/` Dashboard — stats, charts, activity
- `/projects` Projects list (+ per-project tabs: overview, milestones, tasks, dependencies, documents)
- `/notificationsPage` Notifications (inbox, templates, rules, broadcast)
- `/organizationStructure` Organizations
- `/departmentsPage` Departments
- `/users`, `/profiles` Users and profiles
- `/ai` AI Insights (allocation, delay, burnout)
- `/reports`, `/reports/view` Reports
- `/roles` Roles and permissions
- `/activity-logs` Activity log
- `/settings` Settings (admin only)

## 4. If something looks wrong

- Blank login / endless spinner → API not running. Start it (terminal 1) and retry.
- `localhost:5175` refuses connection → client2 not running, or `Client/` is
  holding the port. Run `cd client2; npm run dev` and stop the other client.
- Invalid email or password → wrong `Seed__DefaultPassword`. All seeded accounts
  share the `.env` value.
- Empty department/user dropdowns in the wizard → hard-refresh; the wizard merges
  live + cached reference data.
- Want the scripted version of this exact journey? See `tests.md` →
  `pnpm btest` (headless) or `pnpm btest:headed` (watch it happen).
