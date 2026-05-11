import { and, desc, eq, isNull, sql as sqlOp } from 'drizzle-orm'
import { db } from './db-client.js'
import {
  users,
  banks,
  transactions,
  mortgages,
  incomes,
  userTokens,
  recommendations,
} from './schema.js'
import { hashPassword } from './lib/password.js'
import type {
  User,
  Bank,
  Income,
  Transaction,
  Mortgage,
  BankSource,
  UserRole,
  ReportFrequency,
  CategorizedBy,
} from './types.js'

// ---------------- Seeding (idempotent) ----------------

let seedingDone = false
const DEFAULT_BANKS: Array<{ name: string; type: string; source: BankSource }> = [
  { name: 'Slovenská sporiteľňa', type: 'bezny', source: 'slsp' },
  { name: 'Tatra banka', type: 'bezny', source: 'tatra' },
  { name: 'Revolut', type: 'bezny', source: 'revolut' },
]

export async function ensureSeeded(): Promise<void> {
  if (seedingDone) return
  // Check whether the seed user already exists (case-insensitive)
  const existing = await findUserByEmail('koduvanica')
  if (existing) {
    // Make sure pre-existing seed user is verified (older seeds may have been created
    // before the emailVerified column existed)
    if (!existing.emailVerified) {
      await db.update(users).set({ emailVerified: true }).where(eq(users.id, existing.id))
    }
    seedingDone = true
    return
  }
  const { salt, hash } = await hashPassword('koduvanica')
  const [user] = await db
    .insert(users)
    .values({
      email: 'koduvanica',
      passwordHash: hash,
      salt,
      name: 'Koduvanica (dev)',
      emailVerified: true, // dev seed user — skip verification flow
      inboundToken: generateToken(),
      inboundSlug: makeSlug('koduvanica'),
    })
    .returning()

  if (user) {
    for (const b of DEFAULT_BANKS) {
      await db.insert(banks).values({
        userId: user.id,
        name: b.name,
        type: b.type,
        source: b.source,
      })
    }
  }
  seedingDone = true
}

// ---------------- USERS ----------------

function rowToUser(r: typeof users.$inferSelect): User {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.passwordHash,
    salt: r.salt,
    name: r.name,
    role: r.role as UserRole,
    emailVerified: r.emailVerified,
    reportFrequency: r.reportFrequency as ReportFrequency,
    emailNotifications: r.emailNotifications,
    inboundToken: r.inboundToken,
    inboundSlug: r.inboundSlug,
    tokenVersion: r.tokenVersion,
    failedLogins: r.failedLogins,
    lockedUntil: r.lockedUntil,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [r] = await db
    .select()
    .from(users)
    .where(sqlOp`lower(${users.email}) = lower(${email})`)
    .limit(1)
  return r ? rowToUser(r) : undefined
}

export async function findUserById(id: number): Promise<User | undefined> {
  const [r] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return r ? rowToUser(r) : undefined
}

export async function findUserByInboundToken(token: string): Promise<User | undefined> {
  if (!token) return undefined
  const [r] = await db
    .select()
    .from(users)
    .where(sqlOp`lower(${users.inboundToken}) = lower(${token})`)
    .limit(1)
  return r ? rowToUser(r) : undefined
}

export async function regenerateInboundToken(userId: number): Promise<string | null> {
  const newToken = generateToken()
  const [r] = await db
    .update(users)
    .set({ inboundToken: newToken })
    .where(eq(users.id, userId))
    .returning({ inboundToken: users.inboundToken })
  return r?.inboundToken ?? null
}

