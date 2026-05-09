import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { addTransaction, findBank } from '../db'
import { detectFormat, parseCsv } from '../lib/csv-parsers'
import { detectPdfFormat, parsePdf } from '../lib/pdf-parsers'
import type { BankSource } from '../types'

export const importsRoutes = new Hono()

importsRoutes.use('*', requireAuth)

const VALID_SOURCES: BankSource[] = ['slsp', 'tatra', 'revolut', 'manual']

function pickSource(body: { source?: unknown }, fallback: BankSource): BankSource {
  if (typeof body.source === 'string' && VALID_SOURCES.includes(body.source as BankSource)) {
    return body.source as BankSource
  }
  return fallback
}

// ---------- CSV ----------

importsRoutes.post('/csv/preview', async (c) => {
  const user = c.get('user')
  let body: { bankId?: unknown; csv?: unknown; source?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const bankId = Number(body.bankId)
  const csv = typeof body.csv === 'string' ? body.csv : ''
  if (!Number.isFinite(bankId) || !csv) {
    return c.json({ ok: false, error: 'bankId a csv sú povinné' }, 400)
  }
  const bank = findBank(user.id, bankId)
  if (!bank) return c.json({ ok: false, error: 'Banka nenájdená' }, 404)

  const hint = pickSource(body, bank.source as BankSource)
  const detected = detectFormat(csv)
  const result = parseCsv(csv, hint)

  return c.json({
    ok: true,
    data: {
      kind: 'csv',
      detectedFormat: detected,
      usedFormat: result.source,
      total: result.rows.length,
      preview: result.rows.slice(0, 8),
      errors: result.errors.slice(0, 5),
    },
  })
})

importsRoutes.post('/csv', async (c) => {
  const user = c.get('user')
  let body: { bankId?: unknown; csv?: unknown; source?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const bankId = Number(body.bankId)
  const csv = typeof body.csv === 'string' ? body.csv : ''
  if (!Number.isFinite(bankId) || !csv) {
    return c.json({ ok: false, error: 'bankId a csv sú povinné' }, 400)
  }
  const bank = findBank(user.id, bankId)
  if (!bank) return c.json({ ok: false, error: 'Banka nenájdená' }, 404)

  const hint = pickSource(body, bank.source as BankSource)
  const result = parseCsv(csv, hint)

  let imported = 0
  let duplicates = 0
  for (const row of result.rows) {
    const r = addTransaction({
      userId: user.id,
      bankId,
      amount: row.amount,
      date: row.date,
      description: row.description,
      fingerprint: row.fingerprint,
    })
    if (r.duplicate) duplicates++
    else imported++
  }

  return c.json({
    ok: true,
    data: {
      kind: 'csv',
      usedFormat: result.source,
      total: result.rows.length,
      imported,
      duplicates,
      errors: result.errors,
    },
  })
})

// ---------- PDF ----------

importsRoutes.post('/pdf/preview', async (c) => {
  const user = c.get('user')
  let body: { bankId?: unknown; text?: unknown; source?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const bankId = Number(body.bankId)
  const text = typeof body.text === 'string' ? body.text : ''
  if (!Number.isFinite(bankId) || !text) {
    return c.json({ ok: false, error: 'bankId a text sú povinné' }, 400)
  }
  const bank = findBank(user.id, bankId)
  if (!bank) return c.json({ ok: false, error: 'Banka nenájdená' }, 404)

  const hint = pickSource(body, bank.source as BankSource)
  const detected = detectPdfFormat(text)
  const result = parsePdf(text, hint)

  return c.json({
    ok: true,
    data: {
      kind: 'pdf',
      detectedFormat: detected,
      usedFormat: result.source,
      total: result.rows.length,
      preview: result.rows.slice(0, 12),
      errors: result.errors.slice(0, 5),
    },
  })
})

importsRoutes.post('/pdf', async (c) => {
  const user = c.get('user')
  let body: { bankId?: unknown; text?: unknown; source?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const bankId = Number(body.bankId)
  const text = typeof body.text === 'string' ? body.text : ''
  if (!Number.isFinite(bankId) || !text) {
    return c.json({ ok: false, error: 'bankId a text sú povinné' }, 400)
  }
  const bank = findBank(user.id, bankId)
  if (!bank) return c.json({ ok: false, error: 'Banka nenájdená' }, 404)

  const hint = pickSource(body, bank.source as BankSource)
  const result = parsePdf(text, hint)

  let imported = 0
  let duplicates = 0
  for (const row of result.rows) {
    const r = addTransaction({
      userId: user.id,
      bankId,
      amount: row.amount,
      date: row.date,
      description: row.description,
      fingerprint: row.fingerprint,
    })
    if (r.duplicate) duplicates++
    else imported++
  }

  return c.json({
    ok: true,
    data: {
      kind: 'pdf',
      usedFormat: result.source,
      total: result.rows.length,
      imported,
      duplicates,
      errors: result.errors,
    },
  })
})
