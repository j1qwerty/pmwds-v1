# Design System

Source of truth for shared React UI, UX, interaction, visual, responsive, accessibility, dashboard, and admin design patterns.

All application-specific designs should use these patterns rather than independently recreating common components.

---

## 1. Design Principles

Build interfaces that are:

- intuitive
- intentional
- consistent
- responsive
- accessible
- production-ready
- visually polished
- easy to learn
- efficient for repeated workflows

Do not make users understand the application's technical implementation before they can use it.

For logical workflows, make the next action obvious.

For unfamiliar terminology, complex operations, and multistep features, provide contextual help using `InfoTip`.

---

## 2. Themes

Use Tailwind v4 with CSS-first semantic design tokens.

Prefer OKLCH theme variables where appropriate.

Do not hardcode theme colors in components.

Example structure:

```text
src/styles/themes.css
src/lib/themes.ts
```

Themes should be applied through a root attribute such as:

```html
<html data-theme="light">
```

Support at minimum:

- light
- dark

Additional project-specific themes may be added when useful.

### Dark mode

Dark mode must:

- never be pure black
- use a professional gray/dark palette
- maintain sufficient contrast
- work across cards, borders, controls, overlays, dialogs, SVGs, images, and focus states
- persist user preference where appropriate
- support system preference where appropriate

Use semantic classes/tokens such as:

```text
bg-background
bg-card
bg-muted
text-foreground
text-muted-foreground
text-primary
border-border
bg-primary-soft
bg-success-soft
```

---

## 3. Typography

Use a consistent type scale.

Recommended:

- modern sans-serif variable font for UI
- monospace variable font for technical/numeric content when appropriate
- tabular numerals for statistics and financial values

Typography should establish hierarchy rather than relying on excessive colors or decoration.

---

## 4. Buttons

Use one shared Button component.

Recommended variants:

- default
- destructive
- outline
- secondary
- ghost
- soft
- link

Recommended sizes:

- default
- small
- large
- icon
- compact icon

Buttons should clearly communicate:

- action
- importance
- current state
- loading state
- disabled state

Icon-only buttons require accessible labels/tooltips.

---

## 5. Forms & Inputs

Use shared components for:

- Input
- Textarea
- Select
- Checkbox
- Switch
- Radio
- Date picker
- Date range picker
- Combobox
- File/image input

Forms should:

- group related fields
- show labels
- provide concise help text when needed
- show validation close to the relevant field
- preserve entered values after recoverable errors
- clearly distinguish required fields
- show loading/submitting state
- prevent accidental duplicate submission

---

## 6. Cards & Display Components

Use shared components for:

- Card
- Badge
- Avatar
- Progress
- Skeleton
- Separator
- Tooltip
- Status indicator

Cards should avoid excessive nested borders and unnecessary decoration.

Use semantic status variants:

- neutral
- success
- warning
- danger
- primary

Do not communicate important status using color alone.

---

## 7. Data Tables

Use one reusable `DataTable` implementation for application tables.

Recommended features:

- search
- filtering
- sorting
- column visibility
- pagination
- page-size selection
- CSV export when applicable
- row selection
- bulk actions
- row actions
- row click
- loading skeletons
- empty state

Typical page sizes:

```text
10 / 20 / 50 / 100
```

Bulk-selection should expose a contextual action bar and clearly show the number of selected records.

Destructive bulk actions require confirmation.

Do not create separate table implementations for individual modules unless the requirements genuinely differ.

---

## 8. Tabs

Prefer tabs over separate pages when several closely related views belong to the same entity/module.

Example:

```text
/people?tab=students
/people?tab=staff
```

Tabs should:

- use URL state where appropriate
- support deep linking
- preserve selected state
- scroll horizontally on small screens
- avoid boxed/tab-card visual clutter unless the product specifically requires it

Recommended style:

```text
border-bottom
active bottom border
active foreground
inactive muted foreground
```

---

## 9. Dialogs, Sheets & Confirmation

Use shared Radix-based dialog/sheet components.

Dialogs should:

- remain inside the viewport
- have appropriate maximum height
- support internal scrolling
- clearly separate title/content/actions
- support keyboard escape
- maintain focus correctly

Use sheets for:

