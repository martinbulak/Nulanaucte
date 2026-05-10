import type { Context } from 'hono'
import {
  findUserById,
  listBanks,
  listIncomes,
  listMortgages,
  listTransactions,
} from '../db'

/**
 * GDPR-compliant data export — returns everything we have on the user as JSON.
 */
export default async function exportUser(userId: number, c: Context) {
  const [user, banks, transactions, mortgages, incomes] = await Promise.all([
    findUserById(userId),
    listBanks(userId),
    listTransactions(userId),
    listMortgages(userId),
    listIncomes(userId),
  ])
  if (!user) return c.json({ ok: false, error: 'User not found' }, 404)

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      reportFrequency: user.reportFrequency,
      emailNotifications: user.emailNotifications,
      createdAt: user.createdAt,
    },
    banks,
    transactions,
    mortgages,
    incomes,
  }

  c.header('Content-Type', 'application/json; charset=utf-8')
  c.header(
    'Content-Disposition',
    `attachment; filename="nula-na-ucte-export-${user.id}-${Date.now()}.json"`,
  )
  return c.body(JSON.stringify(payload, null, 2))
}
