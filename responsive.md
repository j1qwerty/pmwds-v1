# PMWDS Responsive Properties by Category (clamp format)
# note - use ai page as reference for all elements for that page, how responsive layout works
## 1. Mobile (Small) — 320px to 639px

**Sidebar**
- Width: clamp(240px, 70vw, 280px) · overlay mode

**Size**
- Toggle button: clamp(28px, 4vw, 32px) × clamp(28px, 4vw, 32px)
- Hamburger button: clamp(28px, 4vw, 32px) × clamp(28px, 4vw, 32px)
- Action buttons: clamp(32px, 4.5vw, 38px) × clamp(32px, 4.5vw, 38px)
- Logout button: clamp(28px, 4vw, 32px) × clamp(28px, 4vw, 32px)
- Nav item (expanded): h: clamp(36px, 5vw, 42px)
- Nav item (compact): clamp(36px, 5vw, 42px) × clamp(36px, 5vw, 42px)
- Avatar: sm (32px)
- Notification dot: clamp(6px, 1vw, 8px) × clamp(6px, 1vw, 8px)

**Margin**
- Sidebar user section: x: clamp(8px, 2vw, 12px) · bottom: clamp(12px, 2vw, 16px)
- Nav section spacing: clamp(16px, 2.5vw, 20px)
- Content left: 0 (overlay sidebar)

**Padding**
- Logo section: x: clamp(12px, 2vw, 16px) · top: clamp(16px, 2.5vw, 20px) · bottom: clamp(8px, 1.5vw, 12px)
- User section: x: clamp(8px, 2vw, 12px) · y: clamp(8px, 1.5vw, 12px)
- Nav items: x: clamp(8px, 1.5vw, 12px) · y: clamp(7px, 1vw, 9px)
- Nav scroll area: x: clamp(8px, 1.5vw, 12px)
- Topbar: 0 clamp(8px, 3vw, 24px)
- Main content: clamp(12px, 2vw, 40px)
- Logout section: x: clamp(8px, 1.5vw, 12px) · bottom: clamp(8px, 1.5vw, 12px) · top: clamp(4px, 1vw, 8px)
- Logout button: x: clamp(8px, 1.5vw, 12px) · y: clamp(8px, 1.5vw, 10px)

**Icons**
- Nav icons: clamp(16px, 2vw, 18px)
- Toggle chevron: clamp(14px, 2vw, 18px)
- Hamburger menu: clamp(16px, 2.5vw, 20px)
- Topbar actions: clamp(16px, 2.5vw, 20px)
- Logout icon: clamp(16px, 2vw, 18px)

**Typography**
- Logo: clamp(18px, 2.5vw, 22px) · weight: 900
- Nav labels: clamp(11px, 1.5vw, 13px) · weight: 500
- Section titles: clamp(9px, 1.2vw, 10px) · weight: 600 · tracking: 0.18em
- User name: clamp(11px, 1.5vw, 13px) · weight: 500
- User role: clamp(8px, 1vw, 9px) · tracking: 0.18em
- Logout text: clamp(11px, 1.5vw, 13px)

**Border**
- Nav items radius: 6px
- User section radius: 16px
- Logout button radius: 12px
- Active nav border: right 3px solid
- Topbar border: bottom 1px
- Toggle/Hamburger radius: 8px
- Action buttons radius: full (9999px)

**Gap**
- Nav items gap: clamp(1px, 0.3vw, 2px)
- Nav section items gap: clamp(4px, 0.8vw, 6px)
- Topbar elements gap: clamp(8px, 1.5vw, 12px)
- Content gap: clamp(16px, 2.5vw, 48px)

**Height**
- Topbar: clamp(48px, 6vw, 56px)


## 2. Mobile (Large) — 640px to 767px

**Sidebar**
- Width: clamp(260px, 60vw, 300px) · overlay mode

**Size**
- Action buttons: clamp(34px, 4vw, 38px) × clamp(34px, 4vw, 38px)
- Nav item (expanded): h: clamp(38px, 4.5vw, 42px)

All other properties: Same as Mobile Small


## 3. Tablet (Portrait) — 768px to 1023px

**Sidebar**
- Width: clamp(56px, 8vw, 64px) · always compact · no text

**Size**
- Nav item (compact): clamp(40px, 5vw, 44px) × clamp(40px, 5vw, 44px)
- Toggle button: clamp(30px, 3.5vw, 34px) × clamp(30px, 3.5vw, 34px)
- Logout button: clamp(30px, 3.5vw, 34px) × clamp(30px, 3.5vw, 34px)
- Avatar: xs (24px)

**Margin**
- Content left: clamp(56px, 8vw, 64px)

