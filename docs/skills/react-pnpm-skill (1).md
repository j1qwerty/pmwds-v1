# React + pnpm Skill

## ⚠️ IMPORTANT — Environment Detection (Read First)

**Before doing anything else, determine the execution environment.** The workflow, tooling, and final deliverable differ significantly depending on where the project is being built.

### Step 0 — Detect Environment

Identify which of the following applies:

1. **Local computer** (developer's own machine with full tooling access).
2. **Virtualized container / hosted platform** (e.g., cloud sandbox, CI-like environment, restricted container) where tools, network, or dependency installs may be limited.
3. **GitHub-connected environment** (a repo is linked / a remote origin exists and push access is available).

Detection signals to check:
- Presence of `.git/config` with a remote pointing to GitHub (`git remote -v`).
- Container markers (`/.dockerenv`, `/proc/1/cgroup`, CI env vars like `CI=true`, `CODESPACES`, `GITPOD_*`, `REPL_*`, etc.).
- Ability to write outside the project, install global tools, and reach the network.

### Step 0.1 — Behavior by Environment

**If running inside a virtualized container / restricted platform:**
- Some tools, dependencies, or network operations may be unavailable. **Do not block delivery on this.**
- Attempt **pnpm + TypeScript** first.
  - If `pnpm install` and typecheck succeed → run the build → produce the **final ZIP**.
  - If **pnpm fails** (unavailable, install errors, network restrictions) → fall back to **npm**. If npm succeeds → run the build → produce the **final ZIP**.
- Even if **not all steps can be completed**, still produce and deliver the **final ZIP** with what was achieved, and clearly document in `README.md` / delivery notes what was skipped, why, and what the user must run locally.
- Never leave the user without a deliverable on containerized environments.

**If GitHub is connected (remote origin + push access):**
- Create a branch and **open a Pull Request** with the implementation.
- After the PR is filed, **also deliver the final ZIP**.

**If running on a local computer:**
- **Do NOT produce a ZIP.**
- Make **git commits at every significant step** (setup, each major feature, Firebase/Netlify wiring, dark mode, docs, validation, review fixes).
- Use clear, conventional commit messages.
- Use the **Firebase CLI** and **Netlify CLI** for setup, deployment, and local emulation.
- Follow the documented workflows in:
  - **`netlify-skill.md`** — Netlify CLI, configuration, deployment, redirects, env vars.
  - **`firebase-skill.md`** — Firebase CLI, project setup, Firestore, rules, emulators.

> **Rule of thumb:** Local → commits, no ZIP, use CLIs. Container → best-effort build, always ZIP. GitHub-connected → PR + ZIP.

---

## Purpose

Build production-ready **React frontend-only projects** using pnpm, TypeScript, Prettier, the shared `design.md` system, responsive UX, dark mode, animation, optional Firebase integration, and final ZIP packaging.

**All visual, UX, component, interaction, layout, theme, accessibility, animation, dashboard, admin-panel, command-palette, and onboarding rules are defined in `design.md`.**

### Referenced Skills

- **`design.md`** — design system, UX, components, theming, accessibility, animation.
- **`netlify-skill.md`** — Netlify CLI, configuration, deployment, SPA redirects, env vars (used on local computers).
- **`firebase-skill.md`** — Firebase CLI, project setup, Firestore, security rules, emulators (used on local computers).

Always consult these files when their domain applies.

---

## Mandatory Workflow

1. **Detect the environment** (see Environment Detection above) and branch behavior accordingly.
2. Create a TODO before implementation.
3. Review requirements, scope, PRD, clarifications, and existing project documentation.
4. **Before implementation, ask whether Firebase and an admin panel are wanted for contact/inquiry forms and similar functionality when this has not already been specified.**
5. Set up the project and dependencies.
6. Implement pages, components, application logic, and responsive behavior.
7. Follow `design.md` for all design and UX decisions.
8. Implement Firebase only when required/approved (reference `firebase-skill.md`; use the Firebase CLI on local computers).
9. Implement admin functionality only when required/approved.
10. Configure images, links, external resources, and environment variables.
11. Implement dark mode.
12. Configure Netlify when applicable (reference `netlify-skill.md`; use the Netlify CLI on local computers).
13. Add documentation.
14. Validate build, formatting, types, linting/tests when configured.
15. Perform a final visual, responsive, accessibility, performance, and security review.
16. Add TODO items discovered during review and complete them.
17. Remove unnecessary files and local-only artifacts.
18. **Deliver according to environment:**
    - Local → git commits at every significant step, no ZIP.
    - Container → best-effort build, always ZIP.
    - GitHub-connected → open a PR, then deliver ZIP.

### TODO must cover

- environment detection and behavior branch
- requirements/scope/PRD review
- project setup
- dependencies/configuration
- UI/pages/components
- responsive behavior
- logical UX flows
- animation/visual polish
- Firebase decision/integration
- admin-panel decision/integration
- image/link handling
- dark mode
- onboarding/tours
- command palette when applicable
- Netlify configuration when applicable
- documentation
- testing/validation
- visual review
- accessibility review
- performance review
- security review
- environment-appropriate delivery (commits / PR / ZIP)
- packaging and ZIP delivery (when applicable)

**Do not install dependencies or start implementation until the initial TODO exists.**

---

## Stack & Setup

- React + TypeScript.
- **pnpm is mandatory on local computers.** In restricted containers, fall back to npm only if pnpm is unavailable or fails — and document the fallback.
- Use the project's appropriate modern React tooling.
- Configure Prettier.
- Keep configuration production-oriented.
- Use environment variables for secrets and configuration.
- Never hardcode credentials or API keys.
- Use reusable components and shared utilities.
- Document important commands in `README.md`.

### Required commands

At minimum:

```bash
pnpm dev
pnpm build
pnpm preview
pnpm format
pnpm format <filepath-or-name>
```

Add useful commands when applicable:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm clean
```

Also document Firebase/database/data reset/seed commands when applicable.

---

## Prettier

Prettier is the formatter used by `pnpm format`.

Configure:

- `.prettierrc` / `.prettierrc.json` or equivalent
- `.prettierignore`

`pnpm format` must format relevant project source/code files while respecting `.gitignore` and excluding dependencies, generated files, build output, caches, and other unnecessary files.

Preferred scripts:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

`pnpm format <filepath-or-name>` must format only the requested path/file.

---

## Design System

**Always use `design.md`.**

`design.md` is the source of truth for:

- themes and design tokens
- typography
- spacing
- buttons
- inputs
- selects
- cards
- badges
- tables
- dialogs
- sheets
- tabs
- popovers
- dropdowns
- empty states
- loading/error states
- InfoTip/help patterns
- tours
- command palette
- responsive navigation
- admin layouts
- dashboards
- animations
- accessibility
- interaction conventions
- keyboard shortcuts
- visual polish

Do not create competing versions of common components without a clear requirement.

---

## Firebase

Firebase is optional and must be decided according to the project requirements.

### Important user decision

If Firebase and an admin panel for **contact forms, inquiries, submissions, or similar site data** have not already been specified:

**Ask the user first whether they want:**

1. Firebase/data storage only.
2. Firebase + an admin panel to review/manage the submitted data.
3. Neither.

Do not silently introduce an admin panel or Firebase because a contact form exists.

### When Firebase is approved

- **Follow `firebase-skill.md`** for setup, CLI usage, project configuration, Firestore structure, security rules, and emulator workflows.
- **On local computers:** use the **Firebase CLI** (`firebase login`, `firebase init`, `firebase emulators:start`, `firebase deploy`) to configure and validate the project.
- **In restricted containers:** if the Firebase CLI cannot run, document the required CLI steps and provide the configuration/rules files so the user can run them locally.
- Use Firebase/Firestore for small/simple application data where appropriate.
- Use environment variables.
- Never commit real credentials.
- Document exactly where configuration values belong.
- Design appropriate Firebase security rules.
- Do not assume frontend visibility is security.

### Images

Do **not** use Firebase Storage for images unless explicitly requested.

For image URL workflows:

1. Allow an external image URL.
2. Preview the image.
3. Validate that it successfully loads.
4. Only allow save/submit after successful validation.
5. Store the validated URL in Firestore when applicable.
6. Handle loading, broken, inaccessible, and changed URLs gracefully.
7. Validate protocols and reject unsafe URLs.

---

## Admin Panel

If an admin panel is required:

- Put **all admin-related code under `src/admin/`**.
- Use a separate admin layout.
- Keep admin navigation/components/pages separate from public-site components where appropriate.
- Include appropriate permission/role checks.
- Do not rely on UI hiding for authorization.
- Include loading, empty, error, success, and permission-denied states.
- Contact/inquiry management should live in the admin area when that feature is approved.
- CMS functionality should also remain under the admin area.

---

## Content & Information Architecture

Think through the complete information architecture before implementation.

Applications should feel intuitive without requiring users to understand the underlying technical model.

For every workflow:

- use logical ordering
- make the next action obvious
- avoid unnecessary steps
- use familiar terminology
- group related information
- provide clear success/error feedback
- preserve user context where practical

For unfamiliar terminology, complex operations, or multistep features, follow the `InfoTip` rules in `design.md`.

---

## Documentation

If a scope, PRD, clarification, decision, architecture document, or other project document exists:

- preserve it
- place relevant documentation in `docs/*.md`
- do not discard important requirements
- maintain a concise documentation index when useful

`README.md` must include:

- project purpose
- stack
- installation
- pnpm commands (and npm fallback notes when used in a container)
- formatting commands
- environment variables
- Firebase setup when applicable (with `firebase-skill.md` reference)
- admin-panel setup when applicable
- image URL behavior
- Netlify setup when applicable (with `netlify-skill.md` reference)
- deployment/build instructions
- relevant architecture/design decisions
- environment notes (local vs container vs GitHub-connected) and any skipped steps

---

## Netlify

- **Follow `netlify-skill.md`** for Netlify configuration, CLI usage, deployment, SPA redirects, and environment variables.
- **On local computers:** use the **Netlify CLI** (`netlify login`, `netlify init`, `netlify dev`, `netlify deploy`) to configure and deploy.
- **In restricted containers:** if the Netlify CLI cannot run, document the required CLI steps and provide the configuration files (`netlify.toml`, redirects) so the user can run them locally.

When targeting Netlify:

- configure the correct build command
- configure the correct publish directory
- configure SPA redirects/rewrites when needed
- document environment variables
- document deployment assumptions
- verify direct navigation and refresh work with client-side routing

---

## Quality Review

Before delivery, review:

### UX
- intuitive workflows
- clear navigation
- logical forms
- appropriate confirmations
- useful loading/empty/error states
- mobile usability

### Visual
- consistent hierarchy
- spacing
- typography
- component consistency
- theme consistency
- dark mode
- responsive layouts
- animation quality

### Accessibility
- semantic HTML
- keyboard navigation
- focus states
- labels
- contrast
- reduced-motion support
- accessible dialogs/popovers
- accessible icon-only controls

### Performance
- bundle size
- unnecessary re-renders
- lazy loading
- image loading
- expensive animations
- unnecessary network requests
- command-palette/entity search loading behavior

### Security
- no exposed secrets
- Firebase rules/configuration
- input validation
- unsafe URL handling
- XSS-sensitive rendering
- dependency concerns
- permission enforcement

### Final validation
- production build succeeds
- formatting succeeds
- lint/typecheck/tests succeed when configured
- no unnecessary files
- no secrets
- no build artifacts/dependency directories in ZIP

---

## Final Deliverable (by Environment)

### Local computer
- **No ZIP.**
- **Git commits at every significant step** with clear messages.
- Use the **Firebase CLI** and **Netlify CLI** per `firebase-skill.md` and `netlify-skill.md`.
- Ensure the repo is in a clean, working state with a passing build.

### Virtualized container / restricted platform
- Attempt **pnpm + TypeScript** first.
  - Success → build → **produce and deliver the final ZIP**.
  - Failure → fall back to **npm** → build → **produce and deliver the final ZIP**.
- If some steps cannot be completed due to container restrictions, **still deliver the ZIP** and clearly document what was skipped, why, and the exact steps the user must run locally.

### GitHub-connected
- Open a **Pull Request** with the implementation.
- **Then also deliver the final ZIP.**

The ZIP must be clean and must **not** contain:

- `node_modules`
- build output unless specifically required
- local caches
- local secrets
- environment files containing real credentials
- unnecessary generated files

Deliver the final output according to the environment after the complete implementation and review are finished.