import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { findUserById } from '../db.js'
import { sendEmail } from '../lib/email.js'

/**
 * POST /api/feedback
 *
 * User-submitted bug reports / feature requests / general feedback. Forwarded
 * straight to the project owner's inbox. Rate-limited so a hostile client
 * can't blast the mailbox.
 *
 * Recipient is hardcoded — this is a single-maintainer project (Martin), so
 * there's no need for a configurable destination yet.
 */
const FEEDBACK_RECIPIENT = 'bulak.martin@gmail.com'

type FeedbackKind = 'bug' | 'idea' | 'other'

const KIND_LABEL: Record<FeedbackKind, string> = {
  bug: '🐛 Chyba',
  idea: '💡 Nápad',
  other: '💬 Iné',
}

export const feedbackRoutes = new Hono()

feedbackRoutes.use('*', requireAuth)

// 5 submissions per hour per user is plenty for honest reports while
// stopping a logged-in spammer from mass-sending.
const feedbackLimit = rateLimit({
  name: 'feedback-user',
  max: 5,
  windowMs: 60 * 60 * 1000,
  keyer: (c) => `u:${c.get('user').id}`,
})

feedbackRoutes.post('/', feedbackLimit, async (c) => {
  const session = c.get('user')
  const user = await findUserById(session.id)
  if (!user) return c.json({ ok: false, error: 'User not found' }, 404)

  let body: { kind?: unknown; subject?: unknown; message?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }

  const kind: FeedbackKind =
    body.kind === 'bug' || body.kind === 'idea' || body.kind === 'other' ? body.kind : 'other'
  const subjectRaw = typeof body.subject === 'string' ? body.subject.trim() : ''
  const messageRaw = typeof body.message === 'string' ? body.message.trim() : ''

  if (!messageRaw) return c.json({ ok: false, error: 'Správa nemôže byť prázdna' }, 400)
  if (messageRaw.length > 5000) {
    return c.json({ ok: false, error: 'Správa môže mať max 5000 znakov' }, 400)
  }

  const subject = subjectRaw.slice(0, 120) || 'Bez predmetu'
  const fromLabel = user.name?.trim() ? `${user.name} <${user.email}>` : user.email

  // Plain text body — Resend will quote-print it; bot-proof against rich
  // markup injections coming from the user.
  const text = [
    `${KIND_LABEL[kind]} — ${subject}`,
    '',
    `Od: ${fromLabel}`,
    `User ID: ${user.id}`,
    `Typ: ${kind}`,
    '',
    '---',
    '',
    messageRaw,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="sk"><body style="font-family:Georgia,serif;max-width:640px;margin:0 auto;padding:24px;background:#faf3e0;color:#1c1620;">
  <p style="font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#a07820;margin:0 0 6px 0;">
    ✦ Nula na účte — feedback ✦
  </p>
  <h2 style="font-family:'Cinzel',serif;font-size:18px;margin:0 0 16px 0;">
    ${escapeHtml(KIND_LABEL[kind])} — ${escapeHtml(subject)}
  </h2>
  <table cellpadding="4" cellspacing="0" style="font-size:13px;color:#5a4527;margin-bottom:16px;">
    <tr><td><strong>Od:</strong></td><td>${escapeHtml(fromLabel)}</td></tr>
    <tr><td><strong>User ID:</strong></td><td>${user.id}</td></tr>
    <tr><td><strong>Typ:</strong></td><td>${kind}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid rgba(122,92,30,0.3);margin:16px 0;">
  <div style="white-space:pre-wrap;line-height:1.6;font-size:14px;background:#fffef9;border:1px solid rgba(122,92,30,0.2);padding:16px;border-radius:4px;">
    ${escapeHtml(messageRaw)}
  </div>
  <p style="font-size:11px;color:#8a7350;font-style:italic;margin-top:24px;">
    Reply-To smeruje na ${escapeHtml(user.email)} — môžeš odpovedať priamo.
  </p>
</body></html>`

  const result = await sendEmail({
    to: FEEDBACK_RECIPIENT,
    subject: `[Nula na účte] ${KIND_LABEL[kind]} — ${subject}`,
    html,
    text,
    tag: `feedback-${kind}`,
  })

  if (!result.ok) {
    console.error('[feedback] send failed:', result.error)
    return c.json({ ok: false, error: 'Email sa nepodarilo poslať. Skús to neskôr.' }, 502)
  }

  return c.json({ ok: true, data: { sent: true } })
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
