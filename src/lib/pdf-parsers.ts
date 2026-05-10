import type { BankSource } from '../types.js'
import { normalizeNumber, parseDateSk, makeFingerprint } from './parser-utils.js'
import type { ParsedTransaction, ParseResult } from './csv-parsers.js'

// ---------- format detection ----------

export function detectPdfFormat(text: string): BankSource | null {
  const head = text.slice(0, 3000).toLowerCase()
  if (head.includes('slovenská sporiteľňa') || head.includes('slovenska sporitelna')) return 'slsp'
  if (head.includes('výpis z účtu') && head.includes('gibaskbx')) return 'slsp'
  if (head.includes('tatra banka') || head.includes('tatrskbx')) return 'tatra'
  if (head.includes('revolut')) return 'revolut'
  return null
}

// ---------- SLSP PDF ----------

const FOOTER_PATTERNS = [
  /info@slsp\.sk/,
  /Klientske centrum/,
  /www\.slsp\.sk/,
  /^Číslo Účtu\s+SK/,
  /^Mena\s+EUR/,
  /^Účtovné obdobie/,
  /^č\.\s*\d+\/\d+\s*-\s*Strana/,
  /^Dátum\s+Dátum\s+Popis/i,
  /^valuty\s+zúčtovania\s+transakcie/i,
  /^M\d+_v\d+/,
]

function stripFooters(line: string): boolean {
  return !FOOTER_PATTERNS.some((p) => p.test(line.trim()))
}

/**
 * Parses SLSP PDF výpis text (extracted from PDF).
 *
 * Strategy: each transaction block starts with two glued dates "DD.MM.YYYYDD.MM.YYYY".
 * We extract the closing balance from each block and derive the transaction amount as
 * the difference from the previous balance. Bullet-proof for SLSP because every row
 * lists "Zostatok po transakcii".
 */
export function parseSlspPdf(text: string): ParseResult {
  const errors: string[] = []
  const rows: ParsedTransaction[] = []

  const startMatch = text.match(/Počiato[čc]n[ýy]\s+stav\s+Účtu\s+(-?\s*[\d\s ]+,\d{2})/i)
  if (!startMatch) {
    return {
      source: 'slsp',
      rows: [],
      errors: ['Nepodarilo sa nájsť „Počiatočný stav Účtu" v hlavičke výpisu.'],
    }
  }
  let previousBalance = normalizeNumber(startMatch[1])
  if (!Number.isFinite(previousBalance)) {
    return { source: 'slsp', rows: [], errors: ['Počiatočný stav účtu sa nepodarilo prečítať.'] }
  }

  const endMatch = text.match(/Konečn[ýy]\s+stav\s+Účtu\s+(-?\s*[\d\s ]+,\d{2})/i)
  const finalBalance = endMatch ? normalizeNumber(endMatch[1]) : null

  let workText = text
  const poznIdx = workText.indexOf('Poznámka:')
  if (poznIdx > 0) workText = workText.slice(0, poznIdx)

  const blockStartRe = /(\d{2}\.\d{2}\.\d{4})(\d{2}\.\d{2}\.\d{4})/g
  const matches: Array<{ index: number; date1: string; date2: string }> = []
  let m: RegExpExecArray | null
  while ((m = blockStartRe.exec(workText)) !== null) {
    matches.push({ index: m.index, date1: m[1], date2: m[2] })
  }

  if (matches.length === 0) {
    return {
      source: 'slsp',
      rows: [],
      errors: ['Vo výpise sa nenašli žiadne transakcie (vzor "DD.MM.YYYYDD.MM.YYYY").'],
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]
    const next = matches[i + 1]
    const blockEnd = next ? next.index : workText.length
    const rawBlock = workText.slice(cur.index, blockEnd)

    const isoDate = parseDateSk(cur.date1)
    if (!isoDate) {
      errors.push(`Neplatný dátum: ${cur.date1}`)
      continue
    }

    const afterDates = rawBlock.slice((cur.date1 + cur.date2).length)
    const cleanedLines = afterDates
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .filter(stripFooters)
    const cleaned = cleanedLines.join(' ').replace(/\s+/g, ' ').trim()

    const numberRe = /(?:^|[\s])(-?\s?\d{1,3}(?:[\s .]\d{3})*,\d{2})(?=\s|$)/g
    const numbers: number[] = []
    let nm: RegExpExecArray | null
    while ((nm = numberRe.exec(' ' + cleaned + ' ')) !== null) {
      const v = normalizeNumber(nm[1])
      if (Number.isFinite(v)) numbers.push(v)
    }

    if (numbers.length === 0) {
      errors.push(`Blok ${isoDate}: nenašli sa žiadne sumy.`)
      continue
    }

    const balance = numbers[numbers.length - 1]
    const diff = round2(balance - previousBalance)

    if (Math.abs(diff) < 0.005) {
      previousBalance = balance
      continue
    }

    // Strip every SK-formatted number (X XXX,XX or -X,XX) from the description.
    // Safe: IBANs, VS numbers and dates don't have the ",XX" decimal suffix.
    let description = cleaned
      .replace(/-\s?\d{1,3}(?:[\s.]\d{3})*,\d{2}/g, '')
      .replace(/\d{1,3}(?:[\s.]\d{3})*,\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!description) description = '—'

    rows.push({
      date: isoDate,
      amount: diff,
      description: description.slice(0, 220),
      fingerprint: makeFingerprint(isoDate, diff, description),
    })

    previousBalance = balance
  }

  if (finalBalance != null && Math.abs(round2(finalBalance - previousBalance)) > 0.01) {
    errors.push(
      `Pozor: súčet transakcií nesedí s konečným zostatkom (rozdiel ${round2(
        finalBalance - previousBalance,
      ).toFixed(2)} €).`,
    )
  }

  return { source: 'slsp', rows, errors }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------- entry point ----------

export function parsePdf(text: string, hint?: BankSource): ParseResult {
  const source = hint ?? detectPdfFormat(text)
  if (!source) {
    return {
      source: 'manual',
      rows: [],
      errors: ['Nepoznaný formát PDF. Zatiaľ je podporovaný iba SLSP výpis.'],
    }
  }
  switch (source) {
    case 'slsp':
      return parseSlspPdf(text)
    default:
      return {
        source,
        rows: [],
        errors: [`PDF parser pre "${source}" zatiaľ nie je implementovaný.`],
      }
  }
}
