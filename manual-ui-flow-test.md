# Manual UI flow test — client (ex-client2) + local API

- Date: 2026-10-11
- Client: http://localhost:5175/ (vite dev, `client/`)
- API: http://localhost:5179/ (`PMWDS.API`, SQLite fallback `App_Data/pmwds-v1.sqlite`)
- Seed password: `Pmwds@123`
- Browser: internal browser tab (snapshot/click/fill/select/screenshot)
- Note: `http://127.0.0.1:5175/` 502s from the internal browser because vite binds
  `[::1]` (IPv6 loopback); `http://localhost:5175/` works.

## Login smoke
| # | Step | Result |
|---|------|--------|
| 0 | Open http://localhost:5175/ → lands on login page | PASS — title PMWDS, login form rendered |
| 1 | Manual login form: email `manager@org1.com` + password `Pmwds@123` → Sign In | PASS — dashboard loads, `pmwds-client-auth` in localStorage. NOTE: harness `fill` appended text on this React form (values doubled); set exact values via page JS then clicked Sign In |

## Act 1 — PM creates project
| # | Step | Result |
|---|------|--------|
| 2 | Sidebar → Projects (`/projects`): 4 seeded projects listed, filters + card/list toggle render | PASS |
| 3 | Topbar **New Project** → wizard modal (bare, no outer white card/X) | PASS with note — a11y ref-click missed once (stale ref); clicked via page JS. Modal scrim + steps header + step card render |
| 4 | Step 1 Project Details: name `Demo 2026-10-11`, desc, Priority High, budget 12.5, 2026-11-01 → 2027-06-30 → Next | PASS — advanced to Step 2 |
| 5 | Step 2 Milestones empty → Next **disabled** ("At least one milestone is required") — script's "leave empty" not possible | DEVIATION — added milestone `Demo Kickoff`, due 2027-01-31 via inline form (note: harness fill hit the list search box behind modal first; cleared it, targeted `Milestone name` precisely) |
| 6 | Step 3 Assign Departments → set `Public Works Department` on Demo Kickoff → Next | PASS — reached Step 4 |
| 7 | Step 4 Dependencies empty → **Create project** | PASS — landed `/projects/9da628f3-6980-4410-9466-5656e335412e/milestones`. Topbar: colored back button, title-only `Milestones · Demo 2026-10-11`, New milestone + New task actions. **PM sees New milestone button (permission fix verified live)** |
| 8 | Back to Projects via topbar back button → demo card listed | PASS |

## Act 2 — Director adds structure (as `admin@org1.com`)
| # | Step | Result |
|---|------|--------|
| 9 | Sidebar avatar click → logged out to `/login` (no confirm) | PASS |
| 10 | DEV QUICK LOGIN → Admin `admin@org1.com` | PASS — dashboard as Director, demo project listed |
