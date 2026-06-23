# Feature catalogue

Every user-visible feature in the app, with where it lives in code and a short description.

---

## Authentication

| Feature | UI | Backend |
|---|---|---|
| Registration with email verification | `pages/Register.tsx`, `pages/Verify.tsx` | `routes/auth.ts → register, verify` |
| Login + session cookie | `pages/Login.tsx` | `routes/auth.ts → login, /me`, JWT in `lib/jwt.ts` |
| Password reset via email | `pages/Forgot.tsx`, `pages/Reset.tsx` | `routes/auth.ts → forgot, reset` |
| Account lockout after 5 fails | — (server-only) | `routes/auth.ts → login` checks `lockedUntil` |
| Logout (single-device) | `Sidebar.tsx → Opustiť trezor` | `routes/auth.ts → logout` bumps tokenVersion |
| Change password (invalidates all sessions) | `pages/Settings.tsx → PasswordSection` | `routes/user.ts → change-password` |
| GDPR data export | `pages/Settings.tsx → DataSection` | `routes/user.ts → export` (JSON download) |
| Account deletion + cascade | `pages/Settings.tsx → DangerSection` | `routes/user.ts → DELETE /` |

## Bank management

| Feature | UI | Backend |
|---|---|---|
| Bank list with balance + tx count | `pages/Banky.tsx` | `routes/banks.ts → GET /` |
| Add custom bank | `pages/Banky.tsx → new bank form` | `routes/banks.ts → POST /` |
| Bank registry checklist (15 SK/EU options) | `pages/Settings.tsx → BanksSection` | `routes/banks.ts → /registry, /registry/toggle` |
| Enable/disable bank (soft hide) | Settings checkbox | `banks.enabled` flag |
| Import PDF/CSV | `pages/Banky.tsx → ImportModal` | `routes/imports.ts` |
| Drag & drop file picker | `ImportModal` | — |
| Preview before commit | `ImportModal` | `/api/imports/{csv,pdf}/preview` |
| Auto-format detection | `ImportModal` | `lib/csv-parsers.ts`, `lib/pdf-parsers.ts` |
| Format override pills | `ImportModal` | — |
| Deduplication via fingerprint | server | `transactions_bank_fingerprint_uq` index |

## Transactions

| Feature | UI | Backend |
|---|---|---|
| List with month + bank filter | `pages/TransactionsPage.tsx` (used by Vydavky, Prijmy) | `routes/banks.ts? actually /api/transactions in src/index.ts` |
| Month navigation | `components/ui/MonthPicker.tsx` | `routes/banks.ts → /api/months` |
| Per-bank totals + share % | `TransactionsPage` summary card | computed client-side |
| Inline category edit | `components/ui/CategorySelect.tsx` | `routes/ai.ts → PATCH /transactions/:id/category` |
| Combobox dropdown via portal | `CategorySelect` | — |
| Type-aware category list | TransactionsPage fetches `/api/categories?type=...` | `routes/categories.ts → GET /` |
| Merchant rule memorisation | server-only side effect | `db.ts → upsertMerchantRule` |
| Bulk wipe all transactions | `Banky.tsx → Vymazať dáta` | `DELETE /api/transactions` |

## AI

| Feature | UI | Backend |
|---|---|---|
| Categorize (uncategorized only) | `pages/Vydavky.tsx → CategorizeButton` | `routes/ai.ts → POST /categorize` |
| Re-categorize ALL | `Vydavky → CategorizeButton force` | same, `{ force: true }` |
| Live progress phases (fetch / AI / rules) | `components/ui/AIButtons.tsx` | — |
| Raul recommendations | `Dashboard.tsx → RaulPanel` | `routes/ai.ts → POST /recommendations` |
| Cached Raul per month | server | `recommendations` table |
| Stub fallback with reason | RaulPanel warning banner | `lib/ai.ts` returns `fallbackReason` |
| Clippy floating mascot | `components/ui/RaulClippy.tsx` (in `Layout`) | `routes/ai.ts → GET /clippy-tips` |
| Typewriter tip animation | `RaulClippy` | — |
| Auto-backfill clippy from existing Raul rec | server-only | `routes/ai.ts → GET /clippy-tips` (one-shot gen) |
| Clippy mode + size settings | `pages/Settings.tsx → ClippySection` | localStorage `nu_clippy_prefs_v1` |
| × dismiss for 7 days | `RaulClippy` | localStorage timestamp |

