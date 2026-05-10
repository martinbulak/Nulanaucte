export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type UserRole = 'user' | 'admin'
export type ReportFrequency = 'weekly' | 'monthly' | 'off'

export interface User {
  id: number
  email: string
  passwordHash: string
  salt: string
  name: string | null
  role: UserRole
  emailVerified: boolean
  reportFrequency: ReportFrequency
  emailNotifications: boolean
  inboundToken: string
  inboundSlug: string
  // Server-side revocation: bumped on logout-everywhere / password change
  tokenVersion: number
  // Brute-force protection
  failedLogins: number
  lockedUntil: number | null // epoch ms
  createdAt: string
  updatedAt: string
}

export interface SessionUser {
  id: number
  email: string
}

export type BankSource = 'slsp' | 'tatra' | 'revolut' | 'manual'

export interface Bank {
  id: number
  userId: number
  name: string
  type: string
  balance: number
  currency: string
  source: BankSource
  createdAt: string
}

export interface Income {
  id: number
  userId: number
  source: string
  employer: string | null
  amount: number
  frequency: string
  bankId: number | null
  date: string
  note: string | null
  createdAt: string
}

export type CategorizedBy = 'system' | 'ai' | 'user'

export interface Transaction {
  id: number
  userId: number
  type: 'vydavok' | 'prijem'
  category: string
  amount: number
  bankId: number | null
  date: string
  note: string | null
  fingerprint: string | null
  aiConfidence: number | null
  categorizedBy: CategorizedBy
  createdAt: string
}

export interface Mortgage {
  id: number
  userId: number
  propertyName: string
  bank: string
  totalAmount: number
  remaining: number
  monthlyPayment: number
  interestRate: number | null
  startDate: string | null
  endDate: string | null
  createdAt: string
}