export async function bumpTokenVersion(userId: number): Promise<number | null> {
  const [r] = await db
    .update(users)
    .set({ tokenVersion: sqlOp`${users.tokenVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ tokenVersion: users.tokenVersion })
  return r?.tokenVersion ?? null
}

export async function recordFailedLogin(userId: number, lockMs: number): Promise<void> {
  // Atomic increment + conditional lock
  await db.execute(sqlOp`
    UPDATE ${users}
    SET failed_logins = failed_logins + 1,
        locked_until = CASE
          WHEN failed_logins + 1 >= 5 THEN ${Date.now() + lockMs}
          ELSE locked_until
        END
    WHERE id = ${userId}
  `)
}

export async function clearLoginFailures(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ failedLogins: 0, lockedUntil: null })
    .where(eq(users.id, userId))
}

// ---------------- BANKS ----------------

function rowToBank(r: typeof banks.$inferSelect): Bank {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    type: r.type,
    balance: r.balance,
    currency: r.currency,
    source: r.source as BankSource,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function listBanks(userId: number): Promise<Bank[]> {
  const rows = await db.select().from(banks).where(eq(banks.userId, userId)).orderBy(banks.id)
  return rows.map(rowToBank)
}

export async function findBank(userId: number, bankId: number): Promise<Bank | undefined> {
  const [r] = await db
    .select()
    .from(banks)
    .where(and(eq(banks.userId, userId), eq(banks.id, bankId)))
    .limit(1)
  return r ? rowToBank(r) : undefined
}

export async function findBankBySource(
  userId: number,
  source: BankSource,
): Promise<Bank | undefined> {
  const [r] = await db
    .select()
    .from(banks)
    .where(and(eq(banks.userId, userId), eq(banks.source, source)))
    .limit(1)
  return r ? rowToBank(r) : undefined
}

export async function createBank(input: {
  userId: number
  name: string
  type?: string
  balance?: number
  currency?: string
  source?: BankSource
}): Promise<Bank> {
  const [r] = await db
    .insert(banks)
    .values({
      userId: input.userId,
      name: input.name,
      type: input.type ?? 'bezny',
      balance: input.balance ?? 0,
      currency: input.currency ?? 'EUR',
      source: input.source ?? 'manual',
    })
    .returning()
  return rowToBank(r)
}

// ---------------- TRANSACTIONS ----------------

function rowToTransaction(r: typeof transactions.$inferSelect): Transaction {
  return {
    id: r.id,
    userId: r.userId,
    type: r.type as 'prijem' | 'vydavok',
    category: r.category,
    amount: r.amount,
    bankId: r.bankId,
    date: r.date,
    note: r.note,
    fingerprint: r.fingerprint,
    aiConfidence: r.aiConfidence ?? null,
    categorizedBy: r.categorizedBy as CategorizedBy,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function listTransactions(
  userId: number,
  opts?: { bankId?: number; month?: string; type?: 'prijem' | 'vydavok' },
): Promise<Transaction[]> {
  const conds = [eq(transactions.userId, userId)]
  if (opts?.bankId != null) conds.push(eq(transactions.bankId, opts.bankId))
  if (opts?.type) conds.push(eq(transactions.type, opts.type))
  if (opts?.month) conds.push(sqlOp`${transactions.date} LIKE ${opts.month + '%'}`)

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conds))
    .orderBy(desc(transactions.date), desc(transactions.id))
  return rows.map(rowToTransaction)
}

export async function listMonthsWithData(userId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({
      ym: sqlOp<string>`substring(${transactions.date}, 1, 7)`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
  return rows.map((r) => r.ym).sort((a, b) => (a < b ? 1 : -1))
}

export async function recentTransactions(userId: number, limit = 10): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(limit)
  return rows.map(rowToTransaction)
}

export async function countTransactions(
  userId: number,
  bankId?: number,
): Promise<number> {
  const conds = [eq(transactions.userId, userId)]
  if (bankId != null) conds.push(eq(transactions.bankId, bankId))
  const [r] = await db
    .select({ count: sqlOp<number>`count(*)::int` })
    .from(transactions)
    .where(and(...conds))
  return r?.count ?? 0
}

export interface AddTransactionInput {
  userId: number
  bankId: number
  amount: number // signed: negative=vydavok, positive=prijem
  date: string
  description: string
  category?: string
  fingerprint: string
}

export async function addTransaction(
  input: AddTransactionInput,
): Promise<{ transaction: Transaction; duplicate: false } | { duplicate: true }> {
  // Idempotent insert: ON CONFLICT DO NOTHING uses the unique
  // (bank_id, fingerprint) index defined in schema.ts.
  const inserted = await db
    .insert(transactions)
    .values({
      userId: input.userId,
      bankId: input.bankId,
      type: input.amount < 0 ? 'vydavok' : 'prijem',
      category: input.category ?? 'Nezaradené',
      amount: Math.abs(input.amount),
      date: input.date,
      note: input.description,
      fingerprint: input.fingerprint,
    })
    .onConflictDoNothing({ target: [transactions.bankId, transactions.fingerprint] })
    .returning()

  if (inserted.length === 0) {
    return { duplicate: true }
  }
  return { transaction: rowToTransaction(inserted[0]), duplicate: false }
}

/** Returns the user's uncategorized (or system-categorized) transactions for AI processing. */
export async function listUncategorizedTransactions(
  userId: number,
  limit = 200,
): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.categorizedBy, 'system'),
      ),
    )
    .orderBy(desc(transactions.date))
    .limit(limit)
  return rows.map(rowToTransaction)
}

export interface CategoryUpdate {
  id: number
  category: string
  aiConfidence?: number | null
  source: CategorizedBy
}

/** Bulk-update categories for many transactions (one per query, but batched). */
export async function applyCategoryUpdates(
  userId: number,
  updates: CategoryUpdate[],
): Promise<number> {
  let count = 0
  for (const u of updates) {
    const r = await db
      .update(transactions)
      .set({
        category: u.category.slice(0, 80),
        aiConfidence: u.aiConfidence ?? null,
        categorizedBy: u.source,
      })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, u.id)))
      .returning({ id: transactions.id })
    count += r.length
  }
  return count
}

/** All distinct categories used by this user, sorted by most-frequent. */
export async function listUserCategories(userId: number): Promise<string[]> {
  const rows = await db
    .select({
      category: transactions.category,
      cnt: sqlOp<number>`count(*)::int`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.category)
  return rows
    .filter((r) => r.category && r.category !== 'Nezaradené')
    .sort((a, b) => Number(b.cnt) - Number(a.cnt))
    .map((r) => r.category)
}

/** Aggregated category totals for a month (used by Raul + dashboard). */
export async function categorySummary(
  userId: number,
  month: string,
  type: 'vydavok' | 'prijem' = 'vydavok',
): Promise<Array<{ category: string; total: number; count: number }>> {
  const rows = await db
    .select({
      category: transactions.category,
      total: sqlOp<number>`sum(${transactions.amount})::float`,
      count: sqlOp<number>`count(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, type),
        sqlOp`${transactions.date} LIKE ${month + '%'}`,
      ),
    )
    .groupBy(transactions.category)
  return rows
    .map((r) => ({ category: r.category, total: Number(r.total), count: Number(r.count) }))
    .sort((a, b) => b.total - a.total)
}

