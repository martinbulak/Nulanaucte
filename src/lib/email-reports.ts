import type { SendEmailInput } from './email.js'

const eur = (n: number) =>
  new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

interface ReportData {
  period: { from: string; to: string; label: string }
  totalIncome: number
  totalExpense: number
  topCategories: Array<{ category: string; total: number; count: number }>
  changeVsLast: Array<{ category: string; delta: number; pct: number }>
  largestTransactions: Array<{ note: string; amount: number; date: string; category: string }>
  recommendations: string
}

const BRAND = 'Nula na účte'
const TAGLINE = 'Raul uprace tvoje financie. Lebo ty nevieš. Zadarmo.'

// Light "parchment by candlelight" palette — keep in sync with src/lib/email.ts.
const LIGHT = {
  pageBg:    '#faf3e0',
  cardBg:    '#fffef9',
  subtleBg:  '#f1e7cc',
  accentBg:  '#ede2c4',
  text:      '#1c1620',
  textSoft:  '#5a4527',
  textMuted: '#8a7350',
  gold:      '#a07820',
  goldBright:'#b8842a',
  goldDim:   '#5a4500',
  border:    'rgba(122,92,30,0.35)',
  borderDim: 'rgba(122,92,30,0.15)',
  ink:       '#0a0608',
  crimson:   '#a52a2a',
  emerald:   '#1a6b3a',
}

function shell(content: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html lang="sk"><head><meta charset="utf-8"><title>${BRAND}</title></head>
<body style="margin:0;padding:0;background:${LIGHT.pageBg};font-family:Georgia,serif;color:${LIGHT.text};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT.pageBg};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" style="max-width:640px;background:${LIGHT.cardBg};border:1px solid ${LIGHT.border};border-radius:6px;box-shadow:0 8px 32px rgba(90,69,39,0.12);">
      <tr><td style="padding:32px 36px;">
        <p style="margin:0 0 6px 0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:${LIGHT.gold};">✦ ${BRAND} ✦</p>
        <p style="margin:0 0 24px 0;font-family:'IM Fell English',Georgia,serif;font-style:italic;color:${LIGHT.textSoft};font-size:13px;">${TAGLINE}</p>
        ${content}
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 4px 0;">
          <tr><td style="background:${LIGHT.gold};border-radius:3px;box-shadow:0 2px 8px rgba(160,120,32,0.25);">
            <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;color:${LIGHT.ink};text-decoration:none;font-weight:600;">⚡ Otvoriť trezor</a>
          </td></tr>
        </table>
        <hr style="border:none;border-top:1px solid ${LIGHT.borderDim};margin:32px 0 16px 0;">
        <p style="margin:0;font-size:11px;color:${LIGHT.textMuted};font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.2em;text-align:center;">Frekvenciu reportov môžeš zmeniť v nastaveniach</p>
        <p style="margin:8px 0 0 0;font-size:11px;color:${LIGHT.textMuted};font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.2em;text-align:center;"><a href="${ctaUrl}/nastavenia" style="color:${LIGHT.textMuted};">Nastavenia →</a></p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`
}

function statRow(label: string, value: string, color: string): string {
  return `<tr>
    <td style="padding:6px 0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:${LIGHT.textMuted};">${label}</td>
    <td style="padding:6px 0;text-align:right;font-family:'Cinzel',serif;color:${color};font-size:18px;">${value}</td>
  </tr>`
}

function categoriesTable(items: Array<{ category: string; total: number; count: number }>): string {
  if (items.length === 0) return `<p style="color:${LIGHT.textMuted};font-style:italic;">— žiadne výdavky —</p>`
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0;">
    ${items
      .map(
        (c) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid ${LIGHT.borderDim};font-family:'IM Fell English',Georgia,serif;color:${LIGHT.text};">${escapeHtml(c.category)} <span style="color:${LIGHT.textMuted};font-style:italic;font-size:12px;">(${c.count}×)</span></td>
        <td style="padding:6px 0;border-bottom:1px solid ${LIGHT.borderDim};text-align:right;font-family:'Cinzel',serif;color:${LIGHT.crimson};">${eur(c.total)}</td>
      </tr>`,
      )
      .join('')}
  </table>`
}

function changesBox(changes: Array<{ category: string; delta: number; pct: number }>): string {
  if (changes.length === 0) return ''
  return `<div style="background:${LIGHT.subtleBg};border:1px solid ${LIGHT.borderDim};border-left:3px solid ${LIGHT.gold};border-radius:3px;padding:14px 18px;margin-top:16px;">
    <p style="margin:0 0 6px 0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:${LIGHT.gold};">✦ Najväčšie zmeny</p>
    ${changes
      .map((c) => {
        const dir = c.delta > 0 ? '↑' : '↓'
        const color = c.delta > 0 ? LIGHT.crimson : LIGHT.emerald
        return `<p style="margin:4px 0;font-family:'IM Fell English',Georgia,serif;color:${LIGHT.textSoft};">
          <span style="color:${color};font-family:'Cinzel',serif;">${dir} ${c.pct > 0 ? '+' : ''}${c.pct.toFixed(0)} %</span>
          v kategórii <strong style="color:${LIGHT.text};">${escapeHtml(c.category)}</strong>
          (${c.delta > 0 ? '+' : ''}${eur(c.delta)})
        </p>`
      })
      .join('')}
  </div>`
}

function recommendationsBox(content: string): string {
  if (!content) return ''
  // Convert minimal markdown → HTML (bold, italic, line breaks, list items)
  const html = escapeHtml(content)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${LIGHT.goldDim}">$1</strong>`)
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, `<em style="color:${LIGHT.textMuted}">$1</em>`)
    .replace(/`([^`]+)`/g, `<code style="color:${LIGHT.gold};font-family:monospace;font-size:12px;">$1</code>`)
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>)/gs, `<ul style="margin:8px 0 8px 20px;color:${LIGHT.textSoft};">$1</ul>`)
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
  return `<div style="background:${LIGHT.accentBg};border-radius:4px;padding:18px 22px;margin-top:24px;border:1px solid ${LIGHT.borderDim};">
    <p style="margin:0 0 10px 0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:${LIGHT.gold};">✦ Raul si všimol</p>
    <div style="font-family:'IM Fell English',Georgia,serif;color:${LIGHT.text};line-height:1.6;">${html}</div>
  </div>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ---------------- TEMPLATES ----------------

