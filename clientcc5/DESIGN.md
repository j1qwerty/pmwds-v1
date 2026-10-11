# clientcc: redesign notes

Same API, auth, permissions, realtime and routing as client2. Only the visual layer changed.

- Type: Geist Variable (UI) and Geist Mono Variable (data), self-hosted.
- Neutrals: cool ink scale (slate-* remapped), canvas #f3f4f7, rail #0c0f14.
- One accent: ultramarine #2447d6. indigo, violet, purple and blue utilities all resolve to it,
  so every page re-themes without feature code changes. Success, warning and error are unchanged.
- Shell: dark rail, one "you are here" active state, sentence-case group labels, explicit
  log-out button (previously the whole profile card logged you out).
- Login: ink panel, one light source, invented uptime/project stats removed.
- Tinted shadows, focus-visible rings, reduced motion, no backdrop blur.
- Includes the earlier performance work (route splitting, lazy wizard).

Change the look in: src/index.css (@theme), src/layout.tsx, src/pages/login/*.
Run: npm install && npm run dev

## Dashboard (Command Center)
src/pages/dashboard/cc/CommandCenter.tsx replaces the old five-color tile wall with:
greeting and one-line status, a single KPI strip, projects ranked by urgency (delayed first,
then AI delay risk), a needs-attention list of escalated tasks, 7-day activity bars and unread
notifications. It reuses the existing loaders, realtime refresh, task table and task modal.
Charts no longer load on this page, so recharts is only fetched by pages that use it.
See API_WISHLIST.md for backend additions that would simplify it further.
