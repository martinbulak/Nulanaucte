import OpenAI from 'openai'
import { env } from '../env.js'

let openaiClient: OpenAI | null = null
function getClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  return openaiClient
}

const MODEL = 'gpt-4o-mini' // cheap + fast, good enough for this domain

// Starter category set — used as PROMPT EXAMPLES (not a strict whitelist).
// AI is free to invent new labels for transactions that don't fit these neatly,
// e.g. "Káva", "Auto-servis", "Lieky", "Streaming". Users can also rename
// categories manually in the UI (combobox accepts any label up to 60 chars).
export const CATEGORIES = [
  'Potraviny',
  'Reštaurácie a kaviarne',
  'Tankovanie',
  'Auto a doprava',
  'Bývanie',
  'Energie',
  'Telekomunikácie',
  'Zdravie',
  'Oblečenie',
  'Zábava',
  'Predplatné',
  'Príjem',
  'Výber z bankomatu',
  'Prevody medzi účtami',
  'Splátky a úvery',
  'Poistenie',
  'Iné',
] as const
/** Category is now any short Slovak string up to 60 chars. */
export type Category = string

const CATEGORY_MAX_LEN = 60

// ---------------- CATEGORIZATION ----------------

export interface TxToCategorize {
  id: number
  date: string
  note: string
  amount: number // signed
  type: 'prijem' | 'vydavok'
}

export interface CategorizedTx {
  id: number
  category: Category
  confidence: number // 0..1
}

/** Rule-based fallback that runs in dev when no OPENAI_API_KEY is set. */
function ruleBased(tx: TxToCategorize): CategorizedTx {
  const note = tx.note.toLowerCase()
  if (tx.type === 'prijem') {
    if (/mzda|výplata|vyplata|salary|payroll|dividend/i.test(note))
      return { id: tx.id, category: 'Príjem', confidence: 0.85 }
    return { id: tx.id, category: 'Príjem', confidence: 0.5 }
  }
  // Výdavky — heuristics
  const map: Array<[RegExp, Category, number]> = [
    [/(slovnaft|omv|shell|orlen|jurki|petrol|čerpacia|cerpacia)/i, 'Tankovanie', 0.95],
    [/(kaufland|lidl|tesco|billa|coop|terno|fresh\b|hypermarket)/i, 'Potraviny', 0.95],
    [/(mcdonald|kfc|burger|pizza|wolt|bolt food|bistro|reštauráci|restaurac|kaviar|coffee|starbucks|kebab|sushi|gastro)/i, 'Reštaurácie a kaviarne', 0.9],
    [/(netflix|spotify|apple|google|youtube|microsoft|adobe|notion|figma|github|slack|chatgpt|openai|cursor)/i, 'Predplatné', 0.92],
    [/(bolt\b|uber|hopin|taxi|mhd|sad|zssk|lístok|vlak)/i, 'Auto a doprava', 0.88],
    [/(o2|orange|telekom|4ka|vodafone|antik|swan|metronet|internet)/i, 'Telekomunikácie', 0.9],
    [/(stredoslovenská|sse|spp|vse|zse|elektrina|plyn|voda|energie|ssb)/i, 'Energie', 0.9],
    [/(dr.?max|lekáreň|lekaren|apotek|lekár|lekar|nemocnic|topdoktor|etabletka)/i, 'Zdravie', 0.85],
    [/(zara|h&m|hm\b|reserved|c&a|primark|nike|adidas|oblečenie|obuv|footshop)/i, 'Oblečenie', 0.85],
    [/(výber|vyber|bankomat|atm)/i, 'Výber z bankomatu', 0.95],
    [/(splátka|splatka|úver|uver|hypotéka|hypoteka|sporopay)/i, 'Splátky a úvery', 0.8],
    [/(poistenie|alianz|allianz|generali|kooperativa|insurance)/i, 'Poistenie', 0.92],
    [/(byt|bytový|spravca|fond opráv|nájom|najom)/i, 'Bývanie', 0.85],
    [/(kino|divadlo|aquapark|aqualand|wellness|spa|park|múzeum|muzeum|funicular|ticket|book|concert)/i, 'Zábava', 0.7],
  ]
  for (const [re, cat, conf] of map) {
    if (re.test(note)) return { id: tx.id, category: cat, confidence: conf }
  }
  return { id: tx.id, category: 'Iné', confidence: 0.3 }
}

