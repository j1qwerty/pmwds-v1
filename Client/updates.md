# Client updates

Newest first. Each entry matches a delivered zip (`clientcc1.zip`, `clientcc2.zip`, ...).
Drop the `Client/` folder from the zip over the repo's `Client/` folder, run `npm install`, then `npm run build`.

---

## clientcc2 — Users page: table by default, Super Admin hidden from role filter

**Frontend only. No backend changes in this update.**

- The Users page now opens in **table view** (it was cards). Card and list views are still available from the view toggle.
- The **Role** filter dropdown no longer lists *Super Admin* unless the signed-in user is a super admin
  (`roleFilterOptions` in `pages/users/users.tsx`). The create/edit user modal already hid the role from non-admins,
  so both role pickers on the page now agree.
- Not changed: the view choice is not remembered between visits; the page returns to table each time it opens.
- Verified: `tsc -b` clean. Not run: browser tests, manual click-through.

---

## clientcc1 — Settings for every user, per-user action visibility

**Frontend only. No backend changes in this update.**

### Settings is now available to every signed-in user
- `/settings` no longer requires `SYSTEM_ADMIN`. Before, only super admins could reach the page, so the
  "Row & card actions" setting was invisible to everyone else.
- The Settings nav item is shown to all roles (`layout.tsx`).
- Admin-only tabs (AI Settings, Database, Background) are still hidden for non-admins, and a link such as
  `?tab=database` falls back to Profile instead of an empty page.
- The selected tab is kept in the URL (`/settings?tab=actions`), so a section can be linked to or survive a reload.
- Header text adapts to the role (admins see AI/system wording, others see profile and display wording).

### Row & card actions: scoped to what the user can open
- The per-area override list now shows only areas the user has view access to
  (new `pages/settings/entityAccess.ts` maps each area to its permission).
  A team member without Organization access no longer sees "Organizations".
- The live preview card follows the first area the user has, and its label, hint and demo toasts use that area's name
  (it was hard-wired to "Projects").
- If a role opens none of these areas, the section says so instead of showing an empty list.
- The global Hover / Always switch is available to everyone.

### Settings are stored per user, not per browser
- Action-visibility settings were saved under one browser-wide key, so on a shared computer the next person to
  sign in inherited the previous person's choices. They are now saved under `pmwds.actionVisibility.v1:<userId>`.
- One-time migration: the old browser-wide value is copied to the first user who signs in after the upgrade, then
  deleted, so nobody else inherits it.
- The store follows the signed-in user (`bindActionVisibilityUser`, called from `App.tsx`) and reads the session at
  load time, so the first paint already uses the right user's settings.

### New: Preferences tab
- **Reduce motion**: turns off animations and transitions app-wide (`html.reduce-motion` in `index.css`).
- **Start with a compact sidebar**: the sidebar opens collapsed to icons.
- Both are per user, apply immediately, and have a "Reset to defaults" button.
- New files: `lib/userPreferences.ts`, `pages/settings/PreferencesSettings.tsx`.

### Known limits
- Settings are saved in the browser (localStorage), so they do not follow a user to another device or browser.
  Making them roam needs a small `GET/PUT /me/preferences` endpoint; not added in this update.
- `API_WISHLIST.md` was not present in the repository (checked on `main` at commit `5c585eb`). Its contents were taken from
  the request. Endpoint check results are in the entry for the dashboard phase.

### Verified
- `tsc -b` clean, `vite build` succeeds.
- Not run: the browser tests in `browser-tests/`, and no manual click-through of the UI.

---

## Baseline — repository `main` at commit `5c585eb`
"Fix DevPanel hooks-order crash: move server-gated early return below all hooks".
Earlier history is in `CHANGES.md`, `PERF_CHANGES.md` and `git log`.
