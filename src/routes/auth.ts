import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import {
  bumpTokenVersion,
  clearLoginFailures,
  consumeUserToken,
  createUser,
  ensureSeeded,
  findUserByEmail,
  findUserById,
  issueUserToken,
  recordFailedLogin,
  setUserPassword,
  setUserVerified,
} from '../db'
import { hashPassword, verifyPassword } from '../lib/password'
import { COOKIE_NAME, signSession, verifySession } from '../lib/jwt'
import { requireAuth } from '../middleware/auth'
import { rateLimit } from '../middleware/rateLimit'
import { env } from '../env'
import {
  passwordResetTemplate,
  sendEmail,
  verifyEmailTemplate,
} from '../lib/email'

export const authRoutes = new Hono()

// Pre-computed dummy hash so unknown-email login does the same PBKDF2 work
// as known-email login (closes timing leak — audit H6).
let dummyHash: { salt: string; hash: string } | null = null
async function getDummyHash() {
  if (!dummyHash) dummyHash = await hashPassword('this-password-never-matches-anyone')
  return dummyHash
}

const LOCKOUT_MS = 15 * 60 * 1000 // 15 min after 5 failed attempts
const PASSWORD_MIN = 12
const PASSWORD_MAX = 256
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const loginIpLimit = rateLimit({ name: 'login-ip', max: 10, windowMs: 15 * 60 * 1000 })
const registerIpLimit = rateLimit({ name: 'register-ip', max: 5, windowMs: 60 * 60 * 1000 })
const forgotIpLimit = rateLimit({ name: 'forgot-ip', max: 5, windowMs: 60 * 60 * 1000 })

function readEmailPassword(
  body: Record<string, unknown>,
  opts: { strictEmail?: boolean } = {},
): { email: string; password: string } | string {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) return 'Email a heslo sú povinné'
  if (opts.strictEmail && !EMAIL_RE.test(email)) return 'Email má neplatný formát'
  if (password.length > PASSWORD_MAX) return 'Heslo je príliš dlhé'
  return { email, password }
}

function isStrongPassword(pw: string): true | string {
  if (pw.length < PASSWORD_MIN) return `Heslo musí mať aspoň ${PASSWORD_MIN} znakov`
  // Require at least one digit OR one symbol — keep simple, no zxcvbn dep
  if (!/[\d\W_]/.test(pw)) return 'Heslo musí obsahovať aspoň jednu číslicu alebo symbol'
  return true
}

// ---------------- LOGIN ----------------

authRoutes.post('/login', loginIpLimit, async (c) => {
  await ensureSeeded()
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const parsed = readEmailPassword(body) // login: relaxed (legacy seed user has no @)
  if (typeof parsed === 'string') return c.json({ ok: false, error: parsed }, 400)
  const { email, password } = parsed

  const user = await findUserByEmail(email)

  // Account lockout check
  if (user?.lockedUntil && user.lockedUntil > Date.now()) {
    const secs = Math.ceil((user.lockedUntil - Date.now()) / 1000)
    return c.json(
      { ok: false, error: `Účet je dočasne zamknutý. Skús o ${secs}s.` },
      429,
    )
  }

  // Constant-time path
  let ok = false
  if (user) ok = await verifyPassword(password, user.salt, user.passwordHash)
  else {
    const dummy = await getDummyHash()
    await verifyPassword(password, dummy.salt, dummy.hash)
  }

  if (!user || !ok) {
    if (user) await recordFailedLogin(user.id, LOCKOUT_MS)
    return c.json({ ok: false, error: 'Nesprávne prihlasovacie údaje' }, 401)
  }

  if (!user.emailVerified) {
    return c.json(
      {
        ok: false,
        error: 'Email ešte nie je potvrdený. Skontroluj schránku alebo požiadaj o nový link.',
        code: 'EMAIL_NOT_VERIFIED',
      },
      403,
    )
  }

  await clearLoginFailures(user.id)
  const token = await signSession({ id: user.id, email: user.email }, user.tokenVersion)
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: env.isProd,
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  return c.json({ ok: true, data: { id: user.id, email: user.email, name: user.name } })
})

// ---------------- LOGOUT ----------------

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, COOKIE_NAME)
  if (token) {
    const verified = await verifySession(token)
    if (verified) await bumpTokenVersion(verified.user.id)
  }
  deleteCookie(c, COOKIE_NAME, { path: '/' })
  return c.json({ ok: true, data: null })
})

