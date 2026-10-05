# PMWDS UI / Frontend Audit

> Audit date: 2026-10-03
> Base reviewed: `main` at `f90909c618bbcbc3e2a2b6ae3fb579f82828942c`
> Focus: visual consistency, modal quality, user flows, data/loading/error states, permission-driven visibility, responsiveness and maintainability.
>
> The current theme is intentionally retained: the existing indigo/purple Material-style palette, glass surfaces, Inter typography, rounded panels and light blue background treatment should remain the visual foundation.

# Severity

- **High** — workflow/permission mismatch, destructive/confusing interaction or major reusable UI problem.
- **Medium** — important consistency/usability/maintainability issue.
- **Low** — polish, responsive refinements and cleanup.

---

# High

## H1. Modal presentation is fragmented instead of using one dialog system

There is a shared `ModalOverlay`, but many modals independently implement:

- fixed overlays;
- white rounded panels;
- separate paddings and widths;
- different backdrops;
- different close buttons;
- different icon systems;
- different form spacing;
- different footer button styles.

Examples include shared department/organization modals, New Project modals, DepartmentUsersModal, RoleFormModal, PermissionFormModal and UserEditModal.

**Impact:** the user's observation is correct: modals feel like separate products and several do not look as clean as the rest of the application.

**Fix:** create one reusable Dialog component with theme tokens and slots for header/body/footer. Keep existing colour/style direction, but standardize width, radius, shadow, border, padding, title hierarchy, button placement and close affordance.

---

## H2. Dialog accessibility and lifecycle behaviour is incomplete

The current `ModalOverlay`:

- does not expose `role="dialog"` / `aria-modal` consistently;
- does not manage focus into the dialog;
- does not restore focus to the trigger;
- does not provide a global Escape-to-close pattern;
- locks `document.body.style.overflow` directly and clears it on unmount, which is fragile with nested/stacked dialogs;
- leaves many independent modal implementations outside the shared lifecycle.

**Fix:** the reusable Dialog should own focus trap, focus restore, Escape handling, backdrop handling, scroll lock and viewport-safe scrolling.

---

## H3. Permission-driven UI can diverge from backend behaviour

The client has a granular permission helper, but several backend endpoints still use broad Manager/Director policies and role-key scope rules.

**Impact:** a button can be shown because the client sees a permission while the server rejects it, or hidden while the server would actually allow it.

**Fix:** treat the server response/capabilities as authoritative. Prefer endpoint capability fields when practical, and keep client permission checks only for visibility/hints—not as security.

---

## H4. Form submission/error state is inconsistent across modals

Several modals set `submitting/saving = true` before invoking callbacks. Some callback props are typed as synchronous `void`; others are asynchronous. This creates inconsistent failure handling and can leave the form locked after an API failure.

**Fix:** standardize every mutation modal around `onSubmit: (...) => Promise<void>`, with one loading/error lifecycle. Preserve entered values, show field/global API errors and only close after the server succeeds.

---

## H5. Duplicate modal implementations create divergent UX and logic

There are both shared and NewProject-specific versions of department and organization forms. They can drift in validation, layout and behaviour.

**Fix:** make all flows use the same shared form components; pass context/configuration rather than duplicating the modal.

---

# Medium

## M1. Hard-coded colours bypass the existing theme tokens

The app has a strong Tailwind theme in `index.css`, but many modals still hard-code values such as `bg-indigo-600`, `text-slate-700`, `bg-red-600`, etc.

**Fix:** use existing semantic theme utilities/tokens wherever possible. This keeps the current look while making every surface respond consistently to future theme updates.

---

## M2. The CSS contains references to token names that are not defined in the same scheme

Examples in `index.css` include raw custom-property references such as `--success`, `--warning`, `--error-container`, `--on-error-container`, `--surface-container-high`, while the Tailwind theme primarily defines `--color-*` variables.

**Impact:** some custom CSS such as badges/skeletons may not resolve as intended outside Tailwind-generated utilities.

**Fix:** normalize the token naming scheme and remove duplicate/undefined aliases.

---

## M3. Icon usage is inconsistent

The code mixes the custom `Icon` component, Material Symbols and `react-icons`.

**Fix:** choose one default icon source and retain exceptions only where an icon truly needs a specialized glyph. This will make modal headers, buttons, tables and empty states visually coherent.

---

## M4. Lists over-fetch for convenience instead of using the API pagination model