**Padding**
- Sidebar scroll area: x: clamp(2px, 0.5vw, 4px)
- User section: clamp(6px, 1vw, 8px) · centered
- Nav items: x: 0 · y: clamp(7px, 1vw, 9px) · centered
- Logout section: x: clamp(4px, 1vw, 8px)
- Logout button: clamp(8px, 1.5vw, 10px) · centered

**Icons**
- Nav icons: clamp(17px, 2vw, 19px)
- Toggle chevron: clamp(15px, 1.8vw, 19px)
- Logout icon: clamp(17px, 2vw, 19px)

**Typography**
- No labels shown · no section titles · icons only

**Border**
- Nav items radius: 8px
- Logout button radius: 12px

**Gap**
- Nav items gap: clamp(2px, 0.4vw, 4px)


## 4. Tablet Landscape / Small Laptop — 1024px to 1279px

**Sidebar**
- Compact: 64px · Expanded: clamp(200px, 25vw, 220px)
- Toggleable · default compact

**Size**
- Nav item (expanded): h: clamp(36px, 3.5vw, 40px)
- Nav item (compact): clamp(40px, 3.5vw, 44px) × clamp(40px, 3.5vw, 44px)
- Toggle button: clamp(30px, 2.8vw, 34px) × clamp(30px, 2.8vw, 34px)
- Action buttons: clamp(34px, 3.5vw, 38px) × clamp(34px, 3.5vw, 38px)
- Logout button (expanded): h: clamp(34px, 3vw, 38px)
- Logout button (compact): clamp(32px, 3vw, 36px) × clamp(32px, 3vw, 36px)
- Avatar (compact): xs (24px)
- Avatar (expanded): sm (32px)

**Margin**
- Content left compact: 64px
- Content left expanded: clamp(200px, 25vw, 220px)

**Padding**
- Expanded nav items: x: clamp(8px, 1.5vw, 12px) · y: clamp(7px, 1vw, 9px)
- Expanded sidebar scroll: x: clamp(8px, 1.5vw, 12px)
- Expanded user section: x: clamp(8px, 2vw, 12px) · y: clamp(8px, 1.5vw, 12px)
- Expanded logout button: x: clamp(8px, 1.5vw, 12px) · y: clamp(8px, 1.2vw, 10px)

**Typography**
- All text visible when expanded · same clamp ranges as mobile
- Hidden when compact

**Icons**
- Nav icons: clamp(16px, 1.8vw, 18px)
- Toggle chevron: clamp(14px, 1.5vw, 18px)
- Action icons: clamp(16px, 2vw, 19px)
- Logout icon: clamp(16px, 1.8vw, 18px)


## 5. Desktop (Standard) — 1280px to 1535px

**Sidebar**
- Compact: 64px · Expanded: clamp(220px, 22vw, 240px)
- Default expanded on load

**Size**
- Nav item (expanded): h: clamp(34px, 2.5vw, 38px)
- Nav item (compact): clamp(38px, 2.8vw, 42px) × clamp(38px, 2.8vw, 42px)
- Toggle button: clamp(30px, 2.2vw, 32px) × clamp(30px, 2.2vw, 32px)
- Action buttons: clamp(34px, 2.8vw, 38px) × clamp(34px, 2.8vw, 38px)
- Logout button (expanded): h: clamp(32px, 2.5vw, 36px)
- Logout button (compact): clamp(32px, 2.5vw, 36px) × clamp(32px, 2.5vw, 36px)
- Avatar (compact): xs (24px)
- Avatar (expanded): sm (32px)

**Margin**
- Content left expanded: clamp(220px, 22vw, 240px)
- Content max-width: 1800px · centered

**Padding**
- Topbar: 0 clamp(8px, 3vw, 24px)
- Main content: clamp(12px, 2vw, 40px)
- Nav items (expanded): x: clamp(8px, 1.5vw, 12px) · y: clamp(6px, 0.8vw, 9px)
- Logout button (expanded): x: clamp(8px, 1.5vw, 12px) · y: clamp(7px, 1vw, 10px)

**Typography**
- Logo: clamp(18px, 2.5vw, 22px)
- Nav labels: clamp(11px, 1.5vw, 13px)
- Section titles: clamp(9px, 1.2vw, 10px)
- User name: clamp(11px, 1.2vw, 13px)
- User role: clamp(8px, 0.8vw, 9px)
- Logout text: clamp(11px, 1.2vw, 13px)

**Icons**
- Nav icons: clamp(16px, 1.5vw, 18px)
- Action icons: clamp(16px, 1.8vw, 20px)
- Toggle chevron: clamp(14px, 1.2vw, 18px)
- Logout icon: clamp(16px, 1.5vw, 18px)

