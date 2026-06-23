# API Reference

Base URL: `https://nulanaucte.sk/api` (production) or `http://localhost:8787/api` (dev).

All routes return JSON. Authed routes need the `nu_session` cookie (set on `/api/auth/login`). 4xx responses follow `{ ok: false, error: string, code?: string }`.

---

## Auth

### `POST /api/auth/register`
**Public.** Open registration.

Request:
```json
{ "email": "you@example.com", "password": "min12chars1!" }
```
Response 200:
```json
{ "ok": true, "data": { "id": 42 } }
```
On success: verify email sent to `email`. User can't log in until they click the verify link.

Errors: weak password (min 12 chars + digit/symbol), email taken (case-insensitive), rate-limit (5/hour per IP).

### `POST /api/auth/verify`
**Public.** Consume verify token from email link.

Request: `{ "token": "abc...xyz" }` (32 chars)
Response 200: `{ ok: true, data: { verified: true } }`

### `POST /api/auth/login`
**Public.** Returns session cookie on success.

Request:
```json
{ "email": "you@example.com", "password": "..." }
```
Response 200: `{ ok: true, data: { id, email } }` + sets `Set-Cookie: nu_session=...`

Errors: `EMAIL_NOT_VERIFIED` (with `code`), `INVALID_CREDENTIALS`, account locked (after 5 fails), rate-limit.

### `POST /api/auth/logout`
**Public.** Bumps `tokenVersion` → invalidates all sessions for this user. Clears cookie.

### `GET /api/auth/me`
**Authed.** Returns current user profile.

Response:
```json
{
  "ok": true,
  "data": {
    "id": 42, "email": "...", "name": "...",
    "role": "user", "emailVerified": true,
    "reportFrequency": "monthly", "emailNotifications": true
  }
}
```

### `POST /api/auth/forgot`
**Public.** Triggers password-reset email if account exists. Always returns 200 (anti-enumeration).

Request: `{ "email": "..." }`

### `POST /api/auth/reset`
**Public.** Consume reset token + set new password.

Request: `{ "token": "...", "newPassword": "..." }`

---

## User

### `PATCH /api/user/profile`
**Authed.** Update name / report freq / email-notifications.

Request:
```json
{ "name": "Martin", "reportFrequency": "weekly", "emailNotifications": true }
```

### `POST /api/user/change-password`
**Authed.** Requires current password; bumps tokenVersion (logs out all devices).

Request: `{ "currentPassword": "...", "newPassword": "..." }`

### `DELETE /api/user`
**Authed.** Account deletion with cascade. Hard delete.

Request:
```json
{ "confirm": "VYMAZAT", "password": "..." }
```

### `GET /api/user/export`
**Authed.** Returns JSON file with all user data (GDPR portability).

---

## Banks

### `GET /api/banks`
**Authed.** Returns enabled banks with transaction counts.

Query: `?all=1` → include disabled (used by Settings).

Response:
```json
{
  "ok": true,
  "data": [
    { "id": 1, "name": "SLSP", "type": "bezny", "balance": 1234.5,
      "currency": "EUR", "source": "slsp", "enabled": true,
      "transactionCount": 342, "createdAt": "..." }
  ]
}
```

### `POST /api/banks`
**Authed.** Create a custom bank.

Request: `{ "name": "...", "type": "bezny", "currency": "EUR", "source": "manual", "balance": 0 }`

### `GET /api/banks/registry`
**Authed.** Returns the curated SK/EU bank list (15 entries) annotated with user state.

Response:
```json
{
  "ok": true,
  "data": [
    {
      "source": "slsp", "name": "Slovenská sporiteľňa",
      "icon": "⚖", "parserSupport": "auto",
      "category": "classic", "note": "PDF mesačný výpis + CSV export z George",
      "bankId": 1, "enabled": true, "hasAccount": true
    },
    /* ... */
  ]
}
```

### `POST /api/banks/registry/toggle`
**Authed.** Enable/disable a bank from the registry.

Request: `{ "source": "slsp", "enabled": true }`

