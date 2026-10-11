# Performance pass (client2)

Behaviour and visual design are unchanged. Only how the app loads and renders changed.

| Change | Why it was slow | Effect |
|---|---|---|
| Route-level code splitting (`App.tsx`, `lib/lazyPage.ts`) | One 1.86 MB JS bundle (477 KB gzip) parsed before first paint | Entry chunk ~35 KB; pages load on demand |
| Preload on nav hover, tab hover, and browser idle | Lazy loading must not add click latency | Chunks are usually cached before the click |
| Project tabs lazy (`ProjectDetailShell`) | All five tab pages loaded together | Only the active tab loads |
| New project wizard lazy + steps prefetched (`NewProject/lazyWizard.tsx`) | Wizard and 7 steps shipped in every page | Opens instantly after idle warm-up |
| Removed every `backdrop-blur` (modal scrims, sidebar, header, cards) | Blur re-composites the whole page behind it each frame; worst on modals/sheets | Smooth open/close; surfaces bumped to /97 alpha to look the same |
| Self-hosted Inter via `@fontsource-variable/inter` | CSS `@import` to Google Fonts blocked first render | No render-blocking font request |
| `preconnect` for Material Symbols | Late connection setup | Faster icon font |
| Layout resize listener -> `matchMedia` | State updates on every resize event | Fires only at breakpoints |
| Vendor chunking (`vite.config.ts`) | Charts/motion/signalr bundled with app code | Long-lived caching, charts only where used |
| `prefers-reduced-motion` support | n/a | Accessibility |
