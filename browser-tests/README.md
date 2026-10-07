# PMWDS browser tests

These tests use Playwright and visible/headless Chromium to exercise the application through the real browser UI.

## Setup

Run the client and API first, then:

```powershell
cd browser-tests
pnpm install
pnpm install:browsers

$env:E2E_BASE_URL = "http://127.0.0.1:5175"
$env:E2E_PASSWORD = "Pmwds@123"
```

## Commands

```powershell
# UI discovery and grouped page inventories
pnpm e2e:discover

# User-assisted run. The script asks for browser mode and run mode.
pnpm e2e:interactive

# Automatic run. The script still asks for browser mode and lets you select flows.
pnpm e2e

# Playwright Test directly
pnpm test

# Visible Playwright test mode
pnpm test:headed
```

The browser runner defaults to headless Chromium. Choose visible Chromium to watch the run on screen.

The full business lifecycle uses separate browser contexts for each seeded role. It covers project creation through the real wizard, project visibility, department-scoped milestones, task and subtask work, role hand-offs, subtask progress, document upload, project editing, task deletion, read-only viewer access, and final project deletion.

Every logical step captures a before/after screenshot. The run also writes grouped UI inventories and redacted request/response payload logs under `browser-tests/runs/`.

The destructive flow creates real test records and deletes them at the end. Run it only against a disposable test environment.
