import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ---------------- USERS ----------------

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    salt: text('salt').notNull(),
    name: text('name'), // display name / nickname
    role: text('role').notNull().default('user'), // 'user' | 'admin'
    emailVerified: boolean('email_verified').notNull().default(false),
    reportFrequency: text('report_frequency').notNull().default('monthly'), // 'weekly' | 'monthly' | 'off'
    emailNotifications: boolean('email_notifications').notNull().default(true),
    inboundToken: text('inbound_token').notNull(),
    inboundSlug: text('inbound_slug').notNull(),
    tokenVersion: integer('token_version').notNull().default(0),
    failedLogins: integer('failed_logins').notNull().default(0),
    // epoch ms — null = not locked
    lockedUntil: bigint('locked_until', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Case-insensitive unique (audit M3)
    emailLowerUq: uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`),
    inboundTokenUq: uniqueIndex('users_inbound_token_uq').on(t.inboundToken),
  }),
)

// One-shot tokens for email verification & password reset.
// Token value is stored as SHA-256 hash so DB compromise doesn't leak active links.
export const userTokens = pgTable(
  'user_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'verify-email' | 'password-reset'
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenHashUq: uniqueIndex('user_tokens_hash_uq').on(t.tokenHash),
    userKindIdx: index('user_tokens_user_kind_idx').on(t.userId, t.kind),
  }),
)

// ---------------- BANKS ----------------

export const banks = pgTable(
  'banks',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull().default('bezny'),
    balance: doublePrecision('balance').notNull().default(0),
    currency: text('currency').notNull().default('EUR'),
    source: text('source').notNull().default('manual'), // 'slsp' | 'tatra' | 'revolut' | 'manual'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('banks_user_idx').on(t.userId),
  }),
)

// ---------------- TRANSACTIONS ----------------

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bankId: integer('bank_id')
      .notNull()
      .references(() => banks.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'prijem' | 'vydavok'
    category: text('category').notNull().default('Nezaradené'),
    amount: doublePrecision('amount').notNull(), // always positive; sign in `type`
    date: text('date').notNull(), // ISO YYYY-MM-DD
    note: text('note'),
    fingerprint: text('fingerprint').notNull(),
    // AI categorization metadata
    aiConfidence: doublePrecision('ai_confidence'),
    categorizedBy: text('categorized_by').notNull().default('system'), // 'system' | 'ai' | 'user'
    // AI-extracted merchant identifier (clean company name like "Tesco", "BTS Airport").
    // Nullable — only populated after AI categorisation runs.
    merchant: text('merchant'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userDateIdx: index('transactions_user_date_idx').on(t.userId, t.date),
    bankIdx: index('transactions_bank_idx').on(t.bankId),
    // Critical for dedup (audit H2 fix). Per-bank fingerprint uniqueness.
    bankFingerprintUq: uniqueIndex('transactions_bank_fingerprint_uq').on(
      t.bankId,
      t.fingerprint,
    ),
    categoryIdx: index('transactions_user_category_idx').on(t.userId, t.category),
  }),
)

// Per-user lookup rules: "if a future transaction's normalized merchant-key
// matches one I've already categorized, auto-apply that category before AI
// even sees the transaction". Key is derived from the note (IBAN if present,
// otherwise a normalized merchant identifier) via merchantKey() in ai.ts.
//
// Rules are created automatically when the user manually overrides a category
// (and optionally when AI returns a high-confidence categorization).
export const merchantRules = pgTable(
  'merchant_rules',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    category: text('category').notNull(),
    confidence: doublePrecision('confidence'),
    source: text('source').notNull().default('user'), // 'user' | 'ai'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userKeyUq: uniqueIndex('merchant_rules_user_key_uq').on(t.userId, t.key),
    userIdx: index('merchant_rules_user_idx').on(t.userId),
  }),
)

// Stores AI-generated periodic recommendations (Raul) so we don't burn tokens on every dashboard load.
export const recommendations = pgTable(
  'recommendations',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    period: text('period').notNull(), // YYYY-MM (the analyzed month)
    content: text('content').notNull(), // markdown / plain text
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userPeriodIdx: index('recommendations_user_period_idx').on(t.userId, t.period),
  }),
)

// ---------------- INCOMES ----------------
// (Defined for completeness — not yet used by API.)

export const incomes = pgTable(
  'incomes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    employer: text('employer'),
    amount: doublePrecision('amount').notNull(),
    frequency: text('frequency').notNull().default('mesacne'),
    bankId: integer('bank_id').references(() => banks.id, { onDelete: 'set null' }),
    date: text('date').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('incomes_user_idx').on(t.userId),
  }),
)

// ---------------- MORTGAGES ----------------

export const mortgages = pgTable(
  'mortgages',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    propertyName: text('property_name').notNull(),
    bank: text('bank').notNull(),
    totalAmount: doublePrecision('total_amount').notNull(),
    remaining: doublePrecision('remaining').notNull(),
    monthlyPayment: doublePrecision('monthly_payment').notNull(),
    interestRate: doublePrecision('interest_rate'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('mortgages_user_idx').on(t.userId),
  }),
)