- detail panels
- contextual editing
- filters
- secondary workflows

Use confirmation dialogs for destructive or consequential operations.

---

## 10. Popovers & Dropdowns

Use shared popover/dropdown primitives.

Rules:

- remain inside the viewport
- maintain usable width on mobile
- do not obscure critical content unnecessarily
- support keyboard interaction
- close correctly when clicking outside where appropriate

---

## 11. InfoTip / Contextual Help

Use a small `?` / help icon for:

- unfamiliar terminology
- complex concepts
- multistep workflows
- features intended for non-technical users
- settings where the consequence is not immediately obvious

Example:

```text
Feature name   [?]
```

Clicking the icon opens a short explanation.

The explanation should:

- be concise
- use plain language
- explain what the feature does
- avoid unnecessary technical terminology

The popup must:

- close when clicking outside
- close with Escape
- remain completely inside the viewport
- never be cropped at the top, bottom, left, or right
- reposition automatically when required

Do not use help popups for information that is already obvious.

---

## 12. Empty, Loading, Error & Success States

Every asynchronous feature should explicitly handle:

1. Loading
2. Empty
3. Error
4. Success

Avoid blank screens and indefinite spinners.

Use:

- Skeletons for content loading
- EmptyState for genuinely empty collections
- useful error messages with recovery actions
- Toasts or inline feedback for completed actions

Empty states should explain what the user can do next.

---

## 13. Toasts / Notifications

Use a consistent notification system.

Support:

- success
- information
- warning
- error

Notifications should be concise and actionable.

Do not use a toast as the only indication of a critical failed operation when the user needs to understand or correct the problem.

---

## 14. Navigation & Breadcrumbs

Use navigation appropriate to application complexity.

### Dashboard/admin applications

Prefer:

- sidebar on desktop
- sheet/drawer navigation on mobile
- persistent topbar
- active navigation state

### Breadcrumbs

Use breadcrumbs on deep screens where they improve orientation.

Example:

```text
People → Students → Student Profile
```

Avoid breadcrumbs when the hierarchy is already obvious.

---

## 15. Command Palette

For dashboard/admin applications, **ask the user whether they want a command palette** unless it has already been specified.

If approved, implement a global command palette using `cmdk` or the project's equivalent.

### Entry point

Provide a visible search/action button in the topbar:

```text
Search everything     Ctrl K
```

On mobile, the control may become icon-only.

### Keyboard shortcuts

Support:

| Shortcut | Action |
|---|---|
| `Ctrl + K` | Open |
| `Cmd + K` | Open |
| `Esc` | Close |
| Type | Fuzzy search |
| `↑ / ↓` | Navigate results |
| `Enter` | Execute selected result |

Prevent the browser's default action for `Ctrl/Cmd + K`.

### Command groups

At minimum, consider:

- Pages
- Navigation
- Common actions
- Relevant entities
- Recent items where useful

Examples:

```text
Pages
  Dashboard
  Students
  Attendance
  Fees

Actions
  Add Student
  Create Notice
  Export Students

Students
  Rahul Sharma
  Priya Singh
```

### Application-specific commands

The command palette should not be a generic navigation-only search.

When useful, include commands relevant to the actual application, such as:

- create record
- open a module
- search entities
- run common actions
- navigate to settings
- export data
- open reports

### Permission awareness

Command results must respect the application's permission/capability system.

Do not expose actions the current user cannot perform.

Frontend filtering is not a security boundary; backend authorization remains mandatory.

### Entity search

Entity searches should be lazy.

Do not fetch large datasets merely because the application loaded.

Prefer:

```text
palette opens
→ permitted entity search becomes enabled
→ query/filter executes
```

Search only relevant entities for the application.

### Palette shell

Recommended characteristics:

- centered dialog
- responsive width
- overlay
- keyboard-accessible
- clear search field
- grouped results
- empty state
- scrollable result list
- visible keyboard hints

---

## 16. Tours & Onboarding

Applications with meaningful workflows should include onboarding.

### First login

**Always include a first-login/welcome tour for applications with meaningful navigation or workflows.**

The welcome tour should:

- run automatically for the appropriate first-login context
- explain the primary navigation
- highlight important areas
- remain short
- allow skipping
- be replayable

