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
const TAGLINE = 'tu uvidíš, na čo rozjebávaš lóve'

function shell(content: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html lang="sk"><head><meta charset="utf-8"><title>${BRAND}</title></head>
<body style="margin:0;padding:0;background:#0a0608;font-family:Georgia,serif;color:#f4ead5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0608;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" style="max-width:640px;background:#110d10;border:1px solid rgba(201,151,42,0.25);border-radius:6px;">
      <tr><td style="padding:32px 36px;">
        <p style="margin:0 0 6px 0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#c9972a;">✦ ${BRAND} ✦</p>
        <p style="margin:0 0 24px 0;font-family:'IM Fell English',Georgia,serif;font-style:italic;color:#b8a98a;font-size:13px;">${TAGLINE}</p>
        ${content}
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 4px 0;">
          <tr><td style="background:#c9972a;border-radius:3px;">
            <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;color:#0a0608;text-decoration:none;font-weight:600;">⚡ Otvoriť trezor</a>
          </td></tr>
        </table>
        <hr style="border:none;border-top:1px solid rgba(201,151,42,0.15);margin:32px 0 16px 0;">
        <p style="margin:0;font-size:11px;color:#7a6a52;font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.2em;text-align:center;">Frekvenciu reportov môžeš zmeniť v nastaveniach</p>
        <p style="margin:8px 0 0 0;font-size:11px;color:#7a6a52;font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.2em;text-align:center;"><a href="${ctaUrl}/nastavenia" style="color:#7a6a52;">Nastavenia →</a></p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`
}

function statRow(label: string, value: string, color: string): string {
  return `<tr>
    <td style="padding:6px 0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#7a6a52;">${label}</td>
    <td style="padding:6px 0;text-align:right;font-family:'Cinzel',serif;color:${color};font-size:18px;">${value}</td>
  </tr>`
}

function categoriesTable(items: Array<{ category: string; total: number; count: number }>): string {
  if (items.length === 0) return '<p style="color:#7a6a52;font-style:italic;">— žiadne výdavky —</p>'
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0;">
    ${items
      .map(
        (c) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid rgba(201,151,42,0.15);font-family:'IM Fell English',Georgia,serif;color:#f4ead5;">${escapeHtml(c.category)} <span style="color:#7a6a52;font-style:italic;font-size:12px;">(${c.count}×)</span></td>
        <td style="padding:6px 0;border-bottom:1px solid rgba(201,151,42,0.15);text-align:right;font-family:'Cinzel',serif;color:#c0392b;">${eur(c.total)}</td>
      </tr>`,
      )
      .join('')}
  </table>`
}

function changesBox(changes: Array<{ category: string; delta: number; pct: number }>): string {
  if (changes.length === 0) return ''
  return `<div style="background:#1c1620;border:1px solid rgba(201,151,42,0.15);border-left:3px solid #c9972a;border-radius:3px;padding:14px 18px;margin-top:16px;">
    <p style="margin:0 0 6px 0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#c9972a;">✦ Najväčšie zmeny</p>
    ${changes
      .map((c) => {
        const dir = c.delta > 0 ? '↑' : '↓'
        const color = c.delta > 0 ? '#c0392b' : '#1a6b3a'
        return `<p style="margin:4px 0;font-family:'IM Fell English',Georgia,serif;color:#b8a98a;">
          <span style="color:${color};font-family:'Cinzel',serif;">${dir} ${c.pct > 0 ? '+' : ''}${c.pct.toFixed(0)} %</span>
          v kategórii <strong style="color:#f4ead5;">${escapeHtml(c.category)}</strong>
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
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f0c040">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em style="color:#7a6a52">$1</em>')
    .replace(/`([^`]+)`/g, '<code style="color:#c9972a;font-family:monospace;font-size:12px;">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>)/gs, '<ul style="margin:8px 0 8px 20px;color:#b8a98a;">$1</ul>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
  return `<div style="background:#241d28;border-radius:4px;padding:18px 22px;margin-top:24px;">
    <p style="margin:0 0 10px 0;font-family:'Cinzel',serif;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#c9972a;">✦ Raul si všimol</p>
    <div style="font-family:'IM Fell English',Georgia,serif;color:#f4ead5;line-height:1.6;">${html}</div>
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
    `<h2 style="margin:0 0 12px 0;font-family:'Cinzel',serif;color:#f4ead5;font-size:22px;letter-spacing:0.05em;">${greet}</h2>
    <p style="margin:0 0 4px 0;font-family:'IM Fell English',Georgia,serif;font-style:italic;color:#b8a98a;">Tu je tvoj rýchly týždenný výpis za <strong style="color:#f0c040;">${data.period.from} – ${data.period.to}</strong>.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
      ${statRow('Príjmy', '+' + eur(data.totalIncome), '#1a6b3a')}
      ${statRow('Výdavky', '−' + eur(data.totalExpense), '#c0392b')}
      ${statRow('Bilancia', (net >= 0 ? '+' : '') + eur(net), net >= 0 ? '#f0c040' : '#c0392b')}
    </table>
    <h3 style="margin:24px 0 8px 0;font-family:'Cinzel',serif;color:#f4ead5;font-size:16px;letter-spacing:0.05em;">Top kategórie</h3>
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
    `<h2 style="margin:0 0 12px 0;font-family:'Cinzel',serif;color:#f4ead5;font-size:22px;letter-spacing:0.05em;">${greet}</h2>
    <p style="margin:0 0 4px 0;font-family:'IM Fell English',Georgia,serif;font-style:italic;color:#b8a98a;">${data.period.label} máme za sebou. Pergamen z trezora hovorí toto:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
      ${statRow('Príjmy', '+' + eur(data.totalIncome), '#1a6b3a')}
      ${statRow('Výdavky', '−' + eur(data.totalExpense), '#c0392b')}
      ${statRow('Bilancia', (net >= 0 ? '+' : '') + eur(net), net >= 0 ? '#f0c040' : '#c0392b')}
    </table>
    <h3 style="margin:24px 0 8px 0;font-family:'Cinzel',serif;color:#f4ead5;font-size:16px;letter-spacing:0.05em;">Kde miznú galeóny</h3>
    ${categoriesTable(data.topCategories)}
    ${changesBox(data.changeVsLast)}
    ${
      data.largestTransactions.length > 0
        ? `<h3 style="margin:24px 0 8px 0;font-family:'Cinzel',serif;color:#f4ead5;font-size:16px;letter-spacing:0.05em;">Najväčšie transakcie</h3>
    <ul style="margin:0;padding:0 0 0 20px;color:#b8a98a;font-family:'IM Fell English',Georgia,serif;">
      ${data.largestTransactions
        .map(
          (t) =>
            `<li style="margin:4px 0;"><span style="color:#7a6a52;">${t.date}</span> · ${escapeHtml(t.note)} <span style="color:#c0392b;">−${eur(t.amount)}</span> <span style="color:#7a6a52;font-style:italic;">(${escapeHtml(t.category)})</span></li>`,
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
