# PMWDS end-to-end tests

Real-browser tests for the PMWDS core flows against the **client2** UI. They
drive the actual UI through Playwright using **text map files** that describe
every page, form, modal and button, so the page definitions live in plain text
you can read and edit without touching test code.

## Quick start

```bash
cd tests/e2e
npm install
npx playwright install chromium      # one-time browser download
npm run smoke                        # offline check: maps parse, keys resolve

# then start the app (API on :5179, client2 on :5175) and:
npm run e2e                          # interactive
npm run e2e -- --auto                # automatic
npm run e2e:auto:headless             # automatic, headless
npm run e2e:auto:visible              # automatic, visible
```

The suite targets `http://localhost:5175` by default (override with
`E2E_BASE_URL` or `--url`). Only one of `Client/` / `client2/` can hold port
5175 at a time - stop the other client first.

## The two display modes

The script asks for this **on startup, in both run modes**:

| Mode | Browser | Behaviour |
|---|---|---|
| `1` Headless *(default)* | no window | fastest; screenshots only on failure |
| `2` Visible | real window | you watch every action, slowed to 250ms, screenshot saved **before and after every step** |

```bash
npm run e2e -- --mode visible        # skip the question, go visible
npm run e2e -- --mode headless       # skip the question, stay hidden
npm run e2e:headless                  # interactive, headless
npm run e2e:visible                   # interactive, visible
npm run e2e -- --no-shots            # visible window, no per-step screenshots
npm run e2e -- --slowmo 500          # slower actions for watching
```

When passing options directly to `npm run e2e`, the first `--` tells npm to
forward the remaining arguments to the E2E script. The named scripts above
provide shortcuts for the common display and run-mode combinations.

The run prints the artifact locations at startup and again at the end:

```
Screenshots: <repo>/tests/e2e/e2e-artifacts/screenshots
Uploads:     <repo>/tests/e2e/e2e-artifacts/uploads
```

Screenshots are named `NN-<step>-before.png` / `-after.png` / `-FAILED.png`,
where `NN` is the step number across the whole run.

## The two run modes

**Interactive** (default) — stops before every step and asks. Answers at a
step gate:

| Key | Meaning |
|---|---|
| `Y` / Enter | run the step |
| `n` | skip this step |
| `s` | take a screenshot now, then ask again |
| `q` | quit the flow |

**Automatic** (`--auto`) — picks the flows once at startup, then runs them
straight through with no per-step prompts. A step failure aborts the run and
exits non-zero.

```bash
npm run e2e -- --auto                          # all flows
npm run e2e -- --auto --flows 1,3              # only flows 1 and 3
npm run e2e -- --auto --flows project-create   # or by flow id
```

## The flows

| # | Flow | Users | What it does |
|---|---|---|---|
| 1 | `project-create` | `pm` | Project manager runs the 4-step wizard: details + document, two milestones, one department per milestone, a dependency, Create project |
| 2 | `head-milestones` | `admin` | The Director adds a Procurement milestone; milestone management is Director/SuperAdmin-only in client2 |
| 3 | `tasks-subtasks` | `head-civil` | The primary department head creates two tasks and adds subtasks |
| 4 | `member-progress` | `member` | A member reads the tasks, raises subtask progress, and moves one to In Progress with a comment |
| 5 | `documents` | `pm` | Uploads a generated dummy txt at project, milestone and task level, plus a dummy PDF utilization certificate |
| 6 | `edit-delete` | `admin`, `pm` | Director edits and deletes a milestone; the PM deletes a test task |
| 7 | `project-edit-delete` | `pm` | PM edits the project, then deletes it as the final step |

Flows 2–7 read state produced by flow 1, so run `1` first (or use `--flows all`).

## Users

Every role gets its own isolated browser context, so the PM and both heads are
genuinely signed in at the same time, as in a real multi-user test.