Examples include `getUsers(... pageSize: 500)` and `getDepartments(... pageSize = 500)`.

**Impact:** slower initial loads, large renders and unnecessary work for large organizations.

**Fix:** use paginated searches/selectors, debounced search, server-side filters and incremental loading.

---

## M5. `requestList` hides pagination metadata

The client helper converts either an array or paginated response to `T[]`, losing `page`, `totalCount` and `totalPages`.

**Fix:** preserve a typed `ListResult<T>` where screens need pagination while retaining a convenience helper for truly small collections.

---

## M6. API payload typing is too loose

A large amount of frontend code sends `Record<string, unknown>`.

**Impact:** property names and data shapes are only caught at runtime.

**Fix:** define typed request DTOs and response contracts for high-value workflows: projects, milestones, tasks, users, roles, reports and documents.

---

## M7. Server validation errors are not consistently mapped to fields

The API already returns structured validation details. The UI often displays a generic message.

**Fix:** map `error.details` into field-level errors and keep a top-level summary for non-field errors.

---

## M8. Loading/error/empty states are not consistently differentiated

The shared layer uses `EmptyState` for loading in some places. This makes a loading state look like an empty dataset.

**Fix:** introduce consistent `LoadingState`, `ErrorState`, `EmptyState` and `Skeleton` components with the current visual language.

---

## M9. Delete confirmation copy can conflict with soft-delete behaviour

`DeleteConfirmationModal` says “permanently delete” and “cannot be undone”, while the backend uses soft-delete patterns in important entities.

**Fix:** say exactly what will happen, for example “Delete project” plus a warning describing which related records are removed/hidden and whether recovery exists.

---

## M10. Complex forms need small contextual help affordances

Some features contain unfamiliar concepts (permissions, schedules, AI recommendations, delegation, dependency types, release conditions).

**Fix:** use the requested small `?` help affordance for complex/multistep controls. The popup should stay within viewport, close on outside click/Escape and contain one concise explanation.

---

# Low

## L1. Modal spacing and footer rhythm should be standardized

Use a fixed token scale for header/body/footer spacing rather than per-modal values.

## L2. Responsive dialog widths should be semantic

Prefer `sm / md / lg / xl` dialog sizes with `max-h` + internal scrolling rather than arbitrary pixel widths.

## L3. Table/mobile overflow needs one shared pattern

Tables, filter bars and action toolbars should use reusable overflow/stacking behaviour at narrow widths.

## L4. Hover/focus states should use one shared button/input recipe

Keep the existing hover/shadow language, but avoid every modal inventing its own focus ring and transition.

## L5. Animation can remain subtle

The existing application already uses motion/glass effects. Standardize dialog entry/exit and list updates without adding heavy animations to government/professional workflows.

## L6. Clean up duplicate/dead UI components after consolidation

After the shared component migration, remove old modal variants and unused helpers so future screens do not copy them.

---

# Parallel work

These UI tracks can progress independently:

| Track | Can run in parallel with | Dependencies |
|---|---|---|
| Shared Dialog + modal visual system | Backend fixes, table cleanup | None |
| Form/error/loading standardization | Shared Dialog | API error contract helps |
| Permission/capability visibility | Backend permission consolidation | Coordinate capability names |
| Pagination/search components | Modal work | API pagination contract |
| Theme/token cleanup | All UI tracks | Best early |
| Responsive/table cleanup | All backend work | None |
| Help popovers | All UI work | Shared popover primitive |

# Recommended implementation order

1. **Shared Dialog/modal system:** H1/H2/H4/H5.
2. **Theme/token + icon consistency:** M1/M2/M3.
3. **Form + API error/loading states:** H4/M7/M8.
4. **Permission/capability visibility alignment:** H3.
5. **Pagination/search/typed API contracts:** M4/M5/M6.
6. **Responsive/table/help/animation polish:** M9/M10 + Low findings.

# UI verification checklist

For every major modal:

- open from a keyboard trigger;
- focus lands inside;
- Escape closes;
- clicking outside follows the dialog's configured policy;
- focus returns to the trigger;
- body does not scroll behind the dialog;
- long content scrolls inside the dialog without clipping;
- 320px, 768px, 1440px and very-wide screens stay within viewport;
- server validation errors remain visible after a failed submit;
- buttons cannot double-submit;
- successful mutation closes only after the API succeeds;
- realtime/refetch updates the underlying list without a manual page reload.