// ---------------- /me ----------------

authRoutes.get('/me', requireAuth, async (c) => {
  const session = c.get('user')
  const u = await findUserById(session.id)
  if (!u) return c.json({ ok: false, error: 'User not found' }, 404)
  return c.json({
    ok: true,
    data: {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      emailVerified: u.emailVerified,
      reportFrequency: u.reportFrequency,
      emailNotifications: u.emailNotifications,
    },
  })
})

// ---------------- REGISTER ----------------

authRoutes.post('/register', registerIpLimit, async (c) => {
  await ensureSeeded()
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const parsed = readEmailPassword(body, { strictEmail: true })
  if (typeof parsed === 'string') return c.json({ ok: false, error: parsed }, 400)
  const { email, password } = parsed
  const strength = isStrongPassword(password)
  if (strength !== true) return c.json({ ok: false, error: strength }, 400)
  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 80)
      : null

  // Idempotency: if email already exists, always respond 200 (prevent enumeration).
  // Don't reveal whether the address is already registered.
  const existing = await findUserByEmail(email)
  if (existing) {
    // Optional: re-send verify mail if not verified
    if (!existing.emailVerified) {
      const { token } = await issueUserToken(existing.id, 'verify-email')
      const verifyUrl = `${env.PUBLIC_ORIGIN}/verify?token=${encodeURIComponent(token)}`
      const tpl = verifyEmailTemplate(verifyUrl, existing.name)
      await sendEmail({ to: existing.email, ...tpl, tag: 'verify-email' })
    }
    return c.json({ ok: true, data: { sent: true } })
  }

  let user
  try {
    user = await createUser({ email, password, name })
  } catch {
    // Race / duplicate-key — same idempotent response
    return c.json({ ok: true, data: { sent: true } })
  }

  const { token } = await issueUserToken(user.id, 'verify-email')
  const verifyUrl = `${env.PUBLIC_ORIGIN}/verify?token=${encodeURIComponent(token)}`
  const tpl = verifyEmailTemplate(verifyUrl, name)
  await sendEmail({ to: email, ...tpl, tag: 'verify-email' })

  return c.json({ ok: true, data: { sent: true } })
})

// ---------------- VERIFY EMAIL ----------------

authRoutes.post('/verify', async (c) => {
  let body: { token?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token) return c.json({ ok: false, error: 'Chýba token' }, 400)

  const userId = await consumeUserToken(token, 'verify-email')
  if (!userId) {
    return c.json(
      { ok: false, error: 'Link je neplatný alebo expirovaný. Požiadaj o nový.' },
      400,
    )
  }
  await setUserVerified(userId)
  return c.json({ ok: true, data: { verified: true } })
})

// ---------------- FORGOT / RESET ----------------

authRoutes.post('/forgot', forgotIpLimit, async (c) => {
  let body: { email?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email)) {
    // Always 200 to prevent enumeration
    return c.json({ ok: true, data: { sent: true } })
  }
  const user = await findUserByEmail(email)
  if (user) {
    const { token } = await issueUserToken(user.id, 'password-reset')
    const url = `${env.PUBLIC_ORIGIN}/reset?token=${encodeURIComponent(token)}`
    const tpl = passwordResetTemplate(url, user.name)
    await sendEmail({ to: user.email, ...tpl, tag: 'password-reset' })
  }
  return c.json({ ok: true, data: { sent: true } })
})

authRoutes.post('/reset', async (c) => {
  let body: { token?: unknown; password?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const token = typeof body.token === 'string' ? body.token : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!token || !password) return c.json({ ok: false, error: 'Chýba token alebo heslo' }, 400)
  const strength = isStrongPassword(password)
  if (strength !== true) return c.json({ ok: false, error: strength }, 400)

  const userId = await consumeUserToken(token, 'password-reset')
  if (!userId) {
    return c.json(
      { ok: false, error: 'Link je neplatný alebo expirovaný. Požiadaj o nový.' },
      400,
    )
  }
  await setUserPassword(userId, password)
  // setUserPassword bumps tokenVersion → all sessions invalidated
  return c.json({ ok: true, data: { reset: true } })
})