const SYSTEM_PROMPT = `Si finančný asistent appky "Nula na účte". Tvoja jediná úloha: pri každej transakcii navrhnúť stručný slovenský label kategórie podľa toho čo v popise skutočne vidíš.

Pravidlá:
- Vráť LEN platný JSON: {"items":[{"id":1,"category":"Potraviny","confidence":0.95}, ...]}
- "category" = 1–3 slová po slovensky, prvé písmeno veľké (napr. "Potraviny", "Káva", "Auto-servis", "Streaming", "Mzda", "Bankomat"). Max 50 znakov.
- "confidence" = číslo 0..1.
- Buď KONZISTENTNÝ: rovnaký obchod / podobné transakcie → rovnaký label v celej dávke.
- Ak si si naozaj nie istý → "Iné" s confidence pod 0.4.
- Ignoruj ID ktoré nemáš v inpute.
- Žiadny iný text mimo JSON, žiadny markdown, žiadne komentáre.

Príklady labelov (môžeš použiť aj vlastné podobné):
Potraviny, Reštaurácie, Káva, Tankovanie, Auto, MHD/Taxi, Mobil/Internet, Energie, Voda, Lieky, Lekár, Drogéria, Oblečenie, Zábava, Streaming, Hra/Aplikácia, Knihy, Šport, Cestovanie, Hotel, Letenka, Parkovanie, Dovolenka, Wellness, Bývanie/Nájom, Poistenie, Splátka úveru, Hypotéka, Mzda, Bonus, Dividenda, Refundácia, Bankomat, Prevod, Poplatok, Sporenie, Investícia, Charita, Darček, Vzdelávanie, Domov, Záhrada, Iné.

Heuristiky:
- Tesco/Lidl/Kaufland/Billa/COOP/Terno → Potraviny
- McDonald/KFC/Wolt/Bolt Food/pizza/bistro → Reštaurácie (alebo špecifickejšie ak vieš: "Pizza", "Sushi")
- Starbucks/kaviareň/cafe → Káva
- Slovnaft/OMV/Shell/Orlen → Tankovanie
- Bolt/Uber/taxi → MHD/Taxi
- O2/Orange/Telekom/4ka → Mobil/Internet
- SSE/SPP/VSE/ZSE → Energie
- Dr.Max/Lekáreň → Lieky
- Netflix/Spotify/HBO/Apple Music → Streaming
- Adobe/GitHub/Figma/Notion/ChatGPT → Aplikácia
- Mzda/výplata → Mzda; Dividenda → Dividenda
- Výber/bankomat/ATM → Bankomat
- Splátka hypotéky → Hypotéka; iný úver → Splátka úveru
- Allianz/Generali/Kooperativa → Poistenie`

// Tunable — gpt-4o-mini handles 25 items per call comfortably in ~2-3s.
// 6 batches × 25 = 150 transactions in ~4-6s wall-clock when parallelized.
const BATCH_SIZE = 25
// Cap on parallel OpenAI calls to avoid hitting rate limits.
const MAX_PARALLEL = 6

