# Architecture

Snapshot toho, ako sa veci spájajú. Postupne zhora — od request lifecyle dole cez vrstvy až po dáta.

---

## High-level

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser                                │
│   React 18 SPA (Vite bundle)  ←——cookies (JWT)————→  Server │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Vercel Edge / Node Serverless                │
│   ┌────────────────────────────────────────────────────┐    │
│   │  api/index.ts  (custom adapter)                    │    │
│   │     ▼                                              │    │
│   │  Hono app (src/index.ts)                           │    │
│   │     ▼                                              │    │
│   │  Routes (auth | banks | transactions | ai | ...)   │    │
│   │     ▼                                              │    │
│   │  Middleware (requireAuth, rateLimit, bodyLimit)    │    │
│   │     ▼                                              │    │
│   │  Drizzle queries → @neondatabase/serverless        │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │  Vercel Cron → /api/reports/run/{weekly,monthly}   │    │
│   └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
   Neon Postgres    Resend         OpenAI
   (data)          (emails)      (categorize + Raul + Clippy)
```

---

## Stack rationale

| Vrstva | Tech | Prečo |
|---|---|---|
| Frontend framework | **React 18** | Stabilné, široký ekosystém, vlastné `useAuth` namiesto Next-style server components |
| Router | **react-router-dom v6** | Žiadny SSR netreba — SPA s public/private routes |
| Bundler | **Vite v5** | Rýchly dev (Hono integrated cez `@hono/vite-dev-server`) + jednoduchá produkcia |
| Styling | **Tailwind v4** | `@theme` CSS-vars, no config file. Light-only palette |
| Backend | **Hono v4** | Web Standards (Request/Response) → portable medzi runtimes; nehladá DB driver |
| Adapter | **Custom Node adapter** (`api/index.ts`) | `hono/vercel` `handle()` nefunguje pre Vercel Node runtime (chce `(req,res)`); 30 riadkov mostíka |
| DB driver | **`@neondatabase/serverless`** | HTTP fetch-based, žiadny TCP connection pool — Vercel cold start friendly |
| ORM | **Drizzle** | TypeScript-first, schema-as-code, generuje typy, dovoľuje raw SQL pre custom queries |
| Auth | **`jose` JWT + HttpOnly cookie** | Stateless = no session store potrebný; revocation cez `users.tokenVersion` |
| Password hashing | **PBKDF2-HMAC-SHA256, 600k iterations** | Web Crypto API native — no native deps; OWASP-compliant cost |
| Email | **Resend SDK** | Najlepší DX z modern email providerov; React Email kompatibilný (nepoužité) |
| AI | **OpenAI SDK v6, gpt-4o-mini** | Cena $0.15/1M input tokens — najlacnejší vhodný model |

---

## Request flow

### 1. Frontend → Backend

```
fetch('/api/transactions?type=vydavok')
  ↓
Browser pridá Cookie: nu_session=...
  ↓
