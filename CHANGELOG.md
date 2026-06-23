# Changelog

Recent notable changes. Older versions in git history.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

---

## v0.6 — Mobile + categories registry + Clippy settings

### Added
- **Mobile-friendly layout** — slide-in drawer sidebar + sticky top bar with hamburger below `lg` breakpoint
- **Per-type category registry** (`category_registry` table) — separate dropdowns for Výdavky vs Príjmy, with CRUD UI in Settings
- **Bank registry** (15 SK/EU banks) — checklist in Settings to enable/disable per user, with `enabled` flag preserving transactions
- **RaulClippy widget settings** — 3 modes (on / mascot-only / off) + 3 sizes (sm / md / lg), live updates via CustomEvent
- **Clippy tips** — new `clippy_tips` table, 12 short witty AI-generated tips with typewriter effect, auto-backfill on first read
- **Feedback widget** (📮 in sidebar) — modal form → email to maintainer, rate-limited 5/h
- **www.nulanaucte.sk → root redirect** — vercel.json hostname rewrite
- **Brand logo as Raul portrait** — transparent PNG with gold ring, used in shells + emails
- **Návod page** — 14-section user manual with anchor TOC
- **Privacy + Bezpečnosť + Ako to funguje** info pages (accessible without login)
- **Display name in sidebar** (fallback email)
- **Mobile mascot scaling** — bubble caps at viewport width; smaller defaults under `sm`
- **Type-aware category combobox** — portal-rendered dropdown that escapes table overflow:hidden
- **Default month = last month with data** — backend smart-fallback, frontend defaults to previous calendar month

### Changed
- **Removed dark theme entirely** — light parchment is now the only theme; deleted `useTheme`, theme toggles, dark CSS overrides
- **Default tip length** doubled (max 100 → 200 chars)
- **Default Clippy font** +20 % (10.5 → 12.5 px)
- **Splátky stat card** — now computed from actual loan-category transactions, not just `/hypoteky` config
- **Raul auto-generate disabled** — was burning rate-limit budget on month switches; now strict user-initiated
- **AI rate-limit split** into 3 buckets (read 300/h, edit 200/h, expensive 20/h) instead of one 30/h covering everything
- **Stub fallbacks no longer cached** — failed OpenAI calls don't pollute the DB; next regenerate tries live
- **`fallbackReason` surfaced** to UI with crimson warning banner explaining what went wrong
- **AI prompts updated** — categorisation more decisive about codes like `BTS.AERO` (airport parking); Raul + Clippy persona refined

### Fixed
- Sidebar logo now clickable → returns to dashboard
- Drag-and-drop on import dropzone actually works (wasn't wired before — looked like dropzone)
- Window-level guard prevents dropped files outside dropzone from navigating browser away
- Dashboard category-trend chart positioned ABOVE income/expense chart
- Top-6 category tiles font sizes bumped for legibility on cream background

### Removed
- Dark theme (Lumos/Nox toggle, useTheme hook, data-theme attribute)
- Powered by + Secured by badges from Sidebar (kept in AuthShell footer)
- Old hardcoded "Tvoje kategórie" placeholder block on Dashboard
- Auto-trigger of POST /api/ai/recommendations on dashboard mount

---

## v0.5 — Merchant memory + per-bank settings

### Added
- **merchant_rules** table — per-user lookup `(key → category)`. Manual user overrides remembered across imports.
- **AI merchant extraction** — categorize endpoint now also returns + persists clean merchant name (`transactions.merchant` column)
- **Re-analyze button** — `{ force: true }` mode re-categorises everything except user-locked entries
- **Better AI prompt** — explicit handling of 3-4 letter codes (IATA airports, ICAO, .aero domains, coach companies, toll systems)
- **Auto-show category column on Dashboard recent transactions** with inline editor
- **Per-IP rate limit split**

### Changed
- Categorization endpoint now applies rules first, AI only for unmatched
- High-confidence AI results also become rules (memoization)

---

## v0.4 — Brand + emails

### Added
- New tagline: "Raul uprace tvoje financie. Lebo ty nevieš. Zadarmo."
- Brand logo (Raul portrait) in every shell + emails (parchment medailón)
- /privacy, /bezpecnost, /ako-to-funguje public pages

### Changed
- Email templates refactored to light parchment palette
- AuthShell footer with legal links + Powered by badges

---

## v0.3 — Cron reports

### Added
- Weekly + monthly email reports via Vercel Cron
- Frequency setting in Settings → Profile

---

## v0.2 — AI integration

### Added
- OpenAI gpt-4o-mini for categorization
- Raul recommendations
- Rule-based fallback when key missing

---

## v0.1 — Production deploy

### Added
- Vercel deploy with custom Hono Node adapter
- Custom domain `nulanaucte.sk` via Vercel + DNS
- Postgres migration to Neon
- Resend for transactional email
- Drizzle ORM + 9 tables

### Fixed
- 5 CRITICAL + 9 HIGH security audit findings (see SECURITY_AUDIT.md)

---

## v0.0 — Local prototype

Initial Claude Code prototype: React + Hono + SQLite, single-user, no auth. Demo for personal use.