/** Single OpenAI call for one batch. Returns nulls for items it couldn't categorize. */
async function aiCategorizeOne(
  client: OpenAI,
  batch: TxToCategorize[],
): Promise<{ items: CategorizedTx[]; tokens: number }> {
  const minimal = batch.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Math.abs(t.amount),
    note: t.note.slice(0, 120),
  }))
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: Math.min(2000, 60 * batch.length),
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Priraď kategóriu ku každej z týchto transakcií:\n${JSON.stringify(minimal)}`,
      },
    ],
  })
  const raw = res.choices[0]?.message?.content ?? '{"items":[]}'
  const parsed = JSON.parse(raw) as { items?: Array<{ id?: number; category?: string; confidence?: number }> }
  const items: CategorizedTx[] = []
  if (Array.isArray(parsed.items)) {
    for (const it of parsed.items) {
      if (typeof it.id !== 'number') continue
      if (typeof it.category !== 'string') continue
      // Sanity-check the label: trim, cap length, reject empties / weird stuff
      const cat = it.category.trim().replace(/\s+/g, ' ').slice(0, CATEGORY_MAX_LEN)
      if (!cat || cat.length < 2) continue
      // Capitalize first letter for consistency
      const normalized = cat.charAt(0).toUpperCase() + cat.slice(1)
      const conf = typeof it.confidence === 'number' ? Math.max(0, Math.min(1, it.confidence)) : 0.5
      items.push({ id: it.id, category: normalized, confidence: conf })
    }
  }
  return { items, tokens: res.usage?.total_tokens ?? 0 }
}

/**
 * Categorizes a batch of transactions. Uses GPT-4o-mini if OPENAI_API_KEY is set,
 * otherwise falls back to rule-based matching (works offline).
 *
 * Splits large input into ~25-item chunks and runs up to MAX_PARALLEL in parallel.
 * Falls back to rule-based for any chunk that fails.
 */
export async function categorizeBatch(
  txs: TxToCategorize[],
): Promise<{ items: CategorizedTx[]; usedAI: boolean; tokens?: number }> {
  if (txs.length === 0) return { items: [], usedAI: false }

  const client = getClient()
  if (!client) {
    return { items: txs.map(ruleBased), usedAI: false }
  }

  // Split into chunks
  const chunks: TxToCategorize[][] = []
  for (let i = 0; i < txs.length; i += BATCH_SIZE) {
    chunks.push(txs.slice(i, i + BATCH_SIZE))
  }

  // Run with concurrency cap
  const results: Array<{ items: CategorizedTx[]; tokens: number; failed?: TxToCategorize[] }> = []
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL) {
    const slice = chunks.slice(i, i + MAX_PARALLEL)
    const settled = await Promise.allSettled(slice.map((c) => aiCategorizeOne(client, c)))
    settled.forEach((s, idx) => {
      if (s.status === 'fulfilled') {
        results.push(s.value)
      } else {
        console.error(
          '[ai] chunk failed, will use rule-based for',
          slice[idx].length,
          'items:',
          s.reason instanceof Error ? s.reason.message : s.reason,
        )
        results.push({ items: [], tokens: 0, failed: slice[idx] })
      }
    })
  }

  // Merge results + apply rule-based fallback for any tx not covered
  const aiItems: CategorizedTx[] = []
  let totalTokens = 0
  const coveredIds = new Set<number>()
  for (const r of results) {
    totalTokens += r.tokens
    for (const it of r.items) {
      aiItems.push(it)
      coveredIds.add(it.id)
    }
  }

  // Anything that AI missed → rule-based
  const fallbackItems: CategorizedTx[] = []
  for (const t of txs) {
    if (!coveredIds.has(t.id)) {
      fallbackItems.push(ruleBased(t))
    }
  }

  const allItems = [...aiItems, ...fallbackItems]
  // usedAI true iff at least one item came from AI
  return { items: allItems, usedAI: aiItems.length > 0, tokens: totalTokens }
}

// ---------------- RAUL RECOMMENDATIONS ----------------

export interface SpendingSummaryInput {
  monthLabel: string // e.g. "Apríl 2026"
  totalIncome: number
  totalExpense: number
  topCategories: Array<{ category: string; total: number; count: number }>
  changeVsLast: Array<{ category: string; delta: number; pct: number }> // delta = current - last
  largestTransactions: Array<{ note: string; amount: number; date: string; category: string }>
}

const RAUL_PROMPT = `Si Raul Rodriguez — sympatický, mierne sarkastický finančný kamarát so cigarou v ruke a slovinskou vychovou. Hovoríš po slovensky, hravo, jemne magicky/harrypotterovsky, ale ZÁSADNE NIKDY neradíš investície, úvery alebo poistenie. Iba pozeráš na míňanie a navrhuješ ako utiahnuť opasok bez toho aby si znel ako zúrivý kazateľ.

