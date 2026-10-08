# client2 performance pass (look unchanged)

| Change | Why it was slow | Files |
|---|---|---|
| Route-level code splitting (`React.lazy` + Suspense) | One 1.78 MB (455 KB gz) JS bundle parsed before first paint | `App.tsx` |
| Wizard lazy-loaded + idle prefetch | 7-step wizard (~68 KB) was in the main bundle | `NewProject/LazyNewProjectPage.tsx`, `ProjectsListPage.tsx`, `dashboard.tsx` |
| Removed `backdrop-filter` from modal/sheet scrims | Full-screen live blur over a heavy page re-rasterised on every frame of open/close | `Modal.tsx`, `Sheet.tsx`, `ModalOverlay.tsx`, 2 others |
| Removed `backdrop-blur` from cards/header/sidebar (they were 90-95% opaque already) | Dozens of blur layers + sticky header blur repainting on scroll | `layout.tsx`, cards, `index.css` |
| `AnimatedBackground` is static gradients | Two infinitely animated 80px-blur full-viewport blobs | `AnimatedBackground.tsx` |
| Fonts: Inter moved from CSS `@import` to `<link>` with preconnect, weights trimmed; icon font non-blocking | CSS @import chain + render-blocking variable icon font | `index.html`, `index.css` |
| Vendor chunks (react, charts, motion, signalr) | Better caching across deploys | `vite.config.ts` |
| nginx gzip + immutable cache for `/assets/`, no-cache for index.html | No compression/caching headers | `nginx.conf` |
| `prefers-reduced-motion` respected | accessibility | `index.css` |

Result: entry JS 1,776 KB -> ~143 KB (+ react-vendor 220 KB shared); each page loads on demand.

Not touched (next candidates): `ProjectOverviewPage` (1000 lines) / `SkillsPage` memoization, virtualising long tables, subsetting the Material Symbols font to used icons.
