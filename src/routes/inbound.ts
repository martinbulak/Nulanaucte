import { Hono } from 'hono'
import {
  addTransaction,
  findBankBySource,
  findUserByInboundToken,
} from '../db'
import { detectPdfFormat, parsePdf } from '../lib/pdf-parsers'
import { extractPdfText } from '../lib/pdf-extract'
import { rateLimit } from '../middleware/rateLimit'
import { bodyLimit } from '../middleware/bodyLimit'
import { env } from '../env'
import type { BankSource } from '../types'

export const inboundRoutes = new Hono()

interface ResendInboundAttachment {
  filename?: string
  contentType?: string
  content?: string
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

// 10 MB hard cap on inbound payload (PDF + JSON envelope)
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024
// Per-attachment cap
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
// Webhook timestamp tolerance (Svix recommendation)
const WEBHOOK_MAX_AGE_SEC = 5 * 60
// Per-IP rate limit on inbound: Resend can retry, allow burst but cap aggressive callers
const inboundLimit = rateLimit({ name: 'inbound-ip', max: 60, windowMs: 60 * 1000 })

const SOURCE_LABEL: Record<BankSource, string> = {
  slsp: 'Slovenská sporiteľňa',
  tatra: 'Tatra banka',
  revolut: 'Revolut',
  manual: 'Manuálne',
}

// Shorten an email to a non-PII identifier for logs (audit H5)
function redactEmail(addr: string | undefined): string {
  if (!addr) return '<none>'
  const [local, domain] = addr.split('@', 2)
  if (!domain) return '<malformed>'
  const head = local.slice(0, 2)
  return `${head}***@${domain}`
}

async function verifyWebhook(
  c: { req: { header: (n: string) => string | undefined } },
  rawBody: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = env.INBOUND_WEBHOOK_SECRET
  if (!secret) {
    if (env.isProd) return { ok: false, reason: 'no-secret-in-prod' }
    return { ok: true } // dev only — env.ts already warned at boot
  }

  const id = c.req.header('svix-id') || c.req.header('webhook-id')
  const ts = c.req.header('svix-timestamp') || c.req.header('webhook-timestamp')
  const sig = c.req.header('svix-signature') || c.req.header('webhook-signature')
  if (!id || !ts || !sig) return { ok: false, reason: 'missing-headers' }

  // Replay protection — reject stale signatures (audit H4)
  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) return { ok: false, reason: 'bad-timestamp' }
  const ageSec = Math.abs(Date.now() / 1000 - tsNum)
  if (ageSec > WEBHOOK_MAX_AGE_SEC) return { ok: false, reason: 'stale-signature' }

  const secretBytes = secret.startsWith('whsec_')
    ? base64ToBytes(secret.slice('whsec_'.length))
    : new TextEncoder().encode(secret)

  const toSign = `${id}.${ts}.${rawBody}`
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign))
  const expected = bytesToBase64(new Uint8Array(sigBytes))

  for (const cand of sig.split(' ')) {
    const [, b64] = cand.trim().split(',', 2)
    if (b64 && timingSafeEqual(b64, expected)) return { ok: true }
  }
  return { ok: false, reason: 'signature-mismatch' }
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

/**
 * Extract `(slug, token)` from any recipient address. Both must be present and
 * match the user's stored values (audit H3 — token alone is not enough).
 */
function extractRecipient(payload: ResendInboundPayload): { slug: string; token: string } | null {
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
    const idx = local.lastIndexOf('-')
    if (idx === -1) continue
    const slug = local.slice(0, idx).toLowerCase()
    const token = local.slice(idx + 1).toLowerCase()
    if (slug && token && /^[a-z0-9-]+$/.test(slug) && /^[a-z0-9]+$/.test(token)) {
      return { slug, token }
    }
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

inboundRoutes.post('/email', bodyLimit(MAX_PAYLOAD_BYTES), inboundLimit, async (c) => {
  const rawBody = await c.req.text()

  // 1. Signature
  const verify = await verifyWebhook(c, rawBody)
  if (!verify.ok) {
    console.warn(`[inbound] reject: ${verify.reason}`)
    return c.json({ ok: false, error: 'invalid signature' }, 401)
  }

  // 2. Parse JSON
  let payload: ResendInboundPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return c.json({ ok: false, error: 'invalid json' }, 400)
  }

  // 3. Recipient → (slug, token) → user (slug must match!)
  const rcpt = extractRecipient(payload)
  if (!rcpt) {
    return c.json({ ok: true, data: { skipped: 'no-recipient' } })
  }
  const user = await findUserByInboundToken(rcpt.token)
  if (!user || user.inboundSlug.toLowerCase() !== rcpt.slug) {
    // Always 200 so Resend doesn't retry; intentionally vague to deter enumeration
    return c.json({ ok: true, data: { skipped: 'unknown-recipient' } })
  }

  // 4. Iterate attachments
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
    if (att.size && att.size > MAX_ATTACHMENT_BYTES) {
      skipped.push(`${att.filename ?? 'unnamed'} (príliš veľký)`)
      continue
    }
    const bytes = decodeAttachment(att)
    if (!bytes) {
      skipped.push(`${att.filename ?? 'unnamed'} (decode error)`)
      continue
    }
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
      skipped.push(`${att.filename ?? 'unnamed'} (príliš veľký po decode)`)
      continue
    }

    let text: string
    try {
      text = await extractPdfText(bytes)
    } catch {
      // Don't log raw error — may include PDF excerpts (audit H5)
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
      skipped.push(`${att.filename ?? 'unnamed'} (neznámy formát alebo 0 transakcií)`)
      continue
    }

    // Audit M2: do NOT auto-create banks for inbound. User must have set up
    // the matching bank explicitly (registration flow seeds the 3 default ones).
    const bank = await findBankBySource(user.id, parsed.source)
    if (!bank) {
      skipped.push(
        `${att.filename ?? 'unnamed'} (banka "${parsed.source}" nie je v účte — pridaj ju manuálne)`,
      )
      continue
    }

    let imported = 0
    let duplicates = 0
    // Cap rows to prevent runaway imports
    const MAX_ROWS = 5000
    const rows = parsed.rows.slice(0, MAX_ROWS)
    for (const row of rows) {
      // Sanity bounds (audit M7)
      if (!Number.isFinite(row.amount) || Math.abs(row.amount) > 1_000_000) continue
      if (typeof row.description !== 'string' || row.description.length > 500) continue
      const r = await addTransaction({
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
    totalRows += rows.length
    perFile.push({
      filename: att.filename?.slice(0, 120) ?? 'unnamed',
      format: parsed.source,
      bankName: bank.name,
      imported,
      duplicates,
      errors: parsed.errors.slice(0, 5),
    })
  }

  // Redacted log — no subject, no full from, just hashed identifier
  console.log(
    `[inbound] user=${user.id} from=${redactEmail(
      typeof payload.from === 'string' ? payload.from : payload.from?.email,
    )} → ${totalImported} new, ${totalDuplicates} dup, ${skipped.length} skipped`,
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
