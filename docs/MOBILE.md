# Mobile / responsive design

The app is **mobile-first as of v0.6** — works smoothly down to 360 × 640 px (smaller Android phones). Tailwind breakpoints used:

- `(default)` — mobile, < 640 px
- `sm` — ≥ 640 px (large phones, small tablets)
- `md` — ≥ 768 px (tablets)
- `lg` — ≥ 1024 px (laptops; sidebar appears)
- `xl` — ≥ 1280 px (desktop)

---

## Layout behaviour

### `< lg` (mobile + tablet)
- **Sidebar hidden** — appears as slide-in drawer when user taps hamburger
- **`MobileTopBar` sticky** at top: hamburger + brand logo + user avatar initial
- Backdrop dims the page when drawer is open; tap to close
- Body scroll locked while drawer is open
- Esc / nav-link click / × button — all close the drawer
- Main padding tighter: `px-4 py-6`

### `>= lg` (desktop)
- Sidebar always visible (sticky aside, 288 px wide)
- MobileTopBar hidden
- Main padding generous: `lg:px-8 lg:py-10`

Files:
- [`frontend/components/layout/Layout.tsx`](../frontend/components/layout/Layout.tsx)
- [`frontend/components/layout/Sidebar.tsx`](../frontend/components/layout/Sidebar.tsx)
- [`frontend/components/layout/MobileTopBar.tsx`](../frontend/components/layout/MobileTopBar.tsx)

---

## Tables

Wide tables (Dashboard recent transactions, /vydavky, /prijmy, /admin) use `overflow-x-auto` wrapper with `min-w-[640|720|600]` on the `<table>`. On phones the user scrolls horizontally with a finger swipe; on desktop the table fits naturally.

The negative margin `-mx-1 sm:mx-0` lets the scrollable area bleed slightly into the page padding on small screens, so the scroll feels natural and rounded corners aren't a hard barrier.

---

## Typography

Page `<h1>`s use a three-step responsive ramp:
```tsx
className="font-display text-3xl sm:text-4xl md:text-5xl text-text-primary leading-tight"
```
- Mobile: 30 px (long titles like *„Výdavky / December 2025"* wrap clean)
- Tablet: 36 px
- Desktop: 48 px

Body / labels don't typically need responsive sizing — `text-sm` / `text-xs` read fine on all widths.

---

## Grids

Use responsive col counts:
```tsx
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
```

Common patterns:
- Stat cards: `grid-cols-1 md:grid-cols-3` (3 stats stack on phones)
- Top 6 category tiles: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` (2-up on phone, 6-up on desktop)
- Settings forms: `grid-cols-1 md:grid-cols-2` for the side-by-side registries
- Charts: `grid-cols-1 lg:grid-cols-3` with `lg:col-span-2` for the main chart

---

## RaulClippy on mobile

- Smaller offset: `bottom-3 right-3` on mobile vs `sm:bottom-5 sm:right-5`
- Bubble max-width capped with `max-w-[min(SIZE, calc(100vw - 5rem))]` so it never overflows
- Avatar size scaled per `prefs.size` and viewport: `w-12 h-12 sm:w-14 sm:h-14` at `md` preset
- Wrapper `pointer-events-none` with bubble + avatar opt-back-in → background scroll still works under it

See [`frontend/utils/clippyPrefs.ts`](../frontend/utils/clippyPrefs.ts) for per-size class lookup.

---

## Modals (ImportModal, FeedbackModal)

- Fixed positioning + `inset-0` + flex centre
- `max-w-xl` on the panel, `max-h-[90vh]` with internal `overflow-auto`
- Backdrop click + Esc close them
- Form fields stack vertically — no responsive grids needed

---

## Touch interactions

- All buttons have at least 36 × 36 px hit area (Tailwind `min-h-9` equivalent)
- Combobox dropdown opens on tap (no hover-only state)
- Drag & drop import works on touch devices that support drag events (iPad with mouse, desktop touch monitors)

---

## Charts (SVG)

`viewBox` on every chart so they scale fluently. On phones the bar density is the same but bars are visually narrower — still readable down to ~320 px width.

If a chart had too many data points to be legible on mobile, the right move would be to reduce label density at `<sm` (skip every other month label, etc.). Current charts (6 months max) don't need this.

---

## Testing

- Chrome DevTools → Toggle Device toolbar → pick iPhone 13 / Pixel 5 / iPad
- Real device test via local network: `npm run dev` then `ipconfig` → open `http://<your-IP>:8787` from phone on same Wi-Fi
- Production: just open https://nulanaucte.sk on your phone

---

## Known mobile gotchas

- **iOS Safari + 100vh** — known issue with viewport height including address bar. We use `min-h-screen` not `h-screen`, which avoids the worst of it.
- **Mobile keyboards** — when the user focuses an `<input>`, the bottom-fixed RaulClippy may overlap. Acceptable trade-off; user taps × to dismiss for the session.
- **Landscape on small phones** — sidebar drawer is `max-w-[85vw]` which keeps a sliver of backdrop visible so the close gesture (tap outside) is obvious.

---

## What's NOT mobile-optimised yet

- **AdminPage** — uses wide tables; works via horizontal scroll but layout is desktop-first
- **HypotekyPage forms** — render OK but the side-by-side input grid is dense on phones
- **Charts on `<320 px`** — labels start to overlap. Affects ~0.1% of devices

Acceptable, low priority for fix.
