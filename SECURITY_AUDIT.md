# Security Audit — "Nula na účte"

**Date:** 2026-05-09
**Scope:** Full codebase at `C:\Users\dk133\Desktop\Moje financie\` — Hono server, React frontend, parsers, webhook.
**Targeted posture:** Personal-use multi-user SaaS for sensitive financial data on Vercel. Not bank-grade, but exploitable bugs MUST be closed before any production deployment.

---

## 1. Summary table

| Severity | Count |
|---|---|
| CRITICAL | 5 |
| HIGH     | 9 |
| MEDIUM   | 11 |
| LOW      | 7 |
| INFO     | 5 |
| **Total** | **37** |

---

## 2. Pre-production blockers

These MUST be fixed before any non-local deployment. Sorted by what hurts most.

1. **JWT secret has a hardcoded fallback** (`src/lib/jwt.ts:5`) — if `JWT_SECRET` is unset (or empty string), all sessions are signed with a public secret committed to git. Anyone can forge sessions for any user. **Hard-fail at boot if missing.**
2. **Login cookie has `secure: false` hardcoded** (`src/routes/auth.ts:37`) — token leaks over plain HTTP. Force `secure: true` and `__Host-` prefix in production.
3. **Webhook HMAC verification silently bypassed when `INBOUND_WEBHOOK_SECRET` is unset** (`src/routes/inbound.ts:53-56`) — anyone on the public internet who can hit `/api/inbound/email` can inject arbitrary "transactions" into any user's account by guessing/enumerating the 6-character inbound token (~1 billion combinations, but enumeration is unbounded — see #4). **Hard-fail in production.**
4. **No rate limiting anywhere** — login is brute-forceable, inbound webhook tokens are enumerable, PDF parser can be DoS'd, password verification is 600k PBKDF2 rounds (CPU bomb if hammered). Add per-IP rate limits on `/api/auth/login`, `/api/inbound/email`, and a global slow-down.
5. **Inbound email accepts unbounded body & attachments without size limit** (`src/routes/inbound.ts:142`, `extractPdfText`) — an attacker (or a malicious sender of a forwarded email) can post a 100 MB JSON or a PDF bomb. Hono's `c.req.text()` reads everything into memory. Enforce `Content-Length` cap (~10 MB) and per-attachment cap.
6. **CSV/PDF import endpoints accept unbounded text bodies** (`src/routes/imports.ts`) — same DoS vector for authenticated users. Bound input length (~5 MB).
7. **Inbound token is only 6 chars from a 31-letter alphabet** (`src/db.ts:88-93`) → ~887 million combinations. With no rate limit, a determined attacker can enumerate. Bump to 12+ chars (~10²⁰).
8. **Closed registration is a feature, not a flaw — but the seeded user has password `koduvanica`** (`src/db.ts:39`). Before deploy: change the seeded credentials, or replace seeding with an admin-invite flow.
9. **No CSRF protection beyond `SameSite=Lax`** — for login that's enough, but `Lax` allows top-level GETs cross-site. The `DELETE /api/transactions` endpoint is destructive and only protected by SameSite. Add a CSRF token, or set `SameSite=Strict` for the session cookie.
10. **In-memory store loses everything on every server restart / Vercel cold start** (`src/db.ts:14-22`). On Vercel the data won't even be consistent across requests — different instances will have different state. **The app is not deployable as-is without a real database.**

---

## 3. Findings — CRITICAL

### C1 — Hardcoded JWT secret fallback
- **Category:** 10 — Secrets management
- **Location:** `src/lib/jwt.ts:4-6`
- **Description:** `process.env.JWT_SECRET || 'koduvanica-dev-secret-change-me-in-production-please'` — if the env var is missing or empty, every JWT in production is signed with a string that lives in the public git repo. Token forgery is trivial (paste secret into jwt.io, sign `{uid:1, email:"koduvanica"}`). This bypasses *all* auth.
- **Fix:**
  ```ts
  const raw = process.env.JWT_SECRET
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 chars')
  }
  const SECRET = new TextEncoder().encode(raw)
  ```
  Generate the prod value with `openssl rand -base64 48` and store in Vercel env. Optionally: rotate by maintaining `JWT_SECRET_NEXT` and accepting both during cutover.

### C2 — Webhook signature bypass when secret unset
- **Category:** 5 — Webhook security
- **Location:** `src/routes/inbound.ts:53-56`
- **Description:** If `INBOUND_WEBHOOK_SECRET` is unset, `verifyWebhook` returns `true` and just `console.warn`s. In production this means anyone on the internet can POST to `/api/inbound/email` and, if they know or guess any 6-char token, inject fake transactions. Even without knowing a token, they can enumerate (no rate limit, see C5).
- **Fix:** Refuse to start if the secret is missing in prod.
  ```ts
  if (process.env.NODE_ENV === 'production' && !process.env.INBOUND_WEBHOOK_SECRET) {
    throw new Error('INBOUND_WEBHOOK_SECRET required in production')
  }
  ```
  Also reject any request with missing `svix-*` headers in dev once a token is set.

### C3 — Insecure cookie flags in production
- **Category:** 1 — Authentication & session
- **Location:** `src/routes/auth.ts:34-40`
- **Description:** Cookie is set with `secure: false` and `sameSite: 'Lax'`, hardcoded. On Vercel HTTPS this still works, but the Set-Cookie won't survive a downgrade and any non-HTTPS subdomain MITM (public Wi-Fi → http subresource → cookie leaked) leaks the session token.
- **Fix:**
  ```ts
  const isProd = process.env.NODE_ENV === 'production'
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Strict',     // or 'Lax' if you have cross-site OAuth callbacks (you don't)
    secure: isProd,
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  ```
  Consider renaming the cookie to `__Host-nu_session` in prod (forces `secure`, `path=/`, no Domain attribute).

### C4 — In-memory store on stateless platform
- **Category:** 12 — Database / persistence
- **Location:** `src/db.ts:14-22`
- **Description:** All users, banks, transactions, mortgages and dedup fingerprints live in a JS object. On Vercel:
  1. Each lambda invocation may hit a **different cold instance** with empty store — user sees no banks, then sees them again.
  2. After ~15 min of idle, instances die; **all data is lost**.
  3. Two concurrent imports racing the `fingerprints` Set will both succeed → duplicate rows.
  4. There is no audit log, no encryption at rest, no backup.
  5. `ensureSeeded()` runs on every cold start with the hardcoded seed user — overwriting any "real" users that existed in another instance? No, but it does mean the `koduvanica/koduvanica` admin credentials live forever.
- **Fix:** Migrate to Postgres (Neon, since the project comment in CLAUDE.md mentions it). Use Prisma or Drizzle. Add unique constraints (`User.email`, composite `(bankId, fingerprint)`). Wrap mortgage/bank mutations in transactions. Encrypt PII columns at rest (or rely on Neon's encryption). For seeding, replace with an explicit `npm run create-admin` script that prompts.

### C5 — No rate limiting anywhere
- **Category:** 11 — Rate limiting
- **Location:** All routes; especially `src/routes/auth.ts:10`, `src/routes/inbound.ts:142`, `src/lib/password.ts` (PBKDF2 600k).
- **Description:**
  - Login: unlimited POST attempts → online password brute-force. Combined with the easy seed password (`koduvanica/koduvanica`), takeover is trivial today.
  - Webhook: unlimited POST → token enumeration (only 31⁶ ≈ 887M space, see H1).
  - PBKDF2 cost is 600k iterations — each verify is ~100-300 ms of pure CPU. An attacker hammering `/api/auth/login` doesn't even need to guess passwords; they just **DoS the server** because login is synchronous.
- **Fix:** Add IP-based rate limiting at the Hono layer. Use `hono-rate-limiter` (in-memory for dev, Upstash/Redis for Vercel since lambdas are stateless) or Vercel's edge middleware. Suggested limits:
  - `POST /api/auth/login`: 5 attempts per IP per 15 min, plus per-username lockout.
  - `POST /api/inbound/email`: 60 per IP per minute (Resend retries).
  - Global: 200 req/min/IP burst.

  Also, return constant-time on login (do `verifyPassword` even on unknown email — see H6).

---

## 4. Findings — HIGH

### H1 — Inbound token is short and from a 31-char alphabet
- **Category:** 5 — Webhook security
- **Location:** `src/db.ts:87-94`
- **Description:** `generateToken()` produces 6 chars from a 31-letter base32-ish alphabet → log₂(31⁶) ≈ 29.7 bits of entropy. Combined with no rate limit on the webhook (C5), an attacker can enumerate by sending crafted `to:` addresses (`anyslug-aaaaaa@inbox`, `anyslug-aaaaab@inbox`...) and observe which produce a 200 response with non-skipped result. With a real bank statement attached, they inject fake transactions into the matched user.
- **Fix:** 12 chars → ~59 bits, still URL-friendly: `crypto.getRandomValues(new Uint8Array(12))`. Don't reveal in the response which email matched a known token (return the same opaque 200 for all cases — currently you do, good — but also add per-IP rate limit).

### H2 — `parseInt(fp.slice(0, idx), 10)` is unauthenticated cross-tenant key
- **Category:** 2 — Authorization & multi-user isolation
- **Location:** `src/db.ts:194` and `:222-226`
- **Description:** Fingerprints are stored in a single global `Set<string>` keyed by `${bankId}::${fingerprint}`. `bankId` is a plain integer auto-increment shared across users. So if user A imports a transaction with fingerprint `2024-01-15|10.00|coffee` to bank ID 17, and user B's bank has the same ID 17 in another instance (or with the same shape), or B happens to get bank ID `17` after a re-seed, **B's identical transaction is treated as a duplicate** and silently dropped. Worse, `deleteAllTransactions` walks the global set and strips by `bankId` — there's no user check. If two users somehow shared a `bankId` (e.g. import bug, race, or concurrent seed), one wipe deletes both users' fingerprints.
- **Fix:** Move fingerprints into a per-user table (DB) and key by `(userId, bankId, fingerprint)`. Verify `bankId` belongs to the user before any insert (already done in routes; but the dedup layer should also check).

### H3 — `recipient` token does not require a slug match
- **Category:** 5 — Webhook security
- **Location:** `src/routes/inbound.ts:107-125`, `src/db.ts:74-78`
- **Description:** The recipient parser splits the local-part by the *last* `-` and uses the suffix as the token, ignoring the slug entirely. So `evilslug-XXXXXX@domain` matches user with token `XXXXXX` regardless of who owned slug. The slug field exists but is never validated. This makes token enumeration easier — an attacker just spams random slugs with crafted tokens.
- **Fix:** Require the local-part to match `${user.inboundSlug}-${user.inboundToken}` exactly:
  ```ts
  const local = addr.split('@')[0]
  const idx = local.lastIndexOf('-')
  const slug = local.slice(0, idx)
  const token = local.slice(idx + 1)
  const user = findUserByInboundToken(token)
  if (!user || user.inboundSlug !== slug) return null
  ```
  Or just embed the user ID and an HMAC tag in the token.

### H4 — Webhook lacks replay protection (timestamp not validated)
- **Category:** 5 — Webhook security
- **Location:** `src/routes/inbound.ts:50-85`
- **Description:** The HMAC check uses `id.timestamp.body` (per Svix spec — fine), but the `ts` value is never verified against the current time. A captured signed payload can be replayed forever. Combined with the fingerprint logic, a replayed payload that creates new transactions with different "now" dates would dedupe — but the *first* replay after a wipe re-imports everything. Worse, a captured webhook with a malicious PDF can be replayed any time after the secret rotates *until* the secret is fully cycled out.
- **Fix:** Reject if `Math.abs(Date.now()/1000 - parseInt(ts)) > 300` (5 min tolerance, matches Svix recommendation).

### H5 — `console.log` in inbound logs sender email + subject
- **Category:** 6 — Data exposure / 13 — Privacy
- **Location:** `src/routes/inbound.ts:259-263`
- **Description:** Logs the sender's email address, subject line, and per-import counts. On Vercel these go into observability that may be retained 30+ days, indexed, and accessible to anyone with project read. Subjects from banks often contain partial account info (`Výpis z účtu SK01...`). PDF parser errors logged at line 203 may include extracted text fragments.
- **Fix:** Hash or redact email (`hashEmail(addr)` truncated to 8 chars). Drop subject from logs in prod or replace with bool `hasAttachments`. Wrap parser errors so PII doesn't end up in stderr.

### H6 — Login returns different timing on unknown vs known email
- **Category:** 1 — Authentication & session
- **Location:** `src/routes/auth.ts:24-31`
- **Description:** When `findUserByEmail` returns `undefined`, the function short-circuits without calling `verifyPassword`. PBKDF2 takes ~100-300 ms; the early return is sub-millisecond. An attacker can enumerate valid emails by measuring response time. With single-user app this is moot, but the moment registration is opened it becomes a user enumeration oracle.
- **Fix:** Always run `verifyPassword` against a constant dummy hash if the user is missing:
  ```ts
  const DUMMY_HASH = /* precompute once at boot */
  const DUMMY_SALT = /* */
  if (!user) {
    await verifyPassword(password, DUMMY_SALT, DUMMY_HASH)
    return c.json({ ok: false, error: 'Nesprávne prihlasovacie údaje' }, 401)
  }
  ```

### H7 — No logout token revocation; JWT lives 24 h regardless
- **Category:** 1 — Authentication & session
- **Location:** `src/routes/auth.ts:45-48`, `src/lib/jwt.ts`
- **Description:** Logout merely calls `deleteCookie`. The signed JWT remains valid for the full 24 h TTL — any attacker who copied the cookie before logout (XSS, malware, network capture during HTTP downgrade) keeps access until expiration. There is no server-side session table, no `jti`, no revocation list.
- **Fix:** Add a `tokenVersion: number` field to User, include it in the JWT payload, increment it on logout-everywhere / password-change. Verify on every auth check. Or move to opaque server-side sessions stored in Postgres with a delete on logout.

### H8 — No login rate limit and no account lockout
- **Category:** 11 — Rate limiting
- **Location:** `src/routes/auth.ts:10`
- **Description:** See C5. Beyond IP-based limiting, there should be a per-account counter that locks an account after N failures. With the seed password `koduvanica`, the *current* deployed app falls in seconds. Even with strong passwords this is a baseline expectation for any internet-facing auth.
- **Fix:** Per-IP token bucket + per-account exponential backoff stored in DB (`User.failedLogins`, `User.lockedUntil`). Reset on success.

### H9 — Bank `currency`, `type`, `name`, `balance` not bounded or sanitized
- **Category:** 3 — Input validation
- **Location:** `src/routes/banks.ts:19-44`, `src/routes/mortgages.ts:21-46`
- **Description:** `name` is `body.name.trim()` with no max length. A malicious user can store a 10 MB string and have it returned in dashboard responses every time. Same for `bank`, `propertyName`, mortgage `bank`. `balance`/`totalAmount`/etc. accept any finite number (including `1e308`, `-1e308`, `Number.MIN_VALUE` like 5e-324 → renders weirdly). For multi-user, an attacker can inflate their dashboard payload to DoS their own admin/audit screen, or store XSS payloads (React escapes — but only render via text, see L4).
- **Fix:** Validate with a schema. Min/max for numeric fields (e.g., balance ∈ [-1e9, 1e9]; `Number.isFinite(x) && Math.abs(x) <= 1e9`). Cap strings at 200 chars. Use `zod` or `valibot` per route:
  ```ts
  const BankSchema = z.object({
    name: z.string().trim().min(1).max(80),
    type: z.string().trim().max(40).optional(),
    balance: z.number().finite().min(-1e9).max(1e9).optional(),
    currency: z.enum(['EUR','USD','CZK','GBP']).optional(),
    source: z.enum(['slsp','tatra','revolut','manual']).optional(),
  })
  ```

---

## 5. Findings — MEDIUM

### M1 — Body parsers (CSV/PDF) accept unbounded input
- **Category:** 3 — Input validation / 4 — File upload safety
- **Location:** `src/routes/imports.ts:23-101`, `:105-183`, `src/routes/inbound.ts:142`
- **Description:** `await c.req.json()` and `await c.req.text()` will accept whatever Hono/Vercel allows by default (often 4 MB on Vercel, but configurable up to 50 MB). PDF text extraction allocates memory proportional to file size; PapaParse on a 4 MB CSV with single-character lines = many rows = many transactions inserted (we hold a global Set that grows unbounded).
- **Fix:**
  ```ts
  const len = Number(c.req.header('content-length') || 0)
  if (len > 5 * 1024 * 1024) return c.json({ ok: false, error: 'Súbor je príliš veľký (max 5 MB)' }, 413)
  ```
  Also bound `parsed.data.length` to e.g. 10000 rows before iteration; bound PDF page count to 100.

### M2 — Inbound webhook auto-creates banks per source
- **Category:** 2 — Authorization
- **Location:** `src/routes/inbound.ts:222-229`
- **Description:** A spoofed/forged email (in dev mode where signing is bypassed) or one with a guessed token can cause the server to spawn arbitrary bank rows in a victim's account, with names from the hardcoded `SOURCE_LABEL` map. Less harmful than transaction injection but pollutes the user's dashboard.
- **Fix:** Don't auto-create. Reject with a clear error if no bank with matching source exists, and require user to set up the bank first.

### M3 — `findUserByEmail` is case-insensitive but storage is case-sensitive
- **Category:** 2 — Authorization
- **Location:** `src/db.ts:66-68`
- **Description:** Lookup uses `.toLowerCase()` comparison, but inserts use the original casing (`koduvanica` is fine, but a registration flow would let `Foo@x.com` and `foo@x.com` collide on lookup yet store as different rows). With migration to Postgres add a unique constraint on `LOWER(email)` and store normalized.
- **Fix:** Normalize emails to lowercase on insert; add `CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email))`.

### M4 — No email verification path
- **Category:** 1 — Authentication
- **Location:** Whole auth module
- **Description:** Once registration opens, anyone can register with any email and immediately use it. The inbound system uses email-derived tokens and trusts the recipient. If an attacker registers with `victim@gmail.com`, they get an inbound email address that captures forwarded bank statements if the victim mistakenly forwards to a similar address.
- **Fix:** Implement email verification before activating an account (Resend confirmation link, expires in 1h). Block login until verified.

### M5 — No password reset flow
- **Category:** 1 — Authentication
- **Description:** None exists. Single-user is fine, but pre-launch this needs adding (signed token, 30-min expiry, single-use, invalidates all existing sessions).
- **Fix:** Add `POST /api/auth/forgot` (rate-limited; always returns 200), `POST /api/auth/reset` (consumes token). Don't reveal whether email exists.

### M6 — No password strength validation
- **Category:** 1 — Authentication
- **Location:** `src/routes/auth.ts:18-22`
- **Description:** Login accepts any non-empty password. There is no register endpoint right now, but when added there must be a minimum strength check (length ≥ 12, not in common-passwords list).
- **Fix:** When opening registration, integrate `zxcvbn` (low score → reject) or at least enforce length ≥ 12 + not in top-1000 list.

### M7 — Trust boundary: PDF text from inbound webhook is treated as trusted parser input
- **Category:** 4 — File upload safety
- **Location:** `src/routes/inbound.ts:201` and parsers in `src/lib/pdf-parsers.ts`
- **Description:** Anyone with a known token can mail an arbitrary PDF; the parser regex-walks the text and inserts the resulting "transactions" with no anomaly detection. So an attacker who knows a victim's token can fabricate convincing fake transactions (e.g., "PAYMENT TO ATTACKER -10000") visible on the victim's dashboard.
- **Fix:** Beyond fixing #C2 (mandatory webhook signing) and #H1 (longer token), add per-row sanity checks: reject amounts > 1e6, descriptions > 200 chars; throttle inbound creates to N per user per hour; mark inbound-imported transactions as "unverified" until the user confirms.

### M8 — `process.env` lookup pattern is awkward and prone to typos
- **Category:** 10 — Secrets management
- **Location:** `src/routes/inbound.ts:32-33`, `src/routes/user.ts:10-12`
- **Description:** `(globalThis as { process?: { env?: ... } }).process?.env ?? {}` — defensive against environments that don't have `process` (e.g., Cloudflare Workers). On Vercel/Node it's fine, but a typo in the env name silently falls through to the default. There's no central env validator.
- **Fix:** Add a `src/env.ts` module that fails fast on import:
  ```ts
  function required(key: string) {
    const v = process.env[key]
    if (!v) throw new Error(`${key} is required`)
    return v
  }
  export const env = {
    JWT_SECRET: required('JWT_SECRET'),
    INBOUND_WEBHOOK_SECRET: process.env.NODE_ENV === 'production' ? required('INBOUND_WEBHOOK_SECRET') : process.env.INBOUND_WEBHOOK_SECRET,
    INBOUND_DOMAIN: process.env.INBOUND_DOMAIN || 'inbox.local',
  }
  ```

### M9 — No CORS policy, depends on Vite dev defaults
- **Category:** 9 — CORS
- **Location:** `src/index.ts` (no CORS middleware), `frontend/utils/api.ts:13` (`credentials: 'include'`)
- **Description:** Hono mounted in Vite dev server has no CORS headers. Same-origin so OK in dev. On Vercel, requests come same-origin too, so technically still fine. But if the site is ever reachable on `app.example.com` and `api.example.com` (split deploy), or someone reverse-proxies it, the lack of explicit CORS will at best break things and at worst allow an arbitrary origin to call the API.
- **Fix:** Explicit CORS even when same-origin:
  ```ts
  import { cors } from 'hono/cors'
  app.use('/api/*', cors({
    origin: process.env.PUBLIC_ORIGIN || 'http://localhost:8787',
    credentials: true,
    allowMethods: ['GET','POST','PATCH','DELETE'],
  }))
  ```

### M10 — No security response headers
- **Category:** 14 — Frontend hardening
- **Location:** `vite.config.ts`, `index.html`, server responses
- **Description:** No CSP, no HSTS, no `X-Content-Type-Options`, no `Referrer-Policy`, no `Permissions-Policy`. Vercel sets some defaults but they are not strict enough for an app handling financial PDFs.
- **Fix:** Add `vercel.json` with response headers:
  ```json
  {
    "headers": [{
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" }
      ]
    }]
  }
  ```

### M11 — Catch-all `app.onError` returns generic 500 — but error is `console.error`'d with full stack
- **Category:** 6 — Data exposure
- **Location:** `src/index.ts:179-182`
- **Description:** Good: response is generic. Bad: stack traces hit logs that may be world-readable in misconfigured Vercel projects, and may include user input (if a parser threw with a string parameter). Lower risk than #H5 but worth noting.
- **Fix:** In production, log only `err.name + err.message` (or a hashed correlation ID) and store full stack to a separate error tracker (Sentry).

---

## 6. Findings — LOW

### L1 — `fingerprints` Set grows unboundedly per process
- **Category:** 12 — Persistence
- **Location:** `src/db.ts:20`
- **Description:** Even on a single long-running instance, the `Set<string>` accumulates one entry per imported transaction forever. For 10k transactions = ~10k * ~80 bytes = 800 KB; for 1M transactions ≈ 80 MB. Not catastrophic but an ever-growing leak.
- **Fix:** Solved by Postgres migration; per-user table with index.

### L2 — `Number.isFinite(NaN)` allows weird amounts to slip through banks endpoint
- **Category:** 3 — Input validation
- **Location:** `src/routes/banks.ts:39`
- **Description:** `typeof body.balance === 'number' ? body.balance : 0` — `NaN` is a number, so `NaN` slips through. `Infinity` does too.
- **Fix:** `Number.isFinite(body.balance) ? body.balance : 0`.

### L3 — `String(row[k] ?? '')` in CSV parser may stringify large objects
- **Category:** 3 — Input validation
- **Location:** `src/lib/csv-parsers.ts:27`
- **Description:** PapaParse with `header: true` produces strings, so this is fine in practice. But `String({})` would produce `"[object Object]"`. Defensive coding catch.
- **Fix:** `typeof row[k] === 'string' ? row[k] : String(row[k] ?? '')` and reject if not a string.

### L4 — User-supplied `note` rendered without escaping
- **Category:** 8 — XSS
- **Location:** `frontend/pages/Dashboard.tsx:315`, `frontend/pages/TransactionsPage.tsx:275`
- **Description:** React's default JSX escaping handles `<`, `>`, `"`, `&`. There's no `dangerouslySetInnerHTML` anywhere. Confirmed safe.
- **Fix:** Just keep the rule "never bypass JSX text escaping for user data". Add a lint rule (`react/no-danger`).