// ---------------- Recommendations (Raul) ----------------

export async function getLatestRecommendation(
  userId: number,
  period: string,
): Promise<{ id: number; period: string; content: string; createdAt: string } | null> {
  const [r] = await db
    .select()
    .from(recommendations)
    .where(and(eq(recommendations.userId, userId), eq(recommendations.period, period)))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  if (!r) return null
  return {
    id: r.id,
    period: r.period,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function saveRecommendation(
  userId: number,
  period: string,
  content: string,
): Promise<void> {
  await db.insert(recommendations).values({ userId, period, content })
}

export async function deleteAllTransactions(userId: number): Promise<{ count: number }> {
  const deleted = await db
    .delete(transactions)
    .where(eq(transactions.userId, userId))
    .returning({ id: transactions.id })
  return { count: deleted.length }
}

// ---------------- INCOMES ----------------

export async function listIncomes(userId: number): Promise<Income[]> {
  const rows = await db.select().from(incomes).where(eq(incomes.userId, userId))
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    source: r.source,
    employer: r.employer,
    amount: r.amount,
    frequency: r.frequency,
    bankId: r.bankId,
    date: r.date,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }))
}

// ---------------- MORTGAGES ----------------

function rowToMortgage(r: typeof mortgages.$inferSelect): Mortgage {
  return {
    id: r.id,
    userId: r.userId,
    propertyName: r.propertyName,
    bank: r.bank,
    totalAmount: r.totalAmount,
    remaining: r.remaining,
    monthlyPayment: r.monthlyPayment,
    interestRate: r.interestRate,
    startDate: r.startDate,
    endDate: r.endDate,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function listMortgages(userId: number): Promise<Mortgage[]> {
  const rows = await db
    .select()
    .from(mortgages)
    .where(eq(mortgages.userId, userId))
    .orderBy(mortgages.id)
  return rows.map(rowToMortgage)
}

export async function findMortgage(
  userId: number,
  id: number,
): Promise<Mortgage | undefined> {
  const [r] = await db
    .select()
    .from(mortgages)
    .where(and(eq(mortgages.userId, userId), eq(mortgages.id, id)))
    .limit(1)
  return r ? rowToMortgage(r) : undefined
}

export interface MortgageInput {
  propertyName: string
  bank: string
  totalAmount: number
  remaining: number
  monthlyPayment: number
  interestRate?: number | null
  startDate?: string | null
  endDate?: string | null
}

export async function createMortgage(
  userId: number,
  input: MortgageInput,
): Promise<Mortgage> {
  const [r] = await db
    .insert(mortgages)
    .values({
      userId,
      propertyName: input.propertyName,
      bank: input.bank,
      totalAmount: input.totalAmount,
      remaining: input.remaining,
      monthlyPayment: input.monthlyPayment,
      interestRate: input.interestRate ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    })
    .returning()
  return rowToMortgage(r)
}

export async function updateMortgage(
  userId: number,
  id: number,
  patch: Partial<MortgageInput>,
): Promise<Mortgage | null> {
  const set: Partial<typeof mortgages.$inferInsert> = {}
  if (patch.propertyName !== undefined) set.propertyName = patch.propertyName
  if (patch.bank !== undefined) set.bank = patch.bank
  if (patch.totalAmount !== undefined) set.totalAmount = patch.totalAmount
  if (patch.remaining !== undefined) set.remaining = patch.remaining
  if (patch.monthlyPayment !== undefined) set.monthlyPayment = patch.monthlyPayment
  if (patch.interestRate !== undefined) set.interestRate = patch.interestRate
  if (patch.startDate !== undefined) set.startDate = patch.startDate
  if (patch.endDate !== undefined) set.endDate = patch.endDate

  const [r] = await db
    .update(mortgages)
    .set(set)
    .where(and(eq(mortgages.userId, userId), eq(mortgages.id, id)))
    .returning()
  return r ? rowToMortgage(r) : null
}

export async function deleteMortgage(userId: number, id: number): Promise<boolean> {
  const deleted = await db
    .delete(mortgages)
    .where(and(eq(mortgages.userId, userId), eq(mortgages.id, id)))
    .returning({ id: mortgages.id })
  return deleted.length > 0
}

// ---------------- User registration / profile ----------------

export interface CreateUserInput {
  email: string
  password: string
  name?: string | null
  emailVerified?: boolean
  role?: UserRole
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const { salt, hash } = await hashPassword(input.password)
  const slug = makeSlug(input.email)
  const inboundToken = generateToken()
  const [r] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash: hash,
      salt,
      name: input.name ?? null,
      role: input.role ?? 'user',
      emailVerified: input.emailVerified ?? false,
      inboundToken,
      inboundSlug: slug,
    })
    .returning()
  // Auto-create the 3 default banks for new users (matches the seeded user pattern)
  for (const b of DEFAULT_BANKS) {
    await db.insert(banks).values({
      userId: r.id,
      name: b.name,
      type: b.type,
      source: b.source,
    })
  }
  return rowToUser(r)
}