Vercel routes /api/* na /api/index.ts (vercel.json rewrites)
  ↓
api/index.ts: Node IncomingMessage → Web Request
  ↓
Hono app: matchne route → middleware chain → handler
  ↓
handler: Drizzle query → Neon HTTP
  ↓
JSON response → Hono → api/index.ts: Web Response → Node res.end()
```

### 2. Auth middleware (`src/middleware/auth.ts`)

```ts
1. Read 'nu_session' cookie
2. Verify JWT signature (jose)
3. Load user from DB by `sub` claim
4. Check user.tokenVersion === jwt.tokenVersion
   (mismatch = user clicked "Logout everywhere" or changed password)
5. c.set('user', { id, email })
6. next()
```

Failure → 401 JSON, frontend redirects to `/login`.

### 3. Rate limit (`src/middleware/rateLimit.ts`)

In-memory token bucket per key (IP for public routes, `u:${userId}` for authed). Three named buckets in `src/routes/ai.ts`:
- `ai-read` — 300/h (cheap GETs)
- `ai-edit` — 200/h (PATCH category)
- `ai-expensive` — 20/h (POST categorize / recommendations — actual OpenAI calls)

In-memory has a real caveat on serverless: each lambda instance has its own bucket → effective limit can be N×declared limit. For a single-user / few-user app this is fine; for scale, swap with Upstash Redis (one-file change).

---

## Source layout

```
nulanaucte/
├── api/
│   └── index.ts          ← Vercel Node serverless entry (custom adapter)
│
├── src/                  ← Backend (TypeScript, Hono)
│   ├── env.ts            ← Centralised env validation, fail-fast in prod
│   ├── schema.ts         ← Drizzle schema (all tables)
│   ├── db-client.ts      ← Neon driver init
│   ├── db.ts             ← All queries (typed helpers)
│   ├── index.ts          ← Hono app wiring + dashboard routes
│   ├── types.ts          ← Shared TypeScript types
│   ├── middleware/
│   │   ├── auth.ts       ← JWT cookie verification + tokenVersion check
│   │   ├── rateLimit.ts  ← Token bucket per key
│   │   └── bodyLimit.ts  ← Content-Length cap
│   ├── lib/
│   │   ├── jwt.ts        ← jose signing/verification
│   │   ├── password.ts   ← PBKDF2 600k (Web Crypto)
│   │   ├── email.ts      ← Resend SDK + dev console fallback
│   │   ├── email-reports.ts ← Weekly/monthly templates
│   │   ├── ai.ts         ← OpenAI prompts + rule-based fallback
│   │   ├── banks.ts      ← Bank registry (15 SK/EU)
│   │   ├── csv-parsers.ts ← SLSP/Tatra/Revolut CSV
│   │   ├── pdf-parsers.ts ← SLSP PDF
│   │   ├── pdf-extract.ts ← Server-side PDF→text (pdfjs-dist)
│   │   └── parser-utils.ts ← SK number/date format helpers
│   └── routes/
│       ├── auth.ts        ← Register, login, verify, forgot, reset, logout
│       ├── user.ts        ← Profile, change password, delete account, export
│       ├── banks.ts       ← CRUD + registry/toggle
│       ├── categories.ts  ← Per-type category registry CRUD
│       ├── imports.ts     ← CSV/PDF preview + commit
│       ├── ai.ts          ← Categorize, recommendations, clippy-tips
│       ├── mortgages.ts   ← CRUD
│       ├── reports.ts     ← Cron endpoints
│       ├── feedback.ts    ← Bug/idea → email to maintainer
│       └── admin.ts       ← Admin-only aggregated stats
│
├── frontend/             ← React SPA (TypeScript, Vite, Tailwind v4)
│   ├── App.tsx           ← React Router config
│   ├── main.tsx          ← React mount
│   ├── styles.css        ← Tailwind v4 @theme block + globals
│   ├── pages/            ← Route components (Login, Dashboard, ...)
│   ├── components/
│   │   ├── layout/       ← Layout, Sidebar, MobileTopBar, AuthShell, InfoShell
│   │   └── ui/           ← Card, MonthPicker, Charts, CategorySelect, RaulClippy,
│   │                       FeedbackWidget, AIButtons, BrandLogo, PoweredBy
│   ├── hooks/            ← useAuth
│   ├── utils/            ← apiFetch, pdf (browser-side PDF→text), clippyPrefs
│   └── assets/           ← raul.png logo
│
├── public/               ← Static files (served at root by Vite/Vercel)
│   └── raul.png          ← Stable URL for email embeds
│
├── drizzle/              ← Auto-generated migration files (drizzle-kit)
├── drizzle.config.ts
├── vite.config.ts
├── vercel.json           ← Routes, cron, security headers
├── index.html            ← Vite entry HTML
├── package.json
└── tsconfig.json
```

---

## Key invariants

### 1. Per-user data isolation
Every table that holds user data (`banks`, `transactions`, `mortgages`, `recommendations`, `clippy_tips`, `merchant_rules`, `category_registry`, `user_tokens`) has `user_id` column with `REFERENCES users(id) ON DELETE CASCADE`. **Every query** filters by `userId` from `c.get('user')` — there is no admin-style "fetch any user's data" path.

Account delete cascades automatically via FK → no orphaned data.

### 2. Idempotent migrations
`ensureSeeded()` in `src/db.ts` runs on every cold-start (memoised per process). It contains `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements for everything added after the initial `drizzle-kit push`. So **a fresh deploy never needs a manual migration step**; the first request applies any pending DDL.

Drizzle migrations in `drizzle/` exist for completeness but aren't used in CD.

### 3. Transactions dedupe by `(bank_id, fingerprint)`
`fingerprint = sha256(date + amount + description)` per row. Unique index `transactions_bank_fingerprint_uq`. Re-importing the same PDF is a no-op (ON CONFLICT DO NOTHING).

### 4. Stub responses are NEVER cached
If OpenAI fails / key is missing, `generateRecommendations` and `generateClippyTips` return stub content with `fallbackReason` set. The route checks `usedAI === true` before writing to DB. So a transient OpenAI outage doesn't poison the cache — next regenerate tries live again.

### 5. User overrides win over AI
`merchant_rules` table has a `source: 'user' | 'ai'` column. `upsertMerchantRule` will NOT overwrite a 'user' row with an 'ai' row. Once the user picks a category for Tesco, AI never reverts it across imports.

### 6. Auth state revocation
`users.tokenVersion: integer` is included in JWT claims and re-checked on every authed request. `bumpTokenVersion(userId)` is called on:
- Logout (single device only — bump invalidates ALL devices)
- Password change
This is the cheap-but-effective alternative to a session store.

---

## Frontend architecture

### Routing
- Public: `/login`, `/register`, `/verify`, `/forgot`, `/reset`, `/privacy`, `/bezpecnost`, `/ako-to-funguje`, `/navod`
- Protected: `/dashboard`, `/banky`, `/prijmy`, `/vydavky`, `/hypoteky`, `/nastavenia`, `/admin`
- Protection: `<ProtectedRoute>` wrapper in `App.tsx` checks `useAuth().user` — null → `<Navigate to="/login" />`

### Auth state
Single `useAuth()` hook → fetches `/api/auth/me` on mount, holds `{ user, loading, refresh, logout }`. No global state lib — props/context not needed because there's only one consumer pattern.

### Layout
`Layout.tsx` (only for authed routes):
- `<lg` viewport: `<MobileTopBar>` at top, `<Sidebar>` as slide-in drawer (transformed off-screen until `drawerOpen`)
- `>=lg`: regular `<Sidebar>` aside, no mobile bar
- `<RaulClippy>` floats bottom-right always

### Data fetching
No SWR / React Query — raw `useEffect` + `fetch` is plenty for ~10 endpoints. `frontend/utils/api.ts` wraps `fetch` with:
- Auto JSON parsing
- Discriminated-union response: `{ ok: true, data }` | `{ ok: false, error }`
- Credentials always `include` (for cookie auth)

### Styling
- Tailwind v4 utility classes everywhere
- `@theme` block in `frontend/styles.css` declares ~30 design tokens (colors, fonts, shadows)
- Single light theme. Old dark theme was removed in v0.6.

---

## Persistence schema (high-level)

| Table | Owner | Notes |
|---|---|---|
| `users` | — | Auth root. `tokenVersion` for JWT revocation |
| `user_tokens` | `users.id` | One-shot tokens for verify-email / password-reset (SHA-256 hashed) |
| `banks` | `users.id` | User's account list. `enabled` flag for soft hide |
| `transactions` | `users.id`, `banks.id` | Core financial data. Unique on `(bank_id, fingerprint)` |
| `mortgages` | `users.id` | Long-term liabilities (manually entered) |
| `incomes` | `users.id` | Manual income entries (legacy, mostly unused) |
| `recommendations` | `users.id` | Cached Raul text per (user, period) |
| `clippy_tips` | `users.id` | Cached clippy tip array per (user, period) JSON |
| `merchant_rules` | `users.id` | Per-user `key → category` mapping for re-import categorization |
| `category_registry` | `users.id` | Per-user, per-type custom category list |

Full DDL + indexes: [DATABASE.md](./DATABASE.md).

---

## Deployment topology

```
GitHub repo (martinbulak/Nulanaucte)
   ↓ push to main
Vercel auto-deploy (~60s)
   ├── Frontend bundle (Vite) → CDN edge
   ├── Serverless function (api/index.ts) → Node runtime (Frankfurt)
   ├── Static assets (public/*) → CDN edge
   └── Cron jobs → triggered by Vercel scheduler
                    └─→ POST /api/reports/run/{weekly,monthly}

DNS (registrar)
   ├── A    @     76.76.21.21 (Vercel anycast)
   ├── A    *     76.76.21.21
   └── CNAME www  cname.vercel-dns.com

External services
   ├── Neon Postgres (Frankfurt) — DB
   ├── Resend (US) — outbound emails
   └── OpenAI (US) — AI calls
```

Total cold-start latency on Vercel + Neon HTTP driver: ~300–600ms warm, ~1.2s cold (Frankfurt).

---

## Scaling notes

**Where it'd break first if pushed to 1000+ active users:**

1. **Rate limit buckets in-memory** — each lambda instance has its own, so effective limits go up by N. Migrate to Upstash Redis (15 min change in `src/middleware/rateLimit.ts`).
2. **OpenAI costs** — categorize hits chunk × parallel = ~5k tokens per import. At 1000 users × 4 imports/mes × $0.001 = $4/mes. Linear, but watch.
3. **Neon free tier 0.5 GB** — 500K transactions ≈ 50 MB. Plenty of headroom until ~5M txs total across all users.
4. **Vercel hobby 100 GB-hours/mes serverless time** — tight. Single request ~0.3s, so ~1.2M requests/mes ceiling.

Architecture itself scales horizontally — Hono is stateless, DB queries are short, OpenAI is upstream-bounded. No bottleneck in the code.