### L5 — Inbound widget renders `data.address` and `data.token` to UI
- **Category:** 8 — XSS / 6 — Exposure
- **Location:** `frontend/components/ui/InboundEmailWidget.tsx:143, 208`
- **Description:** `data.address` is server-controlled (constructed from slug + token + domain). Slug is `[a-z0-9-]` only (`makeSlug`), token is from a fixed alphabet. Safe but tightly coupled — any future change that lets a custom string into `slug` would XSS via `select-all`.
- **Fix:** Add a runtime regex check on `slug` and `token` before render.

### L6 — `pdfjs-dist` is large attack surface; `isEvalSupported: false` is set but `useSystemFonts: true`
- **Category:** 4 — File upload safety
- **Location:** `src/lib/pdf-extract.ts:31-37`, `frontend/utils/pdf.ts:19`
- **Description:** Frontend pdfjs ships with worker code. PDF.js has had multiple historical CVEs (CVE-2024-4367 — JS exec via crafted PDF). Currently pinned to `^5.7.284` which should be patched, but worth pinning exact and watching.
- **Fix:** Pin exact version (`"pdfjs-dist": "5.7.284"`), set up `npm audit` in CI, add `disableAutoFetch: true` and `disableStream: true` (defense against weird URLs in PDFs).

### L7 — `mortgages.ts` DELETE has no soft-delete / no audit
- **Category:** 12 — Persistence
- **Location:** `src/routes/mortgages.ts:92-99`
- **Description:** Hard delete with no log. If a user fat-fingers, they lose data. Multi-user expectation: at least an audit row.
- **Fix:** With Postgres migration, add `deletedAt` column instead of physical delete. Optionally, ledger table that records who deleted what.

