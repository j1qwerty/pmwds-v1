# PMWDS Demo — Human Walkthrough

The same journey the automated E2E suite drives (`tests/e2e`), written out for a
person clicking through the browser. Follow the flows in order — each one builds
on the state the previous ones created.

**7 flows · 20 steps**

| # | Flow | Steps | Who signs in |
|---|---|---|---|
| 1 | Project creation wizard | 5 | Project Manager |
| 2 | Director adds a Procurement milestone | 1 | Director |
| 3 | Department head creates tasks, PM adds subtasks | 2 | Dept Head (Civil), then PM |
| 4 | Team member checks work and updates progress | 3 | Team Member |
| 5 | Document + certificate uploads | 4 | Project Manager |
| 6 | Edit and delete a milestone, delete a task | 3 | Director, then PM |
| 7 | Edit and delete the project | 2 | Project Manager |

All accounts share the password `Pmwds@123`.

| Role | Email |
|---|---|
| Project Manager | `manager@org1.com` |
| Director | `admin@org1.com` |
| Dept Head — Civil | `head.eng@org1.com` |
| Team Member | `member@org1.com` |

`<STAMP>` below is today's date and time as `YYYYMMDD-HHMMSS` (e.g.
`20261013-142530`). Use one value for the whole run so every name lines up.

---

## Flow 1 — Project creation wizard (5 steps)

*Project Manager — `manager@org1.com`*

### 1. Open the wizard
Sidebar → **Projects** → **New Project**.

### 2. Step 1 of 4 — Project Details
- Name: `E2E Water Works <STAMP>`
- Description: `Automated end-to-end test project created <STAMP>. Safe to delete.`
- Priority: `High`
- Budget: `120` (lakhs)
- Start date: today · End date: today + 120 days

→ **Next**

### 3. Step 2 of 4 — Milestones
Add three, one per department. → **Add milestone**, fill, **Add milestone**.

| Name | Description | Due | Critical | Department (set in step 3) |
|---|---|---|---|---|
| `Survey & Design <STAMP>` | Site survey, drawings and design sign-off. | today + 25 days | ✔ | PWD Civil Division (PWDC) |
| `Execution Phase 1 <STAMP>` | First construction package. | today + 55 days | ✘ | Public Works Department (PWD) |
| `Procurement Handover <STAMP>` | Vendor selection and material release. | today + 85 days | ✘ | Procurement & Finance (PROC) |

→ **Next**

### 4. Step 3 of 4 — Assign Departments
One department per milestone, in the same order as above: **PWDC**, **PWD**,
**PROC**. → **Next**

> Every department used later must be assigned here. A milestone whose
> department is not on the project is rejected by the API with a 400.

### 5. Step 4 of 4 — Dependencies
- **New dependency**
- Prerequisite `Survey & Design <STAMP>` → Dependent `Execution Phase 1 <STAMP>`
- Rule: `Must complete` → **Add dependency**

→ **Create project**. You land on the project page.

---

## Flow 2 — Director adds a Procurement milestone (1 step)

*Director — `admin@org1.com`*

### 6. Create the milestone
**Milestones** tab → **New milestone**
- Name: `Procurement Package <STAMP>`
- Description: `Deliverables owned by Procurement.`
- Due date: today + 45 days
- Department: `Procurement & Finance`

→ **Create milestone**

---

## Flow 3 — Tasks and subtasks (2 steps)

### 7. Department head creates two tasks

*Dept Head — Civil — `head.eng@org1.com`*

**Tasks** tab → **New task**, twice:

| Title | Description | Start | Due | Priority | Milestone |
|---|---|---|---|---|---|
| `Task head-civil-1 <STAMP>` | Task created by head-civil during e2e run. | today | today + 14 days | High | `Survey & Design <STAMP>` |
| `Task head-civil-2 <STAMP>` | Task created by head-civil during e2e run. | today | today + 21 days | Medium | `Survey & Design <STAMP>` |

In **Assignees** search for and add **Ananya Patel**, then **Rohan Iyer**.
→ **Create task**.

### 8. Project manager adds subtasks

*Project Manager — `manager@org1.com`*

Open `Task head-civil-1 <STAMP>` → **Add subtask**, twice:

| Title | Assignee |
|---|---|
| `Subtask head-civil-1.1` | Ananya Patel |
| `Subtask head-civil-1.2` | Ananya Patel |

---

## Flow 4 — Team member progress (3 steps)

*Team Member — `member@org1.com`*

### 9. Confirm the task is visible
**Tasks** tab. You can see `Task head-civil-1 <STAMP>` because you are assigned
to it.

### 10. Raise a subtask to 40%
Open `Subtask head-civil-1.1` → set progress to `40` → comment
`Progress moved to 40% by member during e2e run.` → **Update** → close.

### 11. Move a subtask to In Progress
Open `Subtask head-civil-1.2` → status dropdown → **In progress** → **Update** →
close.

---

## Flow 5 — Documents and certificate (4 steps)

*Project Manager — `manager@org1.com`*

Create a small text file to upload, e.g. `e2e-dummy.txt`:

```
PMWDS end-to-end test attachment.
Generated: <today's timestamp>
This is a dummy file used to exercise the document upload path.
------------------------------------------------------------
```

And a small PDF named `e2e-dummy-cert.pdf` for the certificate.

### 12. Upload at project level
**Documents** tab → **Upload document** → choose `e2e-dummy.txt` → level
`Project` → **Upload**.

### 13. Upload at milestone level
→ **Upload document** → `e2e-dummy.txt` → level `Milestone` → pick the first
milestone → **Upload**.

### 14. Upload at task level
→ **Upload document** → `e2e-dummy.txt` → level `Task` → pick the first task →
**Upload**.

### 15. Submit a utilization certificate
Click the **UC** filter chip → **Submit UC**
- Number: `UC-E2E-12345`
- Funding source: `Government Grant (e2e)`
- Amount claimed: `500000`
- Amount utilized: `250000`
- Period: today → today + 30 days
- File: `e2e-dummy-cert.pdf`

→ save as draft.

---

## Flow 6 — Edit and delete (3 steps)

### 16. Director edits the Procurement milestone

*Director — `admin@org1.com`*

**Milestones** tab → hover `Procurement Package <STAMP>` → **Edit** → rename to
`Procurement Package <STAMP> (edited)`, due date today + 50 days → **Save**.

### 17. Director deletes it
Same tab → open `Procurement Package <STAMP> (edited)` → **Delete** →
**Delete Permanently**.

> Deleting a milestone deletes its tasks and subtasks too.

### 18. Project manager deletes a task

*Project Manager — `manager@org1.com`*

**Tasks** tab → open `Task head-civil-2 <STAMP>` → **Delete** → confirm.

---

## Flow 7 — Edit and delete the project (2 steps)

*Project Manager — `manager@org1.com`*

### 19. Edit the project
Project page → **Overview** tab → **Edit project** → pencil
- Name: `E2E Water Works <STAMP> [edited]`
- Description: `E2E Water Works <STAMP> - description edited by pm during the e2e run.`
- Priority: `Critical`

→ **Save**.

### 20. Delete the project
Project page → **Overview** tab → **Delete project** → **Delete Permanently** →
you return to `/projects` and the project is gone.

---

## Things that look wrong but are not

- Some roles have no **New milestone** button — milestone management is scoped
  by permission, and the ProjectManager creates milestones through the wizard
  instead.
- A milestone must belong to a department already assigned to the project, or
  the API answers 400.
- A dependency row may read **Other department** on one side — that is another
  team's milestone which you are not permitted to see, not missing data.