## Categories

| Feature | UI | Backend |
|---|---|---|
| Per-type registry (Výdavky/Príjmy) | `Settings → CategoriesSection` | `routes/categories.ts` (CRUD) |
| Add custom category | input + "+ Pridať" | `POST /api/categories` |
| Archive / restore | × skryť / ↺ vrátiť buttons | `PATCH /api/categories/:id` |
| Starter list shown collapsed | `<details>` summary | merged on server |

## Dashboard

| Feature | UI | Backend |
|---|---|---|
| Cashflow stat cards (Príjmy/Výdavky/Splátky) | `pages/Dashboard.tsx` | `/api/dashboard/summary` |
| Top 6 category mini-tiles | Dashboard | computed from `/api/dashboard/categories` |
| 6-month stacked category trend | Dashboard `CategoryDashboardSection` | `/api/dashboard/category-trend` |
| 6-month income vs expense bar chart | Dashboard `IncomeExpenseBarChart` | `/api/dashboard/trend` |
| Net cashflow sparkline | Dashboard `Sparkline` | from trend data |
| Recent transactions (inline editable) | Dashboard | from `/api/dashboard/summary` |
| Smart default month (last with data) | Dashboard + server fallback | `routes` in `src/index.ts` |
| Splátky úverov from real transactions | Dashboard stat card hint | computed via category-regex in summary route |

## Reports + cron

| Feature | UI | Backend |
|---|---|---|
| Weekly email reports | (email) | `routes/reports.ts → run/weekly` + vercel.json cron |
| Monthly email reports | (email) | `routes/reports.ts → run/monthly` |
| Frequency setting | `Settings → ProfileSection` | `routes/user.ts → profile` |
| Email templates with Raul medailón | — | `lib/email-reports.ts` |

## UX surfaces

| Feature | UI | Backend |
|---|---|---|
| Návod (14-section user manual) | `pages/Navod.tsx` (via InfoShell) | — |
| Privacy policy | `pages/Privacy.tsx` | — |
| Bezpečnosť page | `pages/Security.tsx` | — |
| Ako to funguje (onboarding) | `pages/HowItWorks.tsx` | — |
| Feedback widget | `components/ui/FeedbackWidget.tsx` (sidebar) | `routes/feedback.ts → POST /` |
| Powered by + Secured by badges | `components/ui/PoweredBy.tsx` (AuthShell footer) | — |
| Light theme only | `frontend/styles.css` `@theme` | — |
| Mobile drawer + top bar | `Layout`, `Sidebar` (drawer mode), `MobileTopBar.tsx` | — |

## Admin

| Feature | UI | Backend |
|---|---|---|
| Stats overview (no financial data) | `pages/Admin.tsx` | `routes/admin.ts → /stats` |
| Recent signups list | Admin page | — |

## Security

| Feature | Where |
|---|---|
| JWT with tokenVersion revocation | `lib/jwt.ts`, `middleware/auth.ts` |
| PBKDF2 600k password hashing | `lib/password.ts` |
| Constant-time login (anti-timing) | `routes/auth.ts → login` |
| Rate limiting (split AI vs cheap) | `middleware/rateLimit.ts`, applied in `routes/ai.ts` |
| Body size limits | `middleware/bodyLimit.ts` |
| CSP, HSTS, X-Frame, Referrer-Policy | `vercel.json` headers |
| HttpOnly Secure SameSite cookies | `routes/auth.ts → login` |
| Account lockout (5 fails / 15 min) | `routes/auth.ts → login` + `users.lockedUntil` |

---

## Removed / deprecated

- **Dark theme (Nox)** — removed v0.6, single light theme only
- **Theme toggle (Lumos/Nox button)** — removed from all shells
- **`useTheme` hook** — deleted
- **Inbound email webhook** — code remains but Resend made it Pro-only; not recommended for new deploys