---

## 7. Findings — INFO (defense-in-depth, not bugs)

### I1 — PBKDF2 600k SHA-256 is OK, but Argon2id is better
- **Location:** `src/lib/password.ts:1`
- **Note:** OWASP recommends ≥ 600k SHA-256 PBKDF2; you're at the floor. Argon2id (memory-hard) is preferred when you can run native code. PBKDF2-via-WebCrypto is portable. Acceptable for now.

### I2 — Constant-time compare in password verify uses string char-codes
- **Location:** `src/lib/password.ts:54-59`
- **Note:** This works because both strings are hex of fixed length and same charset, so character-code XOR is well-defined. Idiomatic but worth a comment.

### I3 — Frontend stores no tokens in `localStorage`
- **Location:** `frontend/hooks/useTheme.ts:25`
- **Note:** Only `nu_theme` ('dark' | 'light') in localStorage. Auth state is solely in the httpOnly cookie. Confirmed clean.

### I4 — `react-router-dom` v6 used; routes don't expose user IDs
- **Note:** All routes are static (`/dashboard`, `/banky` etc.). No tenant in URL. Multi-user-safe by design.

### I5 — `package.json` dependencies look current and maintained
- **Note:** Hono 4.x, Jose 5.x, React 18.x, pdfjs 5.x — all actively maintained. No deprecated packages.
  - **Action item:** Set up Dependabot / Renovate before launch. Run `npm audit --omit=dev` weekly.

