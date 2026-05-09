export function normalizeNumber(raw: string): number {
  if (!raw) return NaN
  const s = String(raw).trim()
  if (!s) return NaN
  // SK formát: "1 234,56" / "-1.234,56" / "1234.56" / "− 21,50"
  const cleaned = s
    .replace(/[−–—]/g, '-') // unicode minus → ASCII
    .replace(/\s/g, '') // odstráň všetky medzery (vrátane non-breaking)
    .replace(/[€EUR$]/gi, '')
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  let normalized: string
  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = cleaned.replace(/,/g, '')
    }
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.')
  } else {
    normalized = cleaned
  }
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : NaN
}

export function parseDateSk(raw: string): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/)
  if (m) {
    const d = m[1].padStart(2, '0')
    const mo = m[2].padStart(2, '0')
    return `${m[3]}-${mo}-${d}`
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const d = m[1].padStart(2, '0')
    const mo = m[2].padStart(2, '0')
    return `${m[3]}-${mo}-${d}`
  }
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (m) {
    const d = m[3].padStart(2, '0')
    const mo = m[2].padStart(2, '0')
    return `${m[1]}-${mo}-${d}`
  }
  return null
}

export function makeFingerprint(date: string, amount: number, description: string): string {
  const desc = description.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80)
  const amt = amount.toFixed(2)
  return `${date}|${amt}|${desc}`
}
