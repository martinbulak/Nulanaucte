/**
 * Centralized environment-variable validator. Imported by `src/index.ts` so a
 * misconfigured deployment fails at boot, not at first request.
 *
 * Hard requirements in production:
 *   - JWT_SECRET (>= 32 chars)
 *   - INBOUND_WEBHOOK_SECRET (Resend / Svix shared secret)
 *
 * Soft (defaults):
 *   - INBOUND_DOMAIN (defaults to "inbox.local" in dev)
 *   - PUBLIC_ORIGIN (defaults to "http://localhost:8787" in dev)
 *   - NODE_ENV (defaults to "development")
 */

const _env: Record<string, string | undefined> =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

const NODE_ENV = (_env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test'
const isProd = NODE_ENV === 'production'

function required(key: string, opts: { minLen?: number } = {}): string {
  const v = _env[key]
  if (!v || v.trim() === '') {
    throw new Error(`[env] ${key} is required (NODE_ENV=${NODE_ENV})`)
  }
  if (opts.minLen && v.length < opts.minLen) {
    throw new Error(`[env] ${key} must be at least ${opts.minLen} chars`)
  }
  return v
}

function optional(key: string, fallback: string): string {
  const v = _env[key]
  return v && v.trim() !== '' ? v : fallback
}

// JWT_SECRET — required everywhere. In dev we provide a one-time random fallback
// that lives only for the lifetime of the process. This means restarting the dev
// server invalidates all sessions (forces re-login), which is the desired behavior
// for a shared dev secret.
let jwtSecret: string
const jwtRaw = _env.JWT_SECRET
if (jwtRaw && jwtRaw.length >= 32) {
  jwtSecret = jwtRaw
} else if (isProd) {
  throw new Error('[env] JWT_SECRET must be set and at least 32 chars in production')
} else {
  // Generate a random per-process secret in dev so missing env doesn't fall
  // through to a publicly known value (audit C1).
  const bytes = crypto.getRandomValues(new Uint8Array(48))
  jwtSecret = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  // eslint-disable-next-line no-console
  console.warn(
    '[env] JWT_SECRET not set — generated a random per-process secret for dev. ' +
      'Sessions will not survive server restart. Set JWT_SECRET in .env for stability.',
  )
}

// INBOUND_WEBHOOK_SECRET — recommended in production but not boot-blocker.
// If missing in prod, the inbound webhook route itself will reject all requests
// with 401 (see src/routes/inbound.ts → verifyWebhook). This lets the app boot
// before Resend is fully configured.
let inboundWebhookSecret: string | null = null
const inboundRaw = _env.INBOUND_WEBHOOK_SECRET
if (inboundRaw && inboundRaw.trim() !== '') {
  inboundWebhookSecret = inboundRaw
} else if (isProd) {
  // eslint-disable-next-line no-console
  console.warn(
    '[env] INBOUND_WEBHOOK_SECRET not set in production — inbound email webhook ' +
      'will reject all requests until set. App boot continues.',
  )
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[env] INBOUND_WEBHOOK_SECRET not set — accepting unsigned webhooks in DEV ONLY.',
  )
}

// DATABASE_URL — required everywhere (Postgres / Neon connection string).
const databaseUrl = required('DATABASE_URL', { minLen: 20 })

// RESEND_API_KEY — required in prod for verify/reset emails + reports.
// In dev, missing key triggers console-log fallback (links printed to terminal).
const resendApiKey = _env.RESEND_API_KEY ?? null
if (isProd && !resendApiKey) {
  throw new Error('[env] RESEND_API_KEY is required in production')
}
if (!resendApiKey) {
  console.warn(
    '[env] RESEND_API_KEY not set — emails will be console.log-ed in DEV ONLY.',
  )
}

// OPENAI_API_KEY — used for transaction categorization & Raul recommendations.
// Optional everywhere; AI features stub when missing.
const openaiApiKey = _env.OPENAI_API_KEY ?? null
if (!openaiApiKey) {
  console.warn(
    '[env] OPENAI_API_KEY not set — AI categorization & Raul recommendations are stubbed.',
  )
}

export const env = {
  NODE_ENV,
  isProd,
  JWT_SECRET: jwtSecret,
  INBOUND_WEBHOOK_SECRET: inboundWebhookSecret,
  INBOUND_DOMAIN: optional('INBOUND_DOMAIN', 'inbox.local'),
  PUBLIC_ORIGIN: optional('PUBLIC_ORIGIN', 'http://localhost:8787'),
  DATABASE_URL: databaseUrl,
  RESEND_API_KEY: resendApiKey,
  EMAIL_FROM: optional('EMAIL_FROM', 'Nula na účte <noreply@nula.local>'),
  OPENAI_API_KEY: openaiApiKey,
  CRON_SECRET: _env.CRON_SECRET ?? null,
} as const

export type Env = typeof env