---

## 8. Defense-in-depth recommendations

These aren't blockers, but worth picking up incrementally as the app matures.

1. **Centralize config validation.** A single `env.ts` that fails to import unless required vars are set (see M8). Run it from `src/index.ts` so a missing prod var crashes at boot, not at first request.
2. **Add structured logging with PII redaction.** Use `pino` with a custom serializer; auto-redact email addresses, IBANs (`SK\d{22}`), large strings.
3. **Use `zod` (or `valibot`) schemas at every API entry.** Replace the manual `typeof === 'string'` chains. Tighter, less boilerplate, free coercion.
4. **Add a `vercel.json` with strict response headers** (HSTS, CSP, Referrer-Policy, etc. — see M10).
5. **Set up Sentry** (or BetterStack/Honeybadger) for error monitoring instead of relying on `console.error`.
6. **Encrypt PII at rest beyond what Neon provides.** Bank statement descriptions can contain very personal info (names, places, amounts to specific recipients). Consider envelope encryption per-user with a key derived from their password — at minimum, column-level encryption for `Transaction.note` using a server-held key.
7. **Privacy: GDPR data export & delete.** Provide `GET /api/user/export` (downloads JSON of everything) and `DELETE /api/user` (hard delete). Required by EU law for personal data.
8. **Add a CSP nonce** to `index.html` so any future inline script needs whitelisting.
9. **Subresource Integrity for CDN fonts.** No external fonts are loaded right now (clean), but if you add Google Fonts later, use `integrity="..."` + `crossorigin="anonymous"`.
10. **Audit log table** (`AuditEvent`: userId, action, resourceType, resourceId, ip, ts). Write on login/logout, transaction wipe, mortgage create/delete, inbound import, token regenerate. Crucial for incident investigation in a financial app.
11. **2FA (TOTP)** is overkill for personal use but cheap to add (`otpauth` lib + qrcode). Strongly suggested before opening to non-trusted users.
12. **HTTP idempotency keys** on import endpoints — prevents the "browser refresh after timeout = double import" footgun.
13. **Honeypot field on login form** + slow-down (CAPTCHA only when an IP exceeds N attempts).
14. **Rotate the inbound token automatically** every N months (or after any failed `unknown-token` events from new IPs).
15. **Webhook deliveries should be idempotent** — Resend retries; current code happily double-imports if one user sees two deliveries with the same `svix-id`. Track seen IDs (DB table, 7-day TTL).

