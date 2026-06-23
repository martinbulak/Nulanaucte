# Database

Postgres (Neon serverless), Drizzle ORM. Schema lives in [`src/schema.ts`](../src/schema.ts).

---

## Migration approach

Two paths exist; we use the second for production:

### A) Drizzle Kit (versioned files)
```bash
npx drizzle-kit generate   # diff schema → SQL file in drizzle/
npx drizzle-kit push       # apply to DB
```
Used in early dev. Files in `drizzle/` are committed but **not applied at runtime**.

### B) In-app idempotent DDL (current)
`ensureSeeded()` in `src/db.ts` runs on every cold-start (memoised per process). It contains:
- `CREATE TABLE IF NOT EXISTS` for tables added after the initial Drizzle push (`merchant_rules`, `clippy_tips`, `category_registry`)
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS` for columns added later (`transactions.merchant`, `banks.enabled`)
- `CREATE INDEX IF NOT EXISTS` for indexes that aren't auto-managed

**Benefit:** push to main → deploy auto-applies migrations on first request. No separate migration step.
**Caveat:** large schema changes (renames, type changes, constraint additions) should still go through Drizzle Kit + manual review.

---

## Tables

### `users`
Auth root + profile.

```sql
id              SERIAL PRIMARY KEY
email           TEXT NOT NULL                      -- unique case-insensitive
password_hash   TEXT NOT NULL                      -- PBKDF2 600k hex
salt            TEXT NOT NULL                      -- 32-byte random hex
name            TEXT
role            TEXT NOT NULL DEFAULT 'user'       -- 'user' | 'admin'
email_verified  BOOLEAN NOT NULL DEFAULT FALSE
report_frequency TEXT NOT NULL DEFAULT 'monthly'   -- 'weekly' | 'monthly' | 'off'
email_notifications BOOLEAN NOT NULL DEFAULT TRUE
inbound_token   TEXT NOT NULL                      -- for legacy email-import (unused)
inbound_slug    TEXT NOT NULL
token_version   INTEGER NOT NULL DEFAULT 0         -- bumped on logout/passwd change
failed_logins   INTEGER NOT NULL DEFAULT 0
locked_until    BIGINT                             -- epoch ms; NULL = unlocked
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

UNIQUE INDEX users_email_lower_uq ON LOWER(email)  -- case-insensitive uniqueness
UNIQUE INDEX users_inbound_token_uq ON inbound_token
```

### `user_tokens`
One-shot tokens for email verification + password reset. Token stored as SHA-256 hash (DB leak → no usable tokens).

```sql
id            SERIAL PRIMARY KEY
user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
kind          TEXT NOT NULL                        -- 'verify-email' | 'password-reset'
token_hash    TEXT NOT NULL
expires_at    TIMESTAMPTZ NOT NULL
used_at       TIMESTAMPTZ
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()

UNIQUE INDEX user_tokens_hash_uq ON token_hash
INDEX user_tokens_user_kind_idx ON (user_id, kind)
```

### `banks`
User's account list. Holds source format hint + display metadata.

```sql
id            SERIAL PRIMARY KEY
user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
name          TEXT NOT NULL                        -- "SLSP bežný"
type          TEXT NOT NULL DEFAULT 'bezny'        -- 'bezny' | 'sporiaci' | 'kreditka'
balance       DOUBLE PRECISION NOT NULL DEFAULT 0  -- manual snapshot
currency      TEXT NOT NULL DEFAULT 'EUR'
source        TEXT NOT NULL DEFAULT 'manual'       -- 'slsp' | 'tatra' | 'revolut' | 'manual' | ...
enabled       BOOLEAN NOT NULL DEFAULT TRUE        -- soft hide from UI
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()

INDEX banks_user_idx ON user_id
```

### `transactions`
Core financial data. Every imported row gets a fingerprint to dedupe re-imports.

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
bank_id         INTEGER NOT NULL REFERENCES banks(id) ON DELETE CASCADE
type            TEXT NOT NULL                      -- 'prijem' | 'vydavok'
category        TEXT NOT NULL DEFAULT 'Nezaradené'
amount          DOUBLE PRECISION NOT NULL          -- always positive; sign carried in `type`
date            TEXT NOT NULL                      -- ISO YYYY-MM-DD
note            TEXT
fingerprint     TEXT NOT NULL                      -- sha256(date + amount + description)
ai_confidence   DOUBLE PRECISION                   -- 0..1 if categorizedBy='ai'
categorized_by  TEXT NOT NULL DEFAULT 'system'     -- 'system' | 'ai' | 'user'
merchant        TEXT                               -- AI-extracted clean merchant name
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

INDEX transactions_user_date_idx ON (user_id, date)
INDEX transactions_bank_idx ON bank_id
UNIQUE INDEX transactions_bank_fingerprint_uq ON (bank_id, fingerprint)  -- DEDUPE
INDEX transactions_user_category_idx ON (user_id, category)
```

### `mortgages`
Long-term liabilities, manually maintained.

