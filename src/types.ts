export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export interface User {
  id: number
  email: string
  passwordHash: string
  salt: string
  inboundToken: string
  inboundSlug: string
  createdAt: string
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
