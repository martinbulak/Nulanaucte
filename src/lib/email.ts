import { Resend } from 'resend'
import { env } from '../env.js'

/** Public URL of the Raul medallion (served as a static file by Vite/Vercel). */
function logoUrl(): string {
  return `${env.PUBLIC_ORIGIN.replace(/\/$/, '')}/raul.png`
}

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
const TAGLINE = 'Raul uprace tvoje financie. Lebo ty nevieš. Zadarmo.'

// Light "parchment by candlelight" palette — mirrors the in-app Lumos theme.
// All emails are sent in light mode regardless of the user's in-app preference,
// because email clients render unpredictably with dark themes.
const LIGHT = {
  pageBg:    '#faf3e0', // void
  cardBg:    '#fffef9', // obsidian
  subtleBg:  '#f1e7cc', // stone
  accentBg:  '#ede2c4', // dungeon
  text:      '#1c1620', // text-primary
  textSoft:  '#5a4527', // text-secondary
  textMuted: '#8a7350', // text-muted
  gold:      '#a07820',
  goldBright:'#b8842a',
  goldDim:   '#5a4500',
  border:    'rgba(122,92,30,0.35)',
  borderDim: 'rgba(122,92,30,0.15)',
  ink:       '#0a0608', // text on gold buttons stays dark
  crimson:   '#a52a2a',
  emerald:   '#1a6b3a',
}

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="sk">
  <head><meta charset="utf-8"><title>${BRAND}</title></head>
  <body style="margin:0;padding:0;background:${LIGHT.pageBg};font-family:Georgia,serif;color:${LIGHT.text};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT.pageBg};">
      <tr><td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" style="max-width:560px;background:${LIGHT.cardBg};border:1px solid ${LIGHT.border};border-radius:6px;box-shadow:0 8px 32px rgba(90,69,39,0.12);">
          <tr><td style="padding:32px 36px;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px 0;">
              <tr>
                <td style="vertical-align:middle;padding-right:14px;">
                  <img src="${logoUrl()}" width="56" height="56" alt="Raul" style="display:block;width:56px;height:56px;border-radius:50%;border:0;outline:none;text-decoration:none;" />
                </td>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:${LIGHT.gold};">✦ ${BRAND} ✦</p>
                  <p style="margin:4px 0 0 0;font-family:'IM Fell English',Georgia,serif;font-style:italic;color:${LIGHT.textSoft};font-size:13px;">${TAGLINE}</p>
                </td>
              </tr>
            </table>
            ${content}
            <hr style="border:none;border-top:1px solid ${LIGHT.borderDim};margin:32px 0 16px 0;">
            <p style="margin:0;font-size:11px;color:${LIGHT.textMuted};font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.2em;text-align:center;">Sova dorúčila tento list automaticky</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0;">
  <tr><td style="background:${LIGHT.gold};border-radius:3px;box-shadow:0 2px 8px rgba(160,120,32,0.25);">
    <a href="${href}" style="display:inline-block;padding:12px 28px;font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;color:${LIGHT.ink};text-decoration:none;font-weight:600;">${label}</a>
  </td></tr>
</table>`
}

export function verifyEmailTemplate(verifyUrl: string, name: string | null) {
  const greet = name ? `Vitaj, ${name}!` : 'Vitaj v trezore!'
  return {
    subject: '✦ Potvrď svoju adresu — Nula na účte',
    html: shell(`
      <h2 style="margin:0 0 12px 0;font-family:'Cinzel',serif;font-size:22px;color:${LIGHT.text};letter-spacing:0.05em;">${greet}</h2>
      <p style="margin:0 0 16px 0;line-height:1.6;color:${LIGHT.textSoft};">Aby si mohol vstúpiť do trezora, klikni na tlačidlo nižšie a potvrď svoju emailovú adresu. Link je platný 24 hodín.</p>
      ${button(verifyUrl, '⚡ Potvrdiť email')}
      <p style="margin:16px 0 0 0;font-size:12px;color:${LIGHT.textMuted};">Alebo skopíruj túto adresu do prehliadača:<br><span style="word-break:break-all;color:${LIGHT.gold};">${verifyUrl}</span></p>
      <p style="margin:24px 0 0 0;font-size:12px;color:${LIGHT.textMuted};font-style:italic;">Ak si sa neregistroval/a, tento mail ignoruj. Sova zletí preč.</p>
    `),
    text: `${greet}\n\nPotvrď svoj email kliknutím na tento odkaz (platný 24h):\n${verifyUrl}\n\nAk si sa neregistroval/a, tento mail ignoruj.`,
  }
}

export function passwordResetTemplate(resetUrl: string, name: string | null) {
  const greet = name ? `Ahoj, ${name}` : 'Ahoj'
  return {
    subject: '✦ Reset hesla — Nula na účte',
    html: shell(`
      <h2 style="margin:0 0 12px 0;font-family:'Cinzel',serif;font-size:22px;color:${LIGHT.text};letter-spacing:0.05em;">${greet},</h2>
      <p style="margin:0 0 16px 0;line-height:1.6;color:${LIGHT.textSoft};">Niekto (snáď ty) požiadal o reset hesla. Klikni na tlačidlo nižšie a nastav si nové. Link je platný <strong style="color:${LIGHT.goldBright};">30 minút</strong>.</p>
      ${button(resetUrl, '🔑 Nastaviť nové heslo')}
      <p style="margin:16px 0 0 0;font-size:12px;color:${LIGHT.textMuted};">Alebo:<br><span style="word-break:break-all;color:${LIGHT.gold};">${resetUrl}</span></p>
      <p style="margin:24px 0 0 0;font-size:12px;color:${LIGHT.textMuted};font-style:italic;">Ak si o reset nežiadal/a, mail ignoruj. Tvoje súčasné heslo zostáva platné.</p>
    `),
    text: `${greet},\n\nNiekto požiadal o reset hesla. Otvor tento odkaz (platný 30 min):\n${resetUrl}\n\nAk si nežiadal/a o reset, ignoruj.`,
  }
}