If `enabled=true` and user doesn't have this source → creates the bank.
If `enabled=false` → soft-disables existing bank (transactions kept).

---

## Transactions

### `GET /api/transactions`
**Authed.** List user's transactions, filterable.

Query:
- `type=vydavok|prijem`
- `month=YYYY-MM`
- `bankId=N`
- `limit=N` (max 2000)

### `DELETE /api/transactions`
**Authed.** Wipe ALL transactions for this user (used in test/reset flows).

Response: `{ ok: true, data: { count: 342 } }`

### `GET /api/months`
**Authed.** List of months (sorted desc) where the user has at least one transaction.

Response: `{ ok: true, data: ["2026-05", "2026-04", "2026-03"] }`

---

## Imports

All import endpoints accept text bodies (`csv: string` or `text: string` for PDF-extracted text), not multipart uploads. Client extracts PDF→text via `pdfjs-dist` in the browser, then POSTs the text.

### `POST /api/imports/csv/preview`
**Authed.** Parse + return preview without writing to DB.

Request:
```json
{ "bankId": 1, "csv": "...", "source": "slsp" }
```
Response:
```json
{
  "ok": true,
  "data": {
    "kind": "csv",
    "detectedFormat": "slsp",
    "usedFormat": "slsp",
    "total": 87,
    "preview": [{ "date": "2026-04-01", "amount": -12.34, "description": "...", "fingerprint": "..." }],
    "errors": []
  }
}
```

### `POST /api/imports/csv`
**Authed.** Commit (deduplicates, inserts).

Response: `{ ok: true, data: { kind, usedFormat, total, imported, duplicates, errors } }`

### `POST /api/imports/pdf/preview` and `POST /api/imports/pdf`
Same shape as CSV but with `text` field instead of `csv`.

---

## Categories (per-type registry)

### `GET /api/categories?type=vydavok`
**Authed.** Returns merged dropdown source.

Response:
```json
{
  "ok": true,
  "data": {
    "type": "vydavok",
    "categories": ["Potraviny", "Reštaurácie", "Káva", ...],
    "registry": [{ "id": 1, "name": "Vlastná", "type": "vydavok", "archived": false, "createdAt": "..." }],
    "starters": ["Potraviny", "Reštaurácie", "Káva", /* 37 total */]
  }
}
```

### `POST /api/categories`
**Authed.** Add custom category (or reactivate archived).

Request: `{ "name": "Káva", "type": "vydavok" }`

### `PATCH /api/categories/:id`
**Authed.** Archive / restore.

Request: `{ "archived": true }`

---

## AI

All AI routes are split across three rate-limit buckets per user:
- `ai-read` (300/h): GET endpoints
- `ai-edit` (200/h): PATCH category
- `ai-expensive` (20/h): POST that calls OpenAI

### `GET /api/ai/categories`
**Authed.** Legacy mixed (vydavok + prijem) category list. Newer code should use `/api/categories?type=...`.

### `POST /api/ai/categorize`
**Authed, expensive.** Run AI categorisation.

Request: `{ "force": false }` (optional; `true` = re-categorise everything except user-locked)

Response:
```json
{
  "ok": true,
  "data": {
    "processed": 87,
    "updated": 87,
    "ruleHits": 23,
    "usedAI": true,
    "tokens": 4523,
    "mode": "uncategorized"
  }
}
```

Flow: apply merchant rules first → AI categorises remainder → high-confidence AI categorizations get saved as new rules for future imports.

### `PATCH /api/ai/transactions/:id/category`
**Authed, edit.** Manual category override. Also saves a 'user'-sourced merchant rule.

Request: `{ "category": "Potraviny" }`

### `GET /api/ai/recommendations?month=YYYY-MM`
**Authed, read.** Returns cached Raul recommendation if exists.

Response: `{ ok: true, data: { period, recommendation: { content, createdAt } | null } }`

### `POST /api/ai/recommendations`
**Authed, expensive.** Generate new (long-form Raul rec + 12 short Clippy tips as side-effect).

Request: `{ "month": "2026-04" }` (optional, defaults to current)