| id | Account | Email |
|---|---|---|
| `admin` | Admin / Director | `admin@org1.com` |
| `pm` | Project Manager | `manager@org1.com` |
| `head-civil` | Head – Civil Division | `head.eng@org1.com` |
| `head-pmo` | Head – PWD Coordination | `head.pmo@org1.com` |
| `head-ops` | Head – Procurement | `head.ops@org1.com` |
| `head-revenue` | Head – Revenue Dept | `head.bstr@org1.com` |
| `head-qa` | Head – Quality Assurance | `head.csv@org1.com` |
| `head-tehsildar` | Head – Tehsildar | `sunil.yadav@up.gov.in` |
| `member` | Team Member | `member@org1.com` |
| `viewer` | Viewer | `viewer@org1.com` |
| `ee` | Executive Engineer | `dinesh.kumar@pwd.up.gov.in` |
| `electrical` | Electrical | `suresh.pandey@up.gov.in` |
| `sewerage` | Sewerage | `ramesh.yadav@up.gov.in` |
| `superadmin` | Super Admin | `superadmin@org1.com` |

Password for all seeded accounts is `Pmwds@123` by default. The runner
resolves it as `E2E_PASSWORD` from the environment, then `Seed__DefaultPassword`
from the repository-root `.env` (the same value the seeder assigns), then the
default. It is never printed.

## The map files

`maps/*.txt` — one file per area, plus `common.txt` for shared elements. The
format:

```
@page projects route=/projects desc="Projects list" requires=auth

@group step-details type=wizard page=projects desc="Step 1 of 4: Project Details"

field projectName placeholder="Enter project name" required=1
field priority css="select" nth=0,1,2
field projectDocs css="input[type='file']" hint="hidden input"
button next text="Next"
api   createProject method=POST path=/api/v1/projects
assert created text="Project created successfully!"
@end
```

Entry kinds: `field`, `button`, `nav`, `assert`, `api`.
Groups (`@group`) collect the fields and buttons that belong to one form, modal
or wizard step, which is what makes the maps match how the app is built.

**Selector attributes**, in the order the driver tries them:

| Attribute | Matches |
|---|---|
| `css=` | raw selector — wins over everything |
| `testid=` | `data-testid` |
| `aria=` | `aria-label` |
| `title=` | `title` (most icon-only buttons use only this) |
| `placeholder=` | placeholder text |
| `role=` + `name=` | accessible role and name |
| `label=` | associated label |
| `text=` | visible text |
| `root=` | scope the search to a subtree |
| `nth=` | comma list of indexes to try, e.g. `0,1,2` |
| `hover=1` | hover the row first — for `group-hover`-only buttons |
| `force=1` | click ignoring hit-testing |

When nothing matches, the driver raises a `SelectorError` naming the entry, the
`file:line` it came from, and every selector it attempted — so a broken map
tells you exactly which line to edit.

### Files

| File | Covers |
|---|---|
| `common.txt` | modal chrome, toasts, nav, progress/status controls |
| `login.txt` | `/login` |
| `projects-list.txt` | `/projects` list, search, filters, cards |
| `project-wizard.txt` | the 4-step creation wizard |
| `project-shell.txt` | `/projects/:id` tabs and nav-header actions |
| `project-milestones.txt` | milestones tab, milestone form and detail modals |
| `project-tasks.txt` | task board, task/subtask forms, progress editors |
| `project-documents.txt` | documents tab, uploads, utilization certificates |
| `project-overview.txt` | `/projects/:id` overview |
| `project-edit-delete.txt` | project edit form and delete confirmation |

## Notes on the app that shaped the maps (client2)

- The creation wizard has **no route and no deep link to a step**, so flow 1
  opens it from `/projects` and clicks Next three times, then Create project.
- client2 has **no `data-testid` attributes** and almost no `id`s — the only
  `id` is `#login-form`. Icon-only buttons carry `title`, so the maps address
  them by title. Sheet (right slide-in) close buttons read "Close panel".
- Only SuperAdmin and Director manage milestones; the task sheet has no
  estimated-hours field; subtasks on the milestones tab use an inline form
  while the tasks tab uses the "New subtask" sheet.
- Task progress is auto-calculated once subtasks exist, so flow 4 drives
  **subtask** progress rather than the parent task.
- Project/milestone deletes confirm through `ConfirmDeleteModal`
  ("Delete permanently"); task and subtask deletes in the edit sheets use a
  native `confirm()` dialog — those are accepted via a `dialog` handler.

## Layout

```
tests/e2e/
  run.ts                 entry point, mode + flow selection
  smoke.ts               offline map/key validation
  lib/
    mapfile.ts           text-map parser
    maps.ts              map loader
    driver.ts            turns map entries into browser actions
    session.ts           one browser, one context per user
    context.ts           run state, reporting, step gates
  maps/                  the page text files
  flows/                 01..07, one file per flow
```
