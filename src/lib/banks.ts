/**
 * Registry of well-known Slovak (+ commonly-used neobank) banks. Used by
 * /nastavenia checkbox UI to let the user pick which banks they actually
 * use, and surfaced via /api/banks/registry for the frontend.
 *
 * IMPORTANT: the `source` field here is what we store on the `banks` table
 * (banks.source). For banks listed as `parserSupport: 'auto'`, our PDF/CSV
 * parsers know the format and can auto-detect during import. For 'csv' the
 * user can still drop their CSV and choose the closest format manually.
 * For 'none' we accept only generic CSV with manual mapping (future work).
 */

export type ParserSupport = 'auto' | 'csv' | 'none'

export interface BankDef {
  /** Stable identifier saved to banks.source. */
  source: string
  /** Display name (Slovak). */
  name: string
  /** Short label (icon-style glyph or 1-2 char abbreviation). */
  icon: string
  /** What we can do with their exports today. */
  parserSupport: ParserSupport
  /** Category for UI grouping. */
  category: 'classic' | 'savings' | 'neobank'
  /** Short note about what we know (shown in settings as tooltip). */
  note?: string
}

export const KNOWN_BANKS: BankDef[] = [
  // ---------- Classic SK banks ----------
  {
    source: 'slsp',
    name: 'Slovenská sporiteľňa',
    icon: '⚖',
    parserSupport: 'auto',
    category: 'classic',
    note: 'PDF mesačný výpis + CSV export z George',
  },
  {
    source: 'tatra',
    name: 'Tatra banka',
    icon: '⚱',
    parserSupport: 'auto',
    category: 'classic',
    note: 'CSV export z internet bankingu',
  },
  {
    source: 'vub',
    name: 'VÚB banka',
    icon: '🜔',
    parserSupport: 'csv',
    category: 'classic',
    note: 'CSV export — manuálne nastav formát "tatra" pri importe',
  },
  {
    source: 'csob',
    name: 'ČSOB',
    icon: '⚸',
    parserSupport: 'csv',
    category: 'classic',
    note: 'CSV export — manuálny formát',
  },
  {
    source: '365bank',
    name: '365.bank',
    icon: '⚛',
    parserSupport: 'csv',
    category: 'classic',
    note: 'CSV export — manuálny formát',
  },
  {
    source: 'mbank',
    name: 'mBank',
    icon: '⚹',
    parserSupport: 'csv',
    category: 'classic',
    note: 'CSV export — manuálny formát',
  },
  {
    source: 'unicredit',
    name: 'UniCredit Bank',
    icon: '⚺',
    parserSupport: 'csv',
    category: 'classic',
    note: 'CSV export — manuálny formát',
  },
  {
    source: 'primabanka',
    name: 'Prima banka',
    icon: '⚻',
    parserSupport: 'csv',
    category: 'classic',
    note: 'CSV export — manuálny formát',
  },
  {
    source: 'privatbanka',
    name: 'Privatbanka',
    icon: '⛤',
    parserSupport: 'csv',
    category: 'classic',
    note: 'CSV export — manuálny formát',
  },

  // ---------- Stavebné sporiteľne ----------
  {
    source: 'pss',
    name: 'Prvá stavebná sporiteľňa',
    icon: '⌂',
    parserSupport: 'none',
    category: 'savings',
    note: 'Manuálne sledovanie — bez auto-importu',
  },
  {
    source: 'wustenrot',
    name: 'Wüstenrot',
    icon: '☖',
    parserSupport: 'none',
    category: 'savings',
    note: 'Manuálne sledovanie — bez auto-importu',
  },

  // ---------- Neobanky ----------
  {
    source: 'revolut',
    name: 'Revolut',
    icon: '◊',
    parserSupport: 'auto',
    category: 'neobank',
    note: 'CSV statement export — auto-detekcia',
  },
  {
    source: 'wise',
    name: 'Wise',
    icon: '◇',
    parserSupport: 'csv',
    category: 'neobank',
    note: 'CSV transactions export — manuálny formát',
  },
  {
    source: 'n26',
    name: 'N26',
    icon: '⬡',
    parserSupport: 'csv',
    category: 'neobank',
    note: 'CSV export — manuálny formát',
  },
  {
    source: 'bunq',
    name: 'bunq',
    icon: '⬢',
    parserSupport: 'csv',
    category: 'neobank',
    note: 'CSV export — manuálny formát',
  },

  // ---------- Generic fallback ----------
  {
    source: 'manual',
    name: 'Iná banka (manuálne)',
    icon: '⚖',
    parserSupport: 'none',
    category: 'classic',
    note: 'Pre banky, ktoré v zozname nie sú — pridáš si ich ručne',
  },
]

/** Lookup by source id. Returns undefined for unknown sources. */
export function findBankDef(source: string): BankDef | undefined {
  return KNOWN_BANKS.find((b) => b.source === source)
}
