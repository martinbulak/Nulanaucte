import Papa from 'papaparse'
import type { BankSource } from '../types.js'
import { normalizeNumber, parseDateSk, makeFingerprint } from './parser-utils.js'

export interface ParsedTransaction {
  date: string // ISO date YYYY-MM-DD
  amount: number // signed: negative=vydavok, positive=prijem
  description: string
  fingerprint: string
}

export interface ParseResult {
  source: BankSource
  rows: ParsedTransaction[]
  errors: string[]
}

function pickField<T extends Record<string, unknown>>(
  row: T,
  candidates: string[],
): string {
  for (const k of candidates) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  const lowerMap: Record<string, string> = {}
  for (const k of Object.keys(row)) lowerMap[k.toLowerCase().trim()] = String(row[k] ?? '')
  for (const k of candidates) {
    const v = lowerMap[k.toLowerCase().trim()]
    if (v !== undefined && v !== '') return v
  }
  return ''
}

// ---------- detection ----------

export function detectFormat(csvText: string): BankSource | null {
  const head = csvText.slice(0, 2000).toLowerCase()
  if (
    head.includes('type') &&
    head.includes('started date') &&
    head.includes('completed date') &&
    head.includes('amount')
  ) {
    return 'revolut'
  }
  if (head.includes('dátum zaúčtovania') || head.includes('datum zauctovania')) {
    if (head.includes('protistrana') || head.includes('vs') || head.includes('variabiln')) {
      return 'tatra'
    }
  }
  if (
    head.includes('dátum účtovania') ||
    head.includes('datum uctovania') ||
    head.includes('dátum a čas') ||
    head.includes('partner') ||
    head.includes('referencia platiteľa')
  ) {
    return 'slsp'
  }
  if ((head.includes('dátum') || head.includes('datum')) && head.includes('suma')) {
    return 'tatra'
  }
  return null
}

// ---------- parsers ----------

function parseGeneric(
  csvText: string,
  source: BankSource,
  mapping: {
    date: string[]
    amount: string[]
    description: string[]
    debit?: string[]
    credit?: string[]
  },
): ParseResult {
  const errors: string[] = []
  const rows: ParsedTransaction[] = []

  const tryDelimiters = [';', ',', '\t']
  let parsed: Papa.ParseResult<Record<string, string>> | null = null
  for (const d of tryDelimiters) {
    const r = Papa.parse<Record<string, string>>(csvText, {
      delimiter: d,
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().replace(/^﻿/, ''),
    })
    if (r.data.length > 0 && Object.keys(r.data[0]).length > 1) {
      parsed = r
      break
    }
  }
  if (!parsed) {
    return { source, rows: [], errors: ['CSV sa nepodarilo načítať (zlý oddeľovač?)'] }
  }

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i]
    if (!row || typeof row !== 'object') continue

    const dateRaw = pickField(row, mapping.date)
    const date = parseDateSk(dateRaw)
    if (!date) {
      if (dateRaw) errors.push(`Riadok ${i + 2}: neplatný dátum "${dateRaw}"`)
      continue
    }

    let amount: number
    if (mapping.amount.length > 0 && pickField(row, mapping.amount)) {
      amount = normalizeNumber(pickField(row, mapping.amount))
    } else {
      const debit = mapping.debit ? normalizeNumber(pickField(row, mapping.debit)) : NaN
      const credit = mapping.credit ? normalizeNumber(pickField(row, mapping.credit)) : NaN
      if (Number.isFinite(credit) && credit !== 0) amount = credit
      else if (Number.isFinite(debit) && debit !== 0) amount = -Math.abs(debit)
      else amount = NaN
    }
    if (!Number.isFinite(amount) || amount === 0) {
      continue
    }

    const description = pickField(row, mapping.description) || '—'
    rows.push({
      date,
      amount,
      description: description.trim().slice(0, 200),
      fingerprint: makeFingerprint(date, amount, description),
    })
  }

  return { source, rows, errors }
}

export function parseRevolut(csvText: string): ParseResult {
  return parseGeneric(csvText, 'revolut', {
    date: ['Completed Date', 'Started Date', 'Date'],
    amount: ['Amount'],
    description: ['Description', 'Type'],
  })
}

export function parseTatra(csvText: string): ParseResult {
  return parseGeneric(csvText, 'tatra', {
    date: [
      'Dátum zaúčtovania',
      'Datum zauctovania',
      'Dátum',
      'Datum',
      'Dátum valuty',
    ],
    amount: ['Suma', 'Suma v EUR', 'Suma transakcie'],
    description: [
      'Popis',
      'Popis transakcie',
      'Protistrana',
      'Názov protistrany',
      'Poznámka',
    ],
  })
}

export function parseSlsp(csvText: string): ParseResult {
  return parseGeneric(csvText, 'slsp', {
    date: [
      'Dátum účtovania',
      'Datum uctovania',
      'Dátum a čas',
      'Datum a cas',
      'Dátum zaúčtovania',
      'Dátum',
      'Datum',
    ],
    amount: ['Suma', 'Suma v EUR', 'Suma transakcie'],
    debit: ['Debet', 'Vydaj', 'Výdaj'],
    credit: ['Kredit', 'Príjem', 'Prijem'],
    description: ['Partner', 'Popis', 'Popis transakcie', 'Referencia platiteľa', 'Názov partnera'],
  })
}

export function parseCsv(csvText: string, hint?: BankSource): ParseResult {
  const source = hint ?? detectFormat(csvText)
  if (!source) {
    return {
      source: 'manual',
      rows: [],
      errors: [
        'Nepoznaný formát CSV. Podporované: Revolut, Tatra banka, Slovenská sporiteľňa.',
      ],
    }
  }
  switch (source) {
    case 'revolut':
      return parseRevolut(csvText)
    case 'tatra':
      return parseTatra(csvText)
    case 'slsp':
      return parseSlsp(csvText)
    default:
      return parseTatra(csvText)
  }
}