Štýl:
- Krátko, 4-6 odrážok max
- Konkrétne sumy a kategórie z dát
- Jeden-dva vtipy max, žiadny moralizmus
- Občas odkáž na "Raula", "galeóny", "Apparátora", "dementora", "Wolt nie je člen domácnosti"
- Slovenčina

NIKDY NEROB:
- finančné rady (investície, úvery, poistenia)
- diagnostika "máte problém", "musíte"
- príkazy v 2. osobe ("musíš", "máš")
- emoji bombu (max 1-2 v celej odpovedi)

Vráť LEN markdown text. Žiadne JSON, žiadny komentár navyše.`

/**
 * Generates Raul's recommendations as markdown for a given month.
 * Falls back to a deterministic stub if no OPENAI_API_KEY.
 */
export async function generateRecommendations(
  input: SpendingSummaryInput,
): Promise<{ content: string; usedAI: boolean }> {
  const client = getClient()
  if (!client) {
    return { content: stubRecommendations(input), usedAI: false }
  }

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        { role: 'system', content: RAUL_PROMPT },
        {
          role: 'user',
          content: `Mesiac: ${input.monthLabel}
Príjmy: ${input.totalIncome.toFixed(0)} €
Výdavky: ${input.totalExpense.toFixed(0)} €
Bilancia: ${(input.totalIncome - input.totalExpense).toFixed(0)} €

Top kategórie výdavkov:
${input.topCategories.map((c) => `- ${c.category}: ${c.total.toFixed(0)} € (${c.count}×)`).join('\n')}

Zmena oproti predošlému mesiacu:
${
  input.changeVsLast.length === 0
    ? '(žiadne dáta z predošlého mesiaca)'
    : input.changeVsLast
        .map((c) => `- ${c.category}: ${c.delta > 0 ? '+' : ''}${c.delta.toFixed(0)} € (${c.pct > 0 ? '+' : ''}${c.pct.toFixed(0)} %)`)
        .join('\n')
}

Najväčšie jednotlivé transakcie:
${input.largestTransactions.map((t) => `- ${t.date} · ${t.note} · ${t.amount.toFixed(0)} € (${t.category})`).join('\n')}

Vyrob krátky komentár v Raulovom štýle.`,
        },
      ],
    })
    const content = (res.choices[0]?.message?.content ?? '').trim()
    if (!content) return { content: stubRecommendations(input), usedAI: false }
    return { content, usedAI: true }
  } catch (e) {
    console.error('[ai] raul failed, falling back to stub:', e instanceof Error ? e.message : e)
    return { content: stubRecommendations(input), usedAI: false }
  }
}

function stubRecommendations(input: SpendingSummaryInput): string {
  const top = input.topCategories[0]
  const bilancia = input.totalIncome - input.totalExpense
  const lines: string[] = []
  lines.push(`**Raul si pozrel ${input.monthLabel}** (offline mód, žiadny AI):`)
  lines.push('')
  if (bilancia >= 0) {
    lines.push(`- Bilancia ${bilancia.toFixed(0)} € v pluse — Apparátor sa neusmieva, ale ani nezúri.`)
  } else {
    lines.push(`- Bilancia ${bilancia.toFixed(0)} € v mínuse. Apparátor zdvihol obočie.`)
  }
  if (top) {
    lines.push(`- Najviac galeónov spadlo do **${top.category}** (${top.total.toFixed(0)} €, ${top.count} pohybov).`)
  }
  for (const c of input.changeVsLast.slice(0, 2)) {
    if (Math.abs(c.pct) >= 20) {
      lines.push(
        `- **${c.category}** ${c.pct > 0 ? 'vystrelilo' : 'kleslo'} o ${Math.abs(c.pct).toFixed(0)} % oproti minulému mesiacu.`,
      )
    }
  }
  lines.push('')
  lines.push(
    '_Pre živé Raulove odporúčania nastav `OPENAI_API_KEY` v env. Toto je len ukážka._',
  )
  return lines.join('\n')
}