---

## 9. Per-file quick-look (server)

| File | Status | Top issues |
|---|---|---|
| `src/index.ts` | Mostly OK | `requireAuth` correctly applied; numeric query params clamped (good) |
| `src/db.ts` | **Replace with DB layer** | C4, H2, L1 |
| `src/lib/jwt.ts` | **Patch C1 first** | Hardcoded fallback secret |
| `src/lib/password.ts` | OK | I1, I2 — minor |
| `src/middleware/auth.ts` | OK | Clean; only checks cookie, no other surface |
| `src/routes/auth.ts` | **Patch C3, H6, H7, H8** | Cookie flags, timing leak, no revocation, no rate limit |
| `src/routes/banks.ts` | Patch H9, M1 | Auth gate is correct (`use('*', requireAuth)`), input weakly validated |
| `src/routes/imports.ts` | Patch M1, H9 | Bank ownership checked correctly; size/type validation missing |
| `src/routes/mortgages.ts` | Mostly OK | Bank/mortgage isolation correct; H9 input validation |
| `src/routes/inbound.ts` | **Patch C2, H1, H3, H4, H5, M2, M7** | Highest concentration of issues — public endpoint |
| `src/routes/user.ts` | OK | Token regenerate is auth-gated, fine |

---

## 10. Per-file quick-look (frontend)