```sql
id               SERIAL PRIMARY KEY
user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
property_name    TEXT NOT NULL                     -- "Byt Petržalka"
bank             TEXT NOT NULL
total_amount     DOUBLE PRECISION NOT NULL
remaining        DOUBLE PRECISION NOT NULL
monthly_payment  DOUBLE PRECISION NOT NULL
interest_rate    DOUBLE PRECISION
start_date       TEXT
end_date         TEXT
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()

INDEX mortgages_user_idx ON user_id
```

### `incomes`
Manual income entries (recurring sources). Currently legacy; UI doesn't expose CRUD. Imported transactions handle 95% of income tracking.

```sql
id           SERIAL PRIMARY KEY
user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
source       TEXT NOT NULL
employer     TEXT
amount       DOUBLE PRECISION NOT NULL
frequency    TEXT NOT NULL DEFAULT 'mesacne'
bank_id      INTEGER REFERENCES banks(id) ON DELETE SET NULL
date         TEXT NOT NULL
note         TEXT
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()

INDEX incomes_user_idx ON user_id
```

### `recommendations`
Cached Raul markdown per (user, month). Multiple rows per period allowed — `getLatestRecommendation` returns most recent.

```sql
id           SERIAL PRIMARY KEY
user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
period       TEXT NOT NULL                         -- YYYY-MM
content      TEXT NOT NULL                         -- markdown
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()

INDEX recommendations_user_period_idx ON (user_id, period)
```

### `clippy_tips`
Cached short tips for the floating mascot per (user, month). Tips stored as JSON array of strings.

```sql
id           SERIAL PRIMARY KEY
user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
period       TEXT NOT NULL                         -- YYYY-MM
tips         TEXT NOT NULL                         -- JSON: string[]
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()

UNIQUE INDEX clippy_tips_user_period_uq ON (user_id, period)
```

### `merchant_rules`
Per-user lookup table: `key → category`. Drives "remember my categorization" feature.

```sql
id           SERIAL PRIMARY KEY
user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
key          TEXT NOT NULL                         -- e.g. "iban:SK12...", "merchant:tesco", "tesco petrzalka"
category     TEXT NOT NULL
confidence   DOUBLE PRECISION                      -- 0..1, NULL for user-set rules
source       TEXT NOT NULL DEFAULT 'user'          -- 'user' | 'ai'  (user wins)
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()

UNIQUE INDEX merchant_rules_user_key_uq ON (user_id, key)
INDEX merchant_rules_user_idx ON user_id
```

Key shapes:
- `iban:SK12...` — IBAN extracted from note (strongest match)
- `merchant:tesco` — AI-extracted clean merchant (cross-store match)
- `tesco bratislava` — normalised note text (fallback)

### `category_registry`
Per-user, per-type curated dropdown source.

```sql
id           SERIAL PRIMARY KEY
user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
name         TEXT NOT NULL
type         TEXT NOT NULL                         -- 'vydavok' | 'prijem'
archived     BOOLEAN NOT NULL DEFAULT FALSE
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()

UNIQUE INDEX category_registry_user_type_name_uq ON (user_id, type, LOWER(name))
```

---

## Cascade behavior

```
users.id  ──cascade──┬─→ user_tokens
                     ├─→ banks ──cascade──→ transactions
                     ├─→ mortgages
                     ├─→ incomes (bank_id → SET NULL)
                     ├─→ recommendations
                     ├─→ clippy_tips
                     ├─→ merchant_rules
                     └─→ category_registry
```

Deleting a user via `DELETE /api/user` removes everything atomically. GDPR-clean.

---

## Common queries (typed helpers)

All queries live in `src/db.ts`. Examples:

```ts
// List user's banks (enabled only by default)
const banks = await listBanks(userId, { includeDisabled: false })

// Bulk-update transactions in one txn
await applyCategoryUpdates(userId, [
  { id: 42, category: 'Potraviny', source: 'user', merchant: 'Tesco' },
])

// Aggregate spend per category for a month
const summary = await categorySummary(userId, '2026-04', 'vydavok')

// Apply merchant rules to a fresh import batch
const hits = await applyRulesToTransactions(userId, newTxs, await listMerchantRules(userId))

// Find the most recent month with cached clippy tips
const latest = await findLatestClippyPeriod(userId)
```

Read [`src/db.ts`](../src/db.ts) for the full API — every public helper is documented with a JSDoc comment.

---

## Seeding

`ensureSeeded()` also creates a dev seed user (`koduvanica` / `koduvanica`) if no user with that email exists. Skipped in CI/prod-clean accounts because the email is non-conventional.

---

## Backups

Neon free tier includes **7-day point-in-time recovery** automatically. No manual backups required for hobby use. For production, set up Neon Branching + scheduled SQL dumps if data is critical.

---

## Pricing

Neon free tier (compute autoscale, 0.5 GB storage) handles:
- ~500K transactions
- All other tables negligible (~bytes per row)
- Compute hours: ~190/month free

A single active user generates ~30 KB/month after categorization. So free tier holds ~1000+ user-months before hitting storage cap.
