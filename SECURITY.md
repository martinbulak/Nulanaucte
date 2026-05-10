# Bezpečnosť — "Nula na účte"

Stručný stav po prvom security pass. Plný report: [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).

## Stav audit findingov

| ID | Severita | Popis | Stav |
|---|---|---|---|
| C1 | CRITICAL | Hardcoded JWT secret fallback | ✅ FIXED — `src/env.ts` fail-fast v prod, dev má random per-process secret |
| C2 | CRITICAL | Webhook signature bypass keď secret unset | ✅ FIXED — `INBOUND_WEBHOOK_SECRET` required v prod, dev warne |
| C3 | CRITICAL | Insecure cookie flags | ✅ FIXED — `secure: env.isProd`, `sameSite: 'Strict'` |
| C4 | CRITICAL | In-memory store nepoužiteľný na Vercel | ⚠ ZOSTÁVA — vyžaduje DB migráciu (Neon/Postgres) |
| C5 | CRITICAL | Žiadny rate limiting | ✅ FIXED (čiastočne) — in-memory token bucket per IP. Pre serverless treba Upstash Redis |
| H1 | HIGH | Krátky inbound token (6 znakov) | ✅ FIXED — 12 znakov (~59 bitov entropie) |
| H2 | HIGH | Cross-tenant fingerprint key | ⚠ ZOSTÁVA — vyrieši DB migrácia (per-user table) |
| H3 | HIGH | Webhook ignoruje slug | ✅ FIXED — slug + token musia oba sedieť |
| H4 | HIGH | Webhook bez replay protection | ✅ FIXED — timestamp window 5 min (Svix doporučenie) |
| H5 | HIGH | PII v logoch (email, subject) | ✅ FIXED — redactEmail, žiadny subject log |
| H6 | HIGH | Login timing leak | ✅ FIXED — dummy PBKDF2 verify pri unknown email |
| H7 | HIGH | Logout nezruší JWT | ✅ FIXED — `tokenVersion` v JWT, bumpne pri logout |
| H8 | HIGH | Žiadny account lockout | ✅ FIXED — 5 fails → 15 min lock + per-IP rate limit |
| H9 | HIGH | Bank/mortgage inputs bez bounds | ✅ FIXED — string max length, numeric ranges, NaN guards |
| M1 | MEDIUM | Unbounded body sizes | ✅ FIXED — `bodyLimit` middleware (5–10 MB) |
| M2 | MEDIUM | Webhook auto-creates banks | ✅ FIXED — vyžaduje existujúcu banku |
| M3 | MEDIUM | Email case-sensitivity | ⚠ ZOSTÁVA — vyrieši DB (UNIQUE INDEX on `LOWER(email)`) |
| M4 | MEDIUM | Žiadne email verification | ⚠ ZOSTÁVA — implementuje sa s registráciou |
| M5 | MEDIUM | Žiadny password reset flow | ⚠ ZOSTÁVA — implementuje sa s registráciou |
| M6 | MEDIUM | Žiadna password strength | ⚠ ZOSTÁVA — implementuje sa s registráciou |
| M7 | MEDIUM | Webhook trustuje PDF content | ✅ FIXED (čiastočne) — sanity bounds na sumy/popis, max 5000 rows |
| M8 | MEDIUM | env vars patternu chýba validácia | ✅ FIXED — `src/env.ts` |
| M9 | MEDIUM | Žiadna CORS policy | ✅ FIXED — explicit `cors()` middleware |
| M10 | MEDIUM | Žiadne security response headers | ✅ FIXED — `vercel.json` (HSTS, CSP, X-Frame, Referrer-Policy, ...) |
| M11 | MEDIUM | Stack traces v logoch | ✅ FIXED — v prod len name+message + correlation ID |
| L1 | LOW | Fingerprints Set rastie nekonečne | ⚠ ZOSTÁVA — vyrieši DB |
| L2 | LOW | NaN/Infinity v balance | ✅ FIXED — `Number.isFinite` všade |
| L3 | LOW | CSV parser stringification | ✅ NO ACTION — PapaParse vracia stringy, defenzívny check existuje |
| L4 | LOW | XSS v note rendering | ✅ NO ACTION — JSX escape je dostatočné |
| L5 | LOW | InboundWidget renders server data | ✅ FIXED — runtime regex check pred renderom |
| L6 | LOW | pdfjs-dist veľký surface | ⚠ ZOSTÁVA — verzia exact-pinning + `npm audit` v CI |
| L7 | LOW | Hard delete bez audit logu | ⚠ ZOSTÁVA — vyrieši DB (`deletedAt` column) |
| I1 | INFO | PBKDF2 vs Argon2id | ✅ NO ACTION — PBKDF2 600k stačí |
| I2-I5 | INFO | Drobné defensive notes | ✅ NO ACTION |

## Zostávajúce blokátory pred public launchem

✅ Postgres migrácia (Neon + Drizzle) — appka je Vercel-ready
✅ Open registrácia + email verify + password reset (Resend)
✅ Password strength (≥12 chars + číslica/symbol)
✅ GDPR data export (`GET /api/user/export`) + account delete s cascade
✅ Account lockout + per-IP login rate limit

Zostáva (nice-to-have, nie blokátory):

1. **Upstash Redis pre rate limit** — aktuálny in-memory bucket sa neudrží cez Vercel lambda instances.
   Pre osobné použitie (≤100 userov) je in-memory OK. Pre rast → swap implementáciu.
2. **Audit log table** — `audit_events(userId, action, ip, ts)`. Krucial pre incident response.
3. **Sentry / BetterStack** — namiesto `console.error`. Aktuálne errory ostanú vo Vercel function logoch.
4. **2FA (TOTP)** — pridať pred zveröjnením širokej verejnosti.
5. **Webhook idempotency cache** — Resend retries môže duplikovať. Aktuálne dedup chytí cez fingerprint, ale storage každého importu by bol cleaner.

## Defense-in-depth (nice to have, nie blocker)

- Sentry / error tracker (namiesto `console.error`)
- 2FA (TOTP)
- Webhook idempotency cache (Resend retries)
- Honeypot field na login forme
- Subresource Integrity pre Google Fonts (ak ostanú)
- Per-user encryption envelope pre `Transaction.note` (banking-grade paranoia)
- Dependabot / Renovate v CI

## Required env vars (deploy)

Pozri [`.env.example`](./.env.example):

| Var | Required | Default (dev) | Účel |
|---|---|---|---|
| `JWT_SECRET` | **PROD** | random/process | HMAC pre session JWT, ≥32 chars |
| `INBOUND_WEBHOOK_SECRET` | **PROD** | unset (warned) | Resend HMAC signing secret |
| `INBOUND_DOMAIN` | optional | `inbox.local` | Doména pre per-user inbound adresy |
| `PUBLIC_ORIGIN` | optional | `http://localhost:8787` | CORS allow-list |
| `NODE_ENV` | optional | `development` | Toggling production-only checks |

## Lokálne spustenie

```bash
npm install
npm run dev    # Vite dev na http://localhost:8787 (žiadny env nie je povinný)
```

## Build & deploy (Vercel)

```bash
npm run build  # tsc -b && vite build
# Push do gitu, Vercel deployne automaticky.
# Najprv nastav env vars vo Vercel dashboarde podľa .env.example.
```