**Gap**
- Content gap: clamp(16px, 2.5vw, 48px)
- Topbar gap: clamp(8px, 1.5vw, 16px)

**Height**
- Topbar: clamp(50px, 4.5vw, 56px)


## 6. Desktop (Large) — 1536px to 1919px

**Sidebar**
- Compact: 64px · Expanded: clamp(230px, 18vw, 250px)

**Size**
- Nav item (expanded): h: clamp(34px, 2vw, 38px)
- Nav item (compact): clamp(38px, 2.2vw, 42px) × clamp(38px, 2.2vw, 42px)
- Toggle button: clamp(30px, 1.8vw, 32px) × clamp(30px, 1.8vw, 32px)
- Action buttons: clamp(36px, 2.5vw, 40px) × clamp(36px, 2.5vw, 40px)
- Logout button (expanded): h: clamp(32px, 2vw, 36px)
- Logout button (compact): clamp(32px, 2vw, 36px) × clamp(32px, 2vw, 36px)
- Avatar (expanded): md (36px)

**Margin**
- Content left expanded: clamp(230px, 18vw, 250px)

**Padding**
- Main content: clamp(24px, 2vw, 36px)
- Nav items (expanded): x: clamp(10px, 1.5vw, 14px) · y: clamp(7px, 0.8vw, 9px)
- User section (expanded): x: clamp(10px, 1.8vw, 14px) · y: clamp(9px, 1.2vw, 12px)

**Typography**
- Logo: clamp(20px, 2vw, 22px)
- Nav labels: clamp(12px, 1.2vw, 13px)
- Section titles: clamp(9px, 0.8vw, 10px)
- User name: clamp(12px, 1vw, 13px)
- User role: clamp(8px, 0.7vw, 9px)

**Icons**
- Nav icons: clamp(17px, 1.5vw, 18px)
- Action icons: clamp(17px, 1.5vw, 20px)
- Toggle chevron: clamp(15px, 1.2vw, 18px)

**Gap**
- Topbar gap: clamp(10px, 1.2vw, 16px)
- Nav items gap: clamp(2px, 0.3vw, 3px)

**Height**
- Topbar: clamp(52px, 3.5vw, 56px)


## 7. Desktop (Extra Large / 4K) — 1920px+

**Sidebar**
- Compact: 64px · Expanded: clamp(240px, 12vw, 280px)

**Size**
- Nav item (expanded): h: clamp(36px, 1.8vw, 40px)
- Nav item (compact): clamp(40px, 2vw, 44px) × clamp(40px, 2vw, 44px)
- Toggle button: clamp(30px, 1.5vw, 34px) × clamp(30px, 1.5vw, 34px)
- Action buttons: clamp(38px, 2vw, 44px) × clamp(38px, 2vw, 44px)
- Logout button (expanded): h: clamp(34px, 1.8vw, 38px)
- Logout button (compact): clamp(34px, 1.8vw, 38px) × clamp(34px, 1.8vw, 38px)
- Avatar (expanded): md (36px)

**Margin**
- Content left expanded: clamp(240px, 12vw, 280px)
- Content max-width: 1800px · auto margins for centering

**Padding**
- Main content: clamp(32px, 1.5vw, 40px)
- Topbar: 0 clamp(18px, 1.5vw, 24px)
- Nav items (expanded): x: clamp(12px, 1.2vw, 16px) · y: clamp(8px, 0.6vw, 10px)
- User section (expanded): x: clamp(12px, 1.2vw, 16px) · y: clamp(10px, 0.8vw, 14px)
- Logo section: x: clamp(14px, 1vw, 18px)

**Typography**
- Logo: clamp(20px, 1.2vw, 22px)
- Nav labels: clamp(12px, 0.8vw, 13px)
- Section titles: clamp(10px, 0.6vw, 10px)
- User name: clamp(12px, 0.8vw, 14px)
- User role: clamp(9px, 0.5vw, 10px)
- Logout text: clamp(12px, 0.8vw, 13px)

**Icons**
- Nav icons: clamp(17px, 1vw, 18px)
- Action icons: clamp(18px, 1vw, 20px)
- Toggle chevron: clamp(15px, 0.8vw, 18px)
- Logout icon: clamp(17px, 1vw, 18px)
- Notification dot: clamp(7px, 0.5vw, 9px) × clamp(7px, 0.5vw, 9px)

**Border**
- Nav items radius: 8px
- User section radius: 18px
- Logout button radius: 14px

**Gap**
- Content gap: clamp(32px, 2vw, 48px)
- Topbar gap: clamp(12px, 0.8vw, 16px)
- Nav items gap: clamp(2px, 0.2vw, 4px)

**Height**
- Topbar: clamp(52px, 3vw, 56px)