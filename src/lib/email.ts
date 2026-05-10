import { Resend } from 'resend'
import { env } from '../env.js'

let resendClient: Resend | null = null
function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null
  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY)
  return resendClient
}

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text?: string
  /** Tagging / categorization for Resend dashboard. */
  tag?: string
}

/**
 * Sends an email via Resend. In dev (no RESEND_API_KEY), prints to console
 * with a clearly visible separator so verify/reset links are easy to find.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const client = getClient()
  if (!client) {
    // Dev fallback — print to terminal
    /* eslint-disable no-console */
    console.log('\n' + '═'.repeat(70))
    console.log(`[email DEV] To:      ${input.to}`)
    console.log(`[email DEV] Subject: ${input.subject}`)
    if (input.text) console.log(`[email DEV] Text:\n${input.text}`)
    else {
      // Strip HTML tags crudely for console preview
      const stripped = input.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      console.log(`[email DEV] Body (stripped):\n${stripped.slice(0, 600)}`)
    }
    console.log('═'.repeat(70) + '\n')
    /* eslint-enable no-console */
    return { ok: true, id: 'dev-stub' }
  }
  try {
    const result = await client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tag ? [{ name: 'kind', value: input.tag }] : undefined,
    })
    if (result.error) return { ok: false, error: result.error.message ?? 'Resend error' }
    return { ok: true, id: result.data?.id ?? '' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed' }
  }
}

// ---------------- Templates ----------------

const BRAND = 'Nula na účte'
const TAGLINE = 'tu uvidíš, na čo rozjebávaš lóve'

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="sk">
  <head><meta charset="utf-8"><title>${BRAND}</title></head>
  <body style="margin:0;padding:0;background:#0a0608;font-family:Georgia,serif;color:#f4ead5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0608;">
      <tr><td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" style="max-width:560px;background:#110d10;border:1px solid rgba(201,151,42,0.25);border-radius:6px;">
          <tr><td style="padding:32px 36px;">
            <p style="margin:0 0 6px 0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#c9972a;">✦ ${BRAND} ✦</p>
            <p style="margin:0 0 32px 0;font-family:'IM Fell English',Georgia,serif;font-style:italic;color:#b8a98a;font-size:13px;">${TAGLINE}</p>
            ${content}
            <hr style="border:none;border-top:1px solid rgba(201,151,42,0.15);margin:32px 0 16px 0;">
            <p style="margin:0;font-size:11px;color:#7a6a52;font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.2em;text-align:center;">Sova dorúčila tento list automaticky</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0;">
  <tr><td style="background:#c9972a;border-radius:3px;">
    <a href="${href}" style="display:inline-block;padding:12px 28px;font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;color:#0a0608;text-decoration:none;font-weight:600;">${label}</a>
  </td></tr>
</table>`
}

export function verifyEmailTemplate(verifyUrl: string, name: string | null) {
  const greet = name ? `Vitaj, ${name}!` : 'Vitaj v trezore!'
  return {
    subject: '✦ Potvrď svoju adresu — Nula na účte',
    html: shell(`
      <h2 style="margin:0 0 12px 0;font-family:'Cinzel',serif;font-size:22px;color:#f4ead5;letter-spacing:0.05em;">${greet}</h2>
      <p style="margin:0 0 16px 0;line-height:1.6;color:#b8a98a;">Aby si mohol vstúpiť do trezora, klikni na tlačidlo nižšie a potvrď svoju emailovú adresu. Link je platný 24 hodín.</p>
      ${button(verifyUrl, '⚡ Potvrdiť email')}
      <p style="margin:16px 0 0 0;font-size:12px;color:#7a6a52;">Alebo skopíruj túto adresu do prehliadača:<br><span style="word-break:break-all;color:#c9972a;">${verifyUrl}</span></p>
      <p style="margin:24px 0 0 0;font-size:12px;color:#7a6a52;font-style:italic;">Ak si sa neregistroval/a, tento mail ignoruj. Sova zletí preč.</p>
    `),
    text: `${greet}\n\nPotvrď svoj email kliknutím na tento odkaz (platný 24h):\n${verifyUrl}\n\nAk si sa neregistroval/a, tento mail ignoruj.`,
  }
}

export function passwordResetTemplate(resetUrl: string, name: string | null) {
  const greet = name ? `Ahoj, ${name}` : 'Ahoj'
  return {
    subject: '✦ Reset hesla — Nula na účte',
    html: shell(`
      <h2 style="margin:0 0 12px 0;font-family:'Cinzel',serif;font-size:22px;color:#f4ead5;letter-spacing:0.05em;">${greet},</h2>
      <p style="margin:0 0 16px 0;line-height:1.6;color:#b8a98a;">Niekto (snáď ty) požiadal o reset hesla. Klikni na tlačidlo nižšie a nastav si nové. Link je platný <strong style="color:#f0c040;">30 minút</strong>.</p>
      ${button(resetUrl, '🔑 Nastaviť nové heslo')}
      <p style="margin:16px 0 0 0;font-size:12px;color:#7a6a52;">Alebo:<br><span style="word-break:break-all;color:#c9972a;">${resetUrl}</span></p>
      <p style="margin:24px 0 0 0;font-size:12px;color:#7a6a52;font-style:italic;">Ak si o reset nežiadal/a, mail ignoruj. Tvoje súčasné heslo zostáva platné.</p>
    `),
    text: `${greet},\n\nNiekto požiadal o reset hesla. Otvor tento odkaz (platný 30 min):\n${resetUrl}\n\nAk si nežiadal/a o reset, ignoruj.`,
  }
}