export async function setUserPassword(userId: number, password: string): Promise<void> {
  const { salt, hash } = await hashPassword(password)
  await db
    .update(users)
    .set({
      passwordHash: hash,
      salt,
      // bump tokenVersion to invalidate all existing JWTs after password change
      tokenVersion: sqlOp`${users.tokenVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

export async function setUserVerified(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

export interface ProfileUpdate {
  name?: string | null
  reportFrequency?: ReportFrequency
  emailNotifications?: boolean
}

export async function updateProfile(userId: number, patch: ProfileUpdate): Promise<User | null> {
  const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
  if (patch.name !== undefined) set.name = patch.name
  if (patch.reportFrequency !== undefined) set.reportFrequency = patch.reportFrequency
  if (patch.emailNotifications !== undefined) set.emailNotifications = patch.emailNotifications
  const [r] = await db.update(users).set(set).where(eq(users.id, userId)).returning()
  return r ? rowToUser(r) : null
}

// ---------------- Admin queries ----------------

export interface AdminStats {
  totalUsers: number
  verifiedUsers: number
  unverifiedUsers: number
  lockedUsers: number
  totalBanks: number
  totalTransactions: number
  totalMortgages: number
  recentSignups: Array<{ id: number; email: string; emailVerified: boolean; createdAt: string }>
}

/** Returns aggregate counts only — never returns financial amounts or descriptions. */
export async function getAdminStats(): Promise<AdminStats> {
  const [
    [{ totalUsers }],
    [{ verifiedUsers }],
    [{ lockedUsers }],
    [{ totalBanks }],
    [{ totalTx }],
    [{ totalM }],
    recentRows,
  ] = await Promise.all([
    db.select({ totalUsers: sqlOp<number>`count(*)::int` }).from(users),
    db
      .select({ verifiedUsers: sqlOp<number>`count(*)::int` })
      .from(users)
      .where(eq(users.emailVerified, true)),
    db
      .select({ lockedUsers: sqlOp<number>`count(*)::int` })
      .from(users)
      .where(sqlOp`${users.lockedUntil} IS NOT NULL AND ${users.lockedUntil} > ${Date.now()}`),
    db.select({ totalBanks: sqlOp<number>`count(*)::int` }).from(banks),
    db.select({ totalTx: sqlOp<number>`count(*)::int` }).from(transactions),
    db.select({ totalM: sqlOp<number>`count(*)::int` }).from(mortgages),
    db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(20),
  ])
  const tu = Number(totalUsers ?? 0)
  const vu = Number(verifiedUsers ?? 0)
  return {
    totalUsers: tu,
    verifiedUsers: vu,
    unverifiedUsers: tu - vu,
    lockedUsers: Number(lockedUsers ?? 0),
    totalBanks: Number(totalBanks ?? 0),
    totalTransactions: Number(totalTx ?? 0),
    totalMortgages: Number(totalM ?? 0),
    recentSignups: recentRows.map((r) => ({
      id: r.id,
      email: r.email,
      emailVerified: r.emailVerified,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

export async function deleteUser(userId: number): Promise<boolean> {
  // FK cascade handles banks, transactions, mortgages, incomes, userTokens
  const deleted = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id })
  return deleted.length > 0
}

// ---------------- One-shot tokens (verify email / password reset) ----------------

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000 // 24h
const RESET_TTL_MS = 30 * 60 * 1000 // 30 min

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  const bytes = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

function generateUrlToken(): string {
  // 32 bytes = 256 bits, base64url-safe
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export type TokenKind = 'verify-email' | 'password-reset'

/** Creates a new one-shot token, invalidates any prior unused tokens of the same kind for this user. */
export async function issueUserToken(
  userId: number,
  kind: TokenKind,
): Promise<{ token: string; expiresAt: Date }> {
  // Mark any prior unused tokens of this kind as used (so old links die)
  await db
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(userTokens.userId, userId),
        eq(userTokens.kind, kind),
        isNull(userTokens.usedAt),
      ),
    )
  const token = generateUrlToken()
  const tokenHash = await sha256Hex(token)
  const ttl = kind === 'verify-email' ? VERIFY_TTL_MS : RESET_TTL_MS
  const expiresAt = new Date(Date.now() + ttl)
  await db.insert(userTokens).values({ userId, kind, tokenHash, expiresAt })
  return { token, expiresAt }
}

/** Consumes a token (single use). Returns the userId if valid, null if expired/invalid/used. */
export async function consumeUserToken(
  token: string,
  kind: TokenKind,
): Promise<number | null> {
  const tokenHash = await sha256Hex(token)
  const [row] = await db
    .select()
    .from(userTokens)
    .where(and(eq(userTokens.tokenHash, tokenHash), eq(userTokens.kind, kind)))
    .limit(1)
  if (!row) return null
  if (row.usedAt) return null
  if (row.expiresAt.getTime() < Date.now()) return null
  await db
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(eq(userTokens.id, row.id))
  return row.userId
}

// ---------------- Token / slug helpers ----------------

const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const TOKEN_LENGTH = 12
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH))
  let out = ''
  for (let i = 0; i < TOKEN_LENGTH; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length]
  return out
}

function makeSlug(raw: string): string {
  const local = raw.split('@')[0].toLowerCase()
  const cleaned = local
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16)
  return cleaned || 'user'
}