Persist completion locally or through the application's user settings where appropriate.

### Module tours

Complex modules may have their own tours.

Use:

```text
useModuleTour(...)
TourHelp(...)
useWelcomeTour(...)
```

Module tours should:

- run once by default
- be replayable
- have a clear help/tour trigger
- avoid blocking normal work

Tour popovers must respect the viewport and theme.

---

## 17. Logical UX & Multistep Workflows

Every workflow should be designed around the user's mental model.

For multistep operations:

- establish context
- explain what is required
- group related fields
- show progress when useful
- make the current step obvious
- provide Back/Next actions consistently
- preserve entered data
- validate before advancing where appropriate
- clearly communicate completion

For unfamiliar terms, use `InfoTip`.

Do not expose internal database terminology when a user-facing term is clearer.

---

## 18. Unsaved Changes

Forms and editors with meaningful data should protect users from accidental loss.

When navigating away with unsaved changes:

- warn the user
- clearly identify that changes have not been saved
- provide options such as:
  - Continue editing
  - Discard changes
  - Save

Use this especially for:

- large forms
- settings
- CMS editors
- template designers
- configuration screens

---

## 19. Search, Filters & State Persistence

Where appropriate, preserve:

- search query
- filters
- sorting
- selected tab
- pagination
- date range

Prefer URL state for shareable/deep-linkable list state.

Returning to a module should not unnecessarily reset the user's working context.

---

## 20. Bulk Actions

For selectable lists/tables:

```text
Select records
→ contextual action bar appears
→ show selected count
→ execute action
```

Destructive bulk actions require confirmation.

Actions should clearly communicate whether they affect:

- selected records
- current page
- all filtered records

---

## 21. Permission-aware UI

Permission-aware applications should distinguish:

- available
- unavailable
- disabled
- unauthorized

Hide actions when exposing them would create unnecessary confusion.

Disable actions when the user should understand that the action exists but is temporarily unavailable.

Use a clear permission-denied state when access itself is relevant.

**UI permission checks never replace backend authorization.**

---

## 22. Admin Panel

When an application includes an admin panel:

```text
src/admin/
```

must contain all admin-related UI.

Recommended structure:

```text
src/admin/
  layout/
  pages/
  components/
  navigation/
  hooks/
```

Use a separate admin layout.

Admin features may include:

- dashboard
- contacts
- inquiries
- CMS
- users
- settings
- content management
- reports
- audit/activity
- moderation

Do not mix admin-only layout/components throughout public-site folders.

---

## 23. Contact / Inquiry Management

If contact or inquiry management is requested:

- public form belongs to the public application
- submitted data should use the approved storage mechanism
- admin management belongs under `src/admin`
- provide list/search/filter/detail views
- show unread/new status where applicable
- provide appropriate empty/loading/error states
- protect administrative access

Firebase/admin-panel usage must first be confirmed with the user if not already specified.

---

## 24. FAQ

For sites where FAQs are relevant, use a reusable accordion/FAQ component.

Requirements:

- clear question hierarchy
- keyboard accessible
- smooth but restrained open/close animation
- one or multiple expanded items according to the use case
- accessible expanded/collapsed state
- mobile-friendly spacing

If an admin/CMS exists, FAQ content may be managed through the CMS.

---

## 25. Dashboard Design

Dashboards should prioritize information density without becoming visually noisy.

Typical structure:

```text
PageHeader
→ summary/stat cards
→ important alerts/actions
→ primary charts/data
→ secondary lists/activity
```

Do not fill the page with cards merely to make it look complete.

Each dashboard component should answer a useful question.

Use:

- clear metric labels
- contextual comparison where meaningful
- charts for trends/relationships
- tables/lists for detailed records
- actionable empty states

---

## 26. Admin Dashboard

Admin dashboards may additionally include:

- pending actions
- inquiries
- approvals
- recent activity
- system status
- user statistics
- content status
- quick actions

Prioritize actions requiring attention rather than decorative metrics.

---

## 27. Activity / Audit Timeline

For business/admin systems, use a reusable timeline pattern for:

- record changes
- approvals
- status changes
- assignments
- comments
- important system events

Show:

- actor
- action
- timestamp
- relevant context