| File | Status | Notes |
|---|---|---|
| `frontend/utils/api.ts` | OK | Uses cookie auth correctly; no token in localStorage |
| `frontend/utils/pdf.ts` | L6 | pdfjs surface; pin version |
| `frontend/hooks/useAuth.ts` | OK | No PII in client state beyond email |
| `frontend/hooks/useTheme.ts` | OK | Only theme in localStorage |
| `frontend/pages/Login.tsx` | Note | Hardcoded default `koduvanica/koduvanica` form values — remove before deploy |
| `frontend/pages/*.tsx` | OK | All user data rendered as JSX text (escaped). No `dangerouslySetInnerHTML`. No untrusted `href`. |
| `frontend/components/ui/InboundEmailWidget.tsx` | L5 | Renders server-supplied address/token — safe today, brittle |
| `index.html` | M10 | No CSP, no security headers (defer to Vercel) |
| `vite.config.ts` | OK | No prod-relevant config, route exclusion is dev-only |

---

## 11. Closing notes

The app's architecture is clean and the auth choice (httpOnly cookie + jose JWT) is sensible. The ownership model (`userId` on every resource, every route reads `c.get('user').id`) is consistently applied — no IDOR found in the routes I read. Input validation is hand-rolled and covers the basics but has gaps (string lengths, NaN, unbounded body). The two big hazard zones are (1) the inbound webhook (public, weakly authenticated, dev-bypass enabled, short token, unbounded input) and (2) the deployment readiness (in-memory store, hardcoded secret fallback, insecure cookie flag).

Closing the **10 pre-production blockers** above is the minimum bar. Everything else can ship behind feature flags or roll in over the next few weeks.