Response:
```json
{
  "ok": true,
  "data": {
    "period": "2026-04",
    "content": "**Raul si pozrel Apríl 2026**...",
    "usedAI": true,
    "fallbackReason": null,
    "clippyTips": 12,
    "clippyUsedAi": true,
    "clippyFallbackReason": null
  }
}
```

`fallbackReason` is one of `null | 'no-key' | 'api-error' | 'empty-response'`. Stub responses are NEVER cached.

### `GET /api/ai/clippy-tips?month=YYYY-MM`
**Authed, read.** Returns cached short tips for the floating mascot.

Auto-backfill: if no tips cached anywhere but a Raul rec exists, generates once.

Response: `{ ok: true, data: { period: string | null, tips: string[] } }`

---

## Mortgages

Standard CRUD: `GET /api/mortgages`, `POST /api/mortgages`, `PATCH /api/mortgages/:id`, `DELETE /api/mortgages/:id`.

---

## Dashboard

### `GET /api/dashboard/summary?month=YYYY-MM`
**Authed.** Snapshot of finances for one month.

Smart fallback: if requested month has no data, server uses most recent month that does. Frontend reads `data.month` to sync MonthPicker.

Response (truncated):
```json
{
  "ok": true,
  "data": {
    "month": "2026-04",
    "months": ["2026-05", "2026-04", "2026-03"],
    "zostatok": 0,
    "prijmy": 2340,
    "vydavky": 1875,
    "uveryTotal": 524,
    "hypoteky": 380,
    "konfigSplatky": 400,
    "splatky": 524,
    "net": 465,
    "recent": [/* 10 most recent txs */],
    "counts": { "banks": 3, "transactionsTotal": 412, "transactionsMonth": 87, "mortgages": 1 }
  }
}
```

### `GET /api/dashboard/trend?months=6`
**Authed.** Income vs expense per month for last N months.

### `GET /api/dashboard/categories?month=YYYY-MM`
**Authed.** Categories with totals for one month.

Response:
```json
{
  "ok": true,
  "data": {
    "month": "2026-04",
    "vydavky": [{ "category": "Potraviny", "total": 421, "count": 12 }, /* ... */],
    "prijmy": [/* ... */]
  }
}
```

### `GET /api/dashboard/category-trend?months=6`
**Authed.** Stacked spend per category × month (top 6 + 'Iné' bucket).

---

## Feedback

### `POST /api/feedback`
**Authed, rate-limited 5/h.** Send bug/idea/other to maintainer email.

Request:
```json
{ "kind": "bug" | "idea" | "other", "subject": "...", "message": "..." }
```

---

## Reports (cron)

### `POST /api/reports/run/weekly` and `POST /api/reports/run/monthly`
**Auth via `x-vercel-cron: 1` header OR `?secret=CRON_SECRET` query.**

Iterates all users with matching `reportFrequency`, builds report data, sends email via Resend. Idempotent: running twice in a day just re-sends same content.

---

## Admin

### `GET /api/admin/stats`
**Authed + role=admin.** Aggregated counts only. No financial data.

Response:
```json
{
  "ok": true,
  "data": {
    "totalUsers": 12, "verifiedUsers": 10, "unverifiedUsers": 2, "lockedUsers": 0,
    "totalBanks": 27, "totalTransactions": 8420, "totalMortgages": 4,
    "recentSignups": [{ "id": 12, "email": "...", "emailVerified": true, "createdAt": "..." }]
  }
}
```

---

## Error shapes

```json
{ "ok": false, "error": "Human-readable message" }
```

With optional `code` for typed handling:

| `code` | Meaning |
|---|---|
| `EMAIL_NOT_VERIFIED` | Login attempted on unverified account |
| `RATE_LIMIT_READ` / `RATE_LIMIT_EDIT` / `RATE_LIMIT_AI` | Bucket exceeded |
| (none) | Generic — render the `error` text |

HTTP status codes: 400 (bad request), 401 (unauth), 403 (forbidden), 404 (not found), 429 (rate limit), 500 (server), 502 (upstream like OpenAI/Resend).