export function weeklyReportTemplate(
  name: string | null,
  data: ReportData,
  origin: string,
): SendEmailInput {
  const greet = name ? `Ahoj ${escapeHtml(name)},` : 'Ahoj,'
  const net = data.totalIncome - data.totalExpense
  const subject = `🦉 Týždenný výpis ${data.period.from} – ${data.period.to}`
  const html = shell(
    `<h2 style="margin:0 0 12px 0;font-family:'Cinzel',serif;color:${LIGHT.text};font-size:22px;letter-spacing:0.05em;">${greet}</h2>
    <p style="margin:0 0 4px 0;font-family:'IM Fell English',Georgia,serif;font-style:italic;color:${LIGHT.textSoft};">Tu je tvoj rýchly týždenný výpis za <strong style="color:${LIGHT.goldDim};">${data.period.from} – ${data.period.to}</strong>.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
      ${statRow('Príjmy', '+' + eur(data.totalIncome), LIGHT.emerald)}
      ${statRow('Výdavky', '−' + eur(data.totalExpense), LIGHT.crimson)}
      ${statRow('Bilancia', (net >= 0 ? '+' : '') + eur(net), net >= 0 ? LIGHT.goldDim : LIGHT.crimson)}
    </table>
    <h3 style="margin:24px 0 8px 0;font-family:'Cinzel',serif;color:${LIGHT.text};font-size:16px;letter-spacing:0.05em;">Top kategórie</h3>
    ${categoriesTable(data.topCategories)}
    ${changesBox(data.changeVsLast)}
    ${recommendationsBox(data.recommendations)}`,
    origin,
  )
  const text = `${greet}\n\nTýždenný výpis ${data.period.from} – ${data.period.to}\n\nPríjmy: +${eur(data.totalIncome)}\nVýdavky: −${eur(data.totalExpense)}\nBilancia: ${eur(net)}\n\nOtvoriť: ${origin}`
  return { to: '', subject, html, text }
}

export function monthlyReportTemplate(
  name: string | null,
  data: ReportData,
  origin: string,
): SendEmailInput {
  const greet = name ? `Ahoj ${escapeHtml(name)},` : 'Ahoj,'
  const net = data.totalIncome - data.totalExpense
  const subject = `📜 Mesačný výpis z Rokfortu reality — ${data.period.label}`
  const html = shell(
    `<h2 style="margin:0 0 12px 0;font-family:'Cinzel',serif;color:${LIGHT.text};font-size:22px;letter-spacing:0.05em;">${greet}</h2>
    <p style="margin:0 0 4px 0;font-family:'IM Fell English',Georgia,serif;font-style:italic;color:${LIGHT.textSoft};">${data.period.label} máme za sebou. Pergamen z trezora hovorí toto:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
      ${statRow('Príjmy', '+' + eur(data.totalIncome), LIGHT.emerald)}
      ${statRow('Výdavky', '−' + eur(data.totalExpense), LIGHT.crimson)}
      ${statRow('Bilancia', (net >= 0 ? '+' : '') + eur(net), net >= 0 ? LIGHT.goldDim : LIGHT.crimson)}
    </table>
    <h3 style="margin:24px 0 8px 0;font-family:'Cinzel',serif;color:${LIGHT.text};font-size:16px;letter-spacing:0.05em;">Kde miznú galeóny</h3>
    ${categoriesTable(data.topCategories)}
    ${changesBox(data.changeVsLast)}
    ${
      data.largestTransactions.length > 0
        ? `<h3 style="margin:24px 0 8px 0;font-family:'Cinzel',serif;color:${LIGHT.text};font-size:16px;letter-spacing:0.05em;">Najväčšie transakcie</h3>
    <ul style="margin:0;padding:0 0 0 20px;color:${LIGHT.textSoft};font-family:'IM Fell English',Georgia,serif;">
      ${data.largestTransactions
        .map(
          (t) =>
            `<li style="margin:4px 0;"><span style="color:${LIGHT.textMuted};">${t.date}</span> · ${escapeHtml(t.note)} <span style="color:${LIGHT.crimson};">−${eur(t.amount)}</span> <span style="color:${LIGHT.textMuted};font-style:italic;">(${escapeHtml(t.category)})</span></li>`,
        )
        .join('')}
    </ul>`
        : ''
    }
    ${recommendationsBox(data.recommendations)}`,
    origin,
  )
  const text = `${greet}\n\nMesačný výpis ${data.period.label}\n\nPríjmy: +${eur(data.totalIncome)}\nVýdavky: −${eur(data.totalExpense)}\nBilancia: ${eur(net)}\n\nOtvoriť: ${origin}`
  return { to: '', subject, html, text }
}
