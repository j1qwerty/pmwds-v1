# responsive.md 
# Development Tasks & Improvements

## final
- [ ] migrations consolidation
- [ ] api test all after deploy and caching test


## 🚨 Immediate Fixes
- [ ] PDF generation 
- [ ] feat- Ai chant interface without sessions 
- [ ] for mssql EF does not support multiple cascade to same table. E:\saturday\PMWDS.S\status\issue-sql-cascade-paths.md
- [.] api returnig all data for tasks and milestone even for other roles in the response and then frontend is managing whether to show or not
- [x] Fix deptFormModal - select none to unassign head functionality
- [x] Role management for director - manage specific permissions and roles
- [x] frontend : multiple task creation , idempotency for all modals creation and edit
- [x] deactivated users do not show up anywhere(in assignment lists ) but show up on existing tasks or proejcts but with visible hint for deactivated, but show in users page
- [x] deactivated users cant even login
- [x] due date cant be more than that of parent component and by default select the parent's date in modals for creation



## 🔴 High Priority

### feature
- [ ] assign users to task based on skills also , search etc , proper flow,
- [ ] task dependencies 
- [ ] remove and consolidate the api and types , remove redundant
- [x] milestone dependencies 
- [x] director / dept head project creator - whoever creates project others at same role but different departments can not edit it, can only manage tasks and subtasks etc, can uplaod documents
- [ ] redis cache and indexing for database
- [ ] Implement paginated results for documents and other sections (audit all sections, create list of sections/components for update)
- [ ] All types of settings and settings API, Settings page for both roles (add create organizations button for superadmin)
- [ ] new project creation flow - auto selected input feilds on each step

### Role & Access Management
- [x] Role management for director with proper UI (hide superadmin features)
- [x] Hide organization-related info from director and other users (all elements)
- [ ] Hide manual activity creation for director

### Modals & Overlays
- [ ] Refactor all modals and overlays for consistency
- [ ] Redesign modals with unified styling
- [ ] Add delete buttons for projects, milestones, and tasks in proper positions with confirmation modals

### UI Components
- [x] projecttaskpage when there are no tasks for a milestone no board is displayed, instead display the empty board, add setting if needed
- [x] Decide on TaskSubtask card vs TaskCard usage across all places
- [x] Add escalate task button and mentions functionality
- [x] Add more buttons to projects page top navigation
- [x] Consistent toasts 
- [x] consistent stat cards design
- [x] User assignment in departments page

### Task Management
- [ ] Add project detailed cleaned UI to workspace page in new tab with proper tab management
- [x] New project creation flow with modal steps:
  - [x] Project details
  - [x] Departments select or create new
  - [x] Milestones and tasks boxes
  - [x] Tasks and subtasks

### Data Display
- [x] Fix dashboard TaskPerformanceTable opening older task modals

## 🟡 Medium Priority

### Layout & Navigation
- [x] Refactor layout.tsx with more features and organized structure (home, project, departments at top)
- [ ] check n+1 calls for api frontend client while loading any page

### User Management
- [x] Add workload column to users table (fix inconsistencies)
- [x] Merge users and profiles pages
- [x] Merge skills, new users, and departments pages into new tabular page

### Status Management
- [ ] Hide manual status changes for milestones and projects

## 🟢 Lower Priority

### UI Styling & Responsiveness
- [ ] screensize determined layouts
- [ ] Reorganize and refactor navigation and sidebar
- [ ] Responsive design for all elements
- [ ] text wrap such that things never go out of bounds for any element
- [ ] Hover and shadow effects matching color scheme for all components
- [ ] Add max height with "view more" options to all components
- [ ] Animate bars and graphs (similar to AI page)
- [ ] consistent icons for everything
- [ ] stars for proficiency 
- [x] Task performance table UI update (hover, view/edit modals, sort filters, cursor-pointer)

### Activity & Logging
- [x] Refine activity logs for better readability with metadata
- [x] Make activity logs more user-friendly

### Code Organization
- [ ] Rearrange file locations and rename components logically
- [x] Remove old/unused components and pages

## MISC 
- [ ] analyse pages api usage and manual API usage ( accordingle replace one with another depending on context)
- [ ] backend idempotency
- [ ] implement plan soft delete 
- [ ] rate limiting , sys architecture design etc, cqrs , security and scalability plan
- [ ] plan- test all roles: create a flow project add 3 milestones assign departmets, crete milestone dependencies, upload document (root readme.md) create 3 tasks inside each milestone , two tasks have subtasks , change progress for each task (for tasks with subtasks progress calculates automatically so should fail direct progress update), same for milestones progress depends on tasks (avg of tasks) , create edit workflow also for each , for tasks and subtasks assign users from their own department , fetch first , also create a delete workflow for all like the project, milestone, documents , tasks subtasks etc


```
