import { Hono } from 'hono'
import {
  addTransaction,
  createBank,
  findBankBySource,
  findUserByInboundToken,
} from '../db'
import { detectPdfFormat, parsePdf } from '../lib/pdf-parsers'
import { extractPdfText } from '../lib/pdf-extract'
import type { BankSource } from '../types'

export const inboundRoutes = new Hono()

interface ResendInboundAttachment {
  filename?: string
  contentType?: string
  content?: string // base64
  // Some providers use different shapes — be tolerant
  content_id?: string
  size?: number
}

interface ResendInboundPayload {
  from?: { email?: string; name?: string } | string
  to?: Array<{ email?: string }> | string | string[]
  subject?: string
  text?: string
  html?: string
  attachments?: ResendInboundAttachment[]
}

const ENV =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

const SOURCE_LABEL: Record<BankSource, string> = {
  slsp: 'Slovenská sporiteľňa',
  tatra: 'Tatra banka',
  revolut: 'Revolut',
  manual: 'Manuálne',
}

/**
 * Verifies a Svix-signed webhook (Resend uses Svix internals).
 * Headers expected: svix-id, svix-timestamp, svix-signature.
 * Secret format: "whsec_BASE64"
 *
 * This is best-effort — if INBOUND_WEBHOOK_SECRET is unset (dev), we skip
 * verification entirely and warn in logs.
 */
async function verifyWebhook(c: {
  req: { header: (n: string) => string | undefined }
}, rawBody: string): Promise<boolean> {
  const secret = ENV.INBOUND_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[inbound] INBOUND_WEBHOOK_SECRET not set — accepting unsigned webhooks (DEV ONLY)')
    return true
  }
  const id = c.req.header('svix-id') || c.req.header('webhook-id')
  const ts = c.req.header('svix-timestamp') || c.req.header('webhook-timestamp')
  const sig = c.req.header('svix-signature') || c.req.header('webhook-signature')
  if (!id || !ts || !sig) return false

  const secretBytes = secret.startsWith('whsec_')
    ? base64ToBytes(secret.slice('whsec_'.length))
    : new TextEncoder().encode(secret)

  const toSign = `${id}.${ts}.${rawBody}`
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign))
  const expected = bytesToBase64(new Uint8Array(sigBytes))

  // Header format: "v1,base64sig v1,otherbase64sig"
  const candidates = sig.split(' ').map((p) => p.trim())
  for (const cand of candidates) {
    const [, b64] = cand.split(',', 2)
    if (b64 && timingSafeEqual(b64, expected)) return true
  }
  return false
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function extractRecipientToken(payload: ResendInboundPayload): string | null {
  const recipients: string[] = []
  if (typeof payload.to === 'string') recipients.push(payload.to)
  else if (Array.isArray(payload.to)) {
    for (const r of payload.to) {
      if (typeof r === 'string') recipients.push(r)
      else if (r?.email) recipients.push(r.email)
    }
  }
  for (const addr of recipients) {
    const local = addr.split('@')[0]
    // Token is everything after the last "-"
    const idx = local.lastIndexOf('-')
    if (idx === -1) continue
    const token = local.slice(idx + 1).trim()
    if (token) return token
  }
  return null
}

function decodeAttachment(att: ResendInboundAttachment): Uint8Array | null {
  if (!att.content) return null
  try {
    return base64ToBytes(att.content)
  } catch {
    return null
  }
}

function isPdfAttachment(att: ResendInboundAttachment): boolean {
  if (att.contentType && /pdf/i.test(att.contentType)) return true
  if (att.filename && /\.pdf$/i.test(att.filename)) return true
  return false
}

inboundRoutes.post('/email', async (c) => {
  const rawBody = await c.req.text()

  // 1. Verify signature (skipped in dev when no secret set)
  const ok = await verifyWebhook(c, rawBody)
  if (!ok) {
    console.warn('[inbound] webhook signature verification failed')
    return c.json({ ok: false, error: 'invalid signature' }, 401)
  }

  // 2. Parse JSON body
  let payload: ResendInboundPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return c.json({ ok: false, error: 'invalid json' }, 400)
  }

  // 3. Find recipient user via token in "to" address
  const token = extractRecipientToken(payload)
  if (!token) {
    console.warn('[inbound] could not extract token from recipient', payload.to)
    // Always return 200 so Resend stops retrying junk
    return c.json({ ok: true, data: { skipped: 'no-token' } })
  }
  const user = findUserByInboundToken(token)
  if (!user) {
    console.warn(`[inbound] unknown token "${token}"`)
    return c.json({ ok: true, data: { skipped: 'unknown-token' } })
  }

  // 4. Iterate attachments, run each PDF through the parser
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : []
  let totalImported = 0
  let totalDuplicates = 0
  let totalRows = 0
  const perFile: Array<{
    filename: string
    format: BankSource
    bankName: string
    imported: number
    duplicates: number
    errors: string[]
  }> = []
  const skipped: string[] = []

  for (const att of attachments) {
    if (!isPdfAttachment(att)) {
      if (att.filename) skipped.push(`${att.filename} (nie PDF)`)
      continue
    }
    const bytes = decodeAttachment(att)
    if (!bytes) {
      skipped.push(`${att.filename ?? 'unnamed'} (nepodaril sa decode)`)
      continue
    }

    let text: string
    try {
      text = await extractPdfText(bytes)
    } catch (err) {
      console.error('[inbound] PDF extract failed:', err)
      skipped.push(`${att.filename ?? 'unnamed'} (PDF extract error)`)
      continue
    }
    if (!text.trim()) {
      skipped.push(`${att.filename ?? 'unnamed'} (žiadny text — naskenované PDF?)`)
      continue
    }

    const detectedFormat = detectPdfFormat(text)
    const parsed = parsePdf(text, detectedFormat ?? undefined)
    if (parsed.source === 'manual' || parsed.rows.length === 0) {
      skipped.push(
        `${att.filename ?? 'unnamed'} (neznámy formát alebo 0 transakcií)`,
      )
      continue
    }

    // Find or auto-create the matching bank for this user
    let bank = findBankBySource(user.id, parsed.source)
    if (!bank) {
      bank = createBank({
        userId: user.id,
        name: SOURCE_LABEL[parsed.source],
        source: parsed.source,
      })
    }

    let imported = 0
    let duplicates = 0
    for (const row of parsed.rows) {
      const r = addTransaction({
        userId: user.id,
        bankId: bank.id,
        amount: row.amount,
        date: row.date,
        description: row.description,
        fingerprint: row.fingerprint,
      })
      if (r.duplicate) duplicates++
      else imported++
    }

    totalImported += imported
    totalDuplicates += duplicates
    totalRows += parsed.rows.length
    perFile.push({
      filename: att.filename ?? 'unnamed',
      format: parsed.source,
      bankName: bank.name,
      imported,
      duplicates,
      errors: parsed.errors,
    })
  }

  console.log(
    `[inbound] user=${user.id} from="${
      typeof payload.from === 'string' ? payload.from : payload.from?.email
    }" subject="${payload.subject ?? ''}" → ${totalImported} new, ${totalDuplicates} dup, ${skipped.length} skipped`,
  )

  return c.json({
    ok: true,
    data: {
      userId: user.id,
      totalRows,
      imported: totalImported,
      duplicates: totalDuplicates,
      perFile,
      skipped,
    },
  })
})