Do not expose sensitive audit information to users without permission.

---

## 28. Data Export / Print

When export is useful:

- provide CSV/PDF/print actions
- use clear action labels
- respect applicable filters
- show progress for expensive exports
- handle export errors clearly

For PDF rendering, use the project's approved PDF/canvas tooling.

If the project uses OKLCH themes, verify that the chosen rendering library supports them correctly.

---

## 29. Image URL Component

For external image URLs, use a reusable image URL field.

It should:

1. accept a URL
2. validate the protocol
3. attempt to load the image
4. display a preview
5. show dimensions when useful
6. prevent saving invalid/broken images
7. gracefully handle later loading failures

Do not use Firebase Storage unless explicitly requested.

---

## 30. Animation

### Government / professional applications

Use restrained motion:

- gentle entrance/reveal
- small hover/focus transitions
- subtle scroll effects
- meaningful state transitions

Avoid excessive parallax or decorative motion.

### Business / general applications

Use a richer motion system:

- scroll-triggered reveals
- micro-interactions
- meaningful transitions
- restrained parallax where useful
- section transitions
- interactive visual details

Always support:

```css
prefers-reduced-motion
```

---

## 31. Decorative SVG Elements

For business/general applications, create a reusable collection of approximately **10 SVG decorative/background elements**.

Place them artistically across sections where appropriate:

- top-left
- top-right
- bottom-left
- bottom-right
- section edges
- background areas

Decorative elements must:

- remain behind content
- not interfere with interaction
- animate subtly
- avoid excessive CPU/GPU usage
- remain accessible by being decorative/non-interactive where appropriate

Do not force decorative elements into layouts where they reduce clarity.

---

## 32. Back-to-top Button

Business/general long-form pages should include a floating back-to-top button when useful.

Behavior:

- hidden near the top
- appears after scrolling
- positioned bottom-right
- smoothly scrolls to the top
- has accessible labeling
- respects reduced-motion preference

The button should remain stable rather than constantly moving after scrolling stops.

---

## 33. Responsive Design

Design for:

- mobile
- tablet
- desktop
- large desktop

Do not merely shrink desktop layouts.

Adapt:

- navigation
- tables
- dialogs
- forms
- cards
- grids
- command palette
- side panels
- actions

Avoid:

- horizontal page overflow
- cropped popovers
- inaccessible controls
- excessively tiny text
- desktop-only interactions

---

## 34. Accessibility

Every application must consider:

- semantic HTML
- keyboard navigation
- focus management
- visible focus states
- accessible labels
- screen-reader-friendly controls
- sufficient contrast
- reduced motion
- dialog focus trapping
- accessible popovers
- accessible tables
- accessible form validation

Icon-only controls require accessible labels.

---

## 35. Performance

Avoid unnecessary:

- re-renders
- network requests
- large initial bundles
- image downloads
- expensive animations
- eager entity searches
- unnecessary global state

Use:

- lazy loading
- code splitting
- optimized images
- virtualization when genuinely required
- memoization only where beneficial

The command palette should lazy-load expensive entity data.

---

## 36. Component Organization

Prefer reusable shared components:

```text
src/components/ui/
src/components/shared/
src/features/
src/admin/
```

Keep feature-specific logic inside its feature area.

Do not duplicate common dialogs, buttons, tables, form controls, empty states, or help patterns.

---

## 37. Quality Checklist

Before delivery verify:

### Visual
- consistent hierarchy
- spacing
- typography
- theme tokens
- light mode
- dark mode
- responsive layouts
- intentional animation

### UX
- logical workflows
- first-login tour
- contextual `?` help where needed
- command palette when approved
- breadcrumbs where useful
- useful empty/loading/error states
- confirmation for destructive actions
- unsaved-change protection

### Accessibility
- keyboard navigation
- focus states
- semantic HTML
- labels
- contrast
- reduced motion
- accessible dialogs/popovers
- accessible icon buttons

### Performance
- efficient rendering
- lazy data loading
- optimized images
- reasonable bundle size
- efficient animation

### Security
- no exposed secrets
- permission-aware UI
- backend authorization assumptions documented
- safe external URLs
- validated user input
- safe rendering of user-provided content