import { hashPassword } from './lib/password'
import type { User, Bank, Income, Transaction, Mortgage } from './types'

interface Store {
  users: User[]
  banks: Bank[]
  incomes: Income[]
  transactions: Transaction[]
  mortgages: Mortgage[]
  fingerprints: Set<string>
  seq: { user: number; bank: number; income: number; transaction: number; mortgage: number }
}

const store: Store = {
  users: [],
  banks: [],
  incomes: [],
  transactions: [],
  mortgages: [],
  fingerprints: new Set<string>(),
  seq: { user: 0, bank: 0, income: 0, transaction: 0, mortgage: 0 },
}

let seeded = false

const DEFAULT_BANKS: Array<{ name: string; type: string; source: BankSource }> = [
  { name: 'Slovenská sporiteľňa', type: 'bezny', source: 'slsp' },
  { name: 'Tatra banka', type: 'bezny', source: 'tatra' },
  { name: 'Revolut', type: 'bezny', source: 'revolut' },
]

export type BankSource = 'slsp' | 'tatra' | 'revolut' | 'manual'

export async function ensureSeeded(): Promise<void> {
  if (seeded) return
  seeded = true

  if (!store.users.find((u) => u.email === 'koduvanica')) {
    const { salt, hash } = await hashPassword('koduvanica')
    const user: User = {
      id: ++store.seq.user,
      email: 'koduvanica',
      passwordHash: hash,
      salt,
      inboundToken: generateToken(),
      inboundSlug: makeSlug('koduvanica'),
      createdAt: new Date().toISOString(),
    }
    store.users.push(user)

    for (const b of DEFAULT_BANKS) {
      store.banks.push({
        id: ++store.seq.bank,
        userId: user.id,
        name: b.name,
        type: b.type,
        balance: 0,
        currency: 'EUR',
        source: b.source,
        createdAt: new Date().toISOString(),
      })
    }
  }
}

export function findUserByEmail(email: string): User | undefined {
  return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
}

export function findUserById(id: number): User | undefined {
  return store.users.find((u) => u.id === id)
}

export function findUserByInboundToken(token: string): User | undefined {
  if (!token) return undefined
  const lower = token.toLowerCase()
  return store.users.find((u) => u.inboundToken.toLowerCase() === lower)
}

export function regenerateInboundToken(userId: number): string | null {
  const u = store.users.find((x) => x.id === userId)
  if (!u) return null
  u.inboundToken = generateToken()
  return u.inboundToken
}

// 6-char base32-ish token (no ambiguous chars 0/o/1/l)
const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  let out = ''
  for (let i = 0; i < 6; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length]
  return out
}

function makeSlug(raw: string): string {
  // First part of email (before @), sanitized to [a-z0-9-], max 16 chars
  const local = raw.split('@')[0].toLowerCase()
  const cleaned = local
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16)
  return cleaned || 'user'
}

// Banks
export function listBanks(userId: number): Bank[] {
  return store.banks.filter((b) => b.userId === userId)
}

export function findBank(userId: number, bankId: number): Bank | undefined {
  return store.banks.find((b) => b.userId === userId && b.id === bankId)
}

export function findBankBySource(userId: number, source: BankSource): Bank | undefined {
  return store.banks.find((b) => b.userId === userId && b.source === source)
}

export function createBank(input: {
  userId: number
  name: string
  type?: string
  balance?: number
  currency?: string
  source?: BankSource
}): Bank {
  const bank: Bank = {
    id: ++store.seq.bank,
    userId: input.userId,
    name: input.name,
    type: input.type ?? 'bezny',
    balance: input.balance ?? 0,
    currency: input.currency ?? 'EUR',
    source: input.source ?? 'manual',
    createdAt: new Date().toISOString(),
  }
  store.banks.push(bank)
  return bank
}

export function updateBankBalance(bankId: number, balance: number): void {
  const b = store.banks.find((x) => x.id === bankId)
  if (b) b.balance = balance
}

// Transactions
export function listTransactions(
  userId: number,
  opts?: { bankId?: number; month?: string; type?: 'prijem' | 'vydavok' },
): Transaction[] {
  return store.transactions
    .filter((t) => {
      if (t.userId !== userId) return false
      if (opts?.bankId != null && t.bankId !== opts.bankId) return false
      if (opts?.month && !t.date.startsWith(opts.month)) return false
      if (opts?.type && t.type !== opts.type) return false
      return true
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** Returns sorted-desc list of "YYYY-MM" months that have at least one transaction. */
export function listMonthsWithData(userId: number): string[] {
  const set = new Set<string>()
  for (const t of store.transactions) {
    if (t.userId === userId) set.add(t.date.slice(0, 7))
  }
  return [...set].sort((a, b) => (a < b ? 1 : -1))
}

export function recentTransactions(userId: number, limit = 10): Transaction[] {
  return listTransactions(userId).slice(0, limit)
}

export function countTransactions(userId: number, bankId?: number): number {
  return store.transactions.filter(
    (t) => t.userId === userId && (bankId == null || t.bankId === bankId),
  ).length
}

export interface AddTransactionInput {
  userId: number
  bankId: number
  amount: number // signed: negative=vydavok, positive=prijem
  date: string // ISO date
  description: string
  category?: string
  fingerprint: string
}

export function addTransaction(
  input: AddTransactionInput,
): { transaction: Transaction; duplicate: false } | { duplicate: true } {
  const fpKey = `${input.bankId}::${input.fingerprint}`
  if (store.fingerprints.has(fpKey)) return { duplicate: true }
  store.fingerprints.add(fpKey)

  const tx: Transaction = {
    id: ++store.seq.transaction,
    userId: input.userId,
    type: input.amount < 0 ? 'vydavok' : 'prijem',
    category: input.category ?? 'Nezaradené',
    amount: Math.abs(input.amount),
    bankId: input.bankId,
    date: input.date,
    note: input.description,
    fingerprint: input.fingerprint,
    createdAt: new Date().toISOString(),
  }
  store.transactions.push(tx)
  return { transaction: tx, duplicate: false }
}

export function deleteAllTransactions(userId: number): { count: number } {
  const userBankIds = new Set(
    store.banks.filter((b) => b.userId === userId).map((b) => b.id),
  )
  const before = store.transactions.length
  store.transactions = store.transactions.filter((t) => t.userId !== userId)
  // Also clear fingerprints for those banks so re-imports work fresh.
  const fpToRemove: string[] = []
  for (const fp of store.fingerprints) {
    const idx = fp.indexOf('::')
    if (idx === -1) continue
    const bankId = parseInt(fp.slice(0, idx), 10)
    if (userBankIds.has(bankId)) fpToRemove.push(fp)
  }
  for (const fp of fpToRemove) store.fingerprints.delete(fp)
  return { count: before - store.transactions.length }
}

// Incomes
export function listIncomes(userId: number): Income[] {
  return store.incomes.filter((i) => i.userId === userId)
}

// Mortgages
export function listMortgages(userId: number): Mortgage[] {
  return store.mortgages
    .filter((m) => m.userId === userId)
    .sort((a, b) => a.id - b.id)
}

export function findMortgage(userId: number, id: number): Mortgage | undefined {
  return store.mortgages.find((m) => m.userId === userId && m.id === id)
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

export function createMortgage(userId: number, input: MortgageInput): Mortgage {
  const m: Mortgage = {
    id: ++store.seq.mortgage,
    userId,
    propertyName: input.propertyName,
    bank: input.bank,
    totalAmount: input.totalAmount,
    remaining: input.remaining,
    monthlyPayment: input.monthlyPayment,
    interestRate: input.interestRate ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    createdAt: new Date().toISOString(),
  }
  store.mortgages.push(m)
  return m
}

export function updateMortgage(
  userId: number,
  id: number,
  patch: Partial<MortgageInput>,
): Mortgage | null {
  const m = findMortgage(userId, id)
  if (!m) return null
  if (patch.propertyName !== undefined) m.propertyName = patch.propertyName
  if (patch.bank !== undefined) m.bank = patch.bank
  if (patch.totalAmount !== undefined) m.totalAmount = patch.totalAmount
  if (patch.remaining !== undefined) m.remaining = patch.remaining
  if (patch.monthlyPayment !== undefined) m.monthlyPayment = patch.monthlyPayment
  if (patch.interestRate !== undefined) m.interestRate = patch.interestRate
  if (patch.startDate !== undefined) m.startDate = patch.startDate
  if (patch.endDate !== undefined) m.endDate = patch.endDate
  return m
}

export function deleteMortgage(userId: number, id: number): boolean {
  const idx = store.mortgages.findIndex((m) => m.userId === userId && m.id === id)
  if (idx === -1) return false
  store.mortgages.splice(idx, 1)
  return true
}
