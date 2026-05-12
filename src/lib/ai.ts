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
  /**
   * AI-extracted merchant identifier (e.g. "Tesco", "BTS Airport", "Slovnaft").
   * Cleaner than the raw note — usable for display, grouping, and as a stable
   * rule key (multiple notes from the same chain → same merchant → same rule).
   * Empty string if AI couldn't extract one.
   */
  merchant: string
}

/**
 * Best-effort merchant guess from the raw note when AI is unavailable.
 * Picks the first run of "wordy" uppercase letters after stripping the usual
 * bank prefixes — works ~80 % of the time for SK PDFs.
 */
function guessMerchantFromNote(note: string): string {
  if (!note) return ''
  let s = note
    // Drop common SK bank prefixes
    .replace(/^(platba kartou|platba|prevod (z|na|na účet)|úhrada|inkaso)/i, '')
    // Drop dates/times/refs/amounts
    .replace(/\b\d{2}[./-]\d{2}([./-]\d{2,4})?\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
    .replace(/\b(ref|vs|ks|ss)[:.]? ?\d+/gi, ' ')
    .replace(/\b\d+[.,]\d{2} ?(eur|€|czk|usd)?\b/gi, ' ')
    .trim()
  // Take the first meaningful word/two — usually the merchant name in caps.
  const m = s.match(/[A-Za-zÀ-žÄ-ž][\wÀ-žÄ-ž.\-&]{1,30}(?: [A-Za-zÀ-žÄ-ž][\wÀ-žÄ-ž.\-&]{1,20})?/)
  if (!m) return ''
  return m[0].slice(0, 40).trim()
}

/** Rule-based fallback that runs in dev when no OPENAI_API_KEY is set. */
function ruleBased(tx: TxToCategorize): CategorizedTx {
  const note = tx.note.toLowerCase()
  const merchant = guessMerchantFromNote(tx.note)
  if (tx.type === 'prijem') {
    if (/mzda|výplata|vyplata|salary|payroll|dividend/i.test(note))
      return { id: tx.id, category: 'Príjem', confidence: 0.85, merchant }
    return { id: tx.id, category: 'Príjem', confidence: 0.5, merchant }
  }
  // Výdavky — heuristics (more specific patterns FIRST, broader ones later)
  const map: Array<[RegExp, Category, number]> = [
    // Auto a doprava (rozdelené detailnejšie)
    [/(slovnaft|omv|shell|orlen|mol\b|jurki|lukoil|petrol|čerpacia|cerpacia)/i, 'Tankovanie', 0.95],
    [/(carwash|car.?wash|autoumyvar|autoumýv|umyvar|umýv|myčka|myjka|wash\b)/i, 'Auto', 0.92],
    [/(stk\b|emisn|pneuservis|pneumatik|autoservis|autodiel|auto[- ]?salón|servis vozid)/i, 'Auto', 0.9],
    [/(parkov|parking|parkomat|easypark|spark\b)/i, 'Parkovanie', 0.92],
    // Airport-as-merchant (BTS.AERO, KSC.AERO, ".aero" domain, AIRPORT in name)
    [/(bts\.aero|ksc\.aero|prg\.aero|vie\.aero|\.aero\b|airport)/i, 'Parkovanie', 0.78],
    [/(diaľničná známka|eds\b|emýto|mýto|emyto)/i, 'Auto', 0.9],
    [/(tesla supercharger|ionity|nabíjacie|nabíjacia stanica)/i, 'Auto', 0.88],
    [/(bolt\b|uber|hopin|taxi|liftago)/i, 'MHD a Taxi', 0.9],
    [/(mhd|sad\b|zssk|imhd|dpb\b|dpmb|lístok na vlak|cestovný lístok)/i, 'MHD a Taxi', 0.88],
    // Jedlo a nápoje
    [/(kaufland|lidl|tesco|billa|coop|terno|fresh\b|yeme|hypermarket)/i, 'Potraviny', 0.95],
    [/(mcdonald|kfc|burger king|wolt|bolt food|foodora|pizza|bistro|reštauráci|restaurac|kebab|sushi|gastro)/i, 'Reštaurácie', 0.9],
    [/(starbucks|costa coffee|coffeeshop|kaviar|espresso|coffee\b|café|cafe\b)/i, 'Káva', 0.9],
    // Bývanie a energie
    [/(stredoslovensk|sse\b|spp\b|vse\b|zse\b|elektrina|plyn|energie|ssb\b)/i, 'Energie', 0.9],
    [/(vodárne|vvs\b|bvs\b|vodné|stočné)/i, 'Voda', 0.9],
    [/(nájom|najom|bytové družstvo|spravca|fond opráv|svb\b)/i, 'Bývanie', 0.85],
    [/(ikea|mömax|momax|asko\b|möbelix|mobelix|jysk|kika)/i, 'Domácnosť', 0.85],
    [/(hornbach|obi\b|bauhaus|záhradníctvo|zahradnictvo)/i, 'Záhrada', 0.8],
    // Telekom a digital
    [/(o2 slovakia|orange|telekom|4ka|vodafone|antik|swan|metronet)/i, 'Mobil a Internet', 0.9],
    [/(netflix|spotify|hbo max|apple music|disney\+|youtube premium)/i, 'Streaming', 0.95],
    [/(adobe|github|figma|notion|chatgpt|openai|cursor|anthropic|slack|microsoft 365|google one|icloud)/i, 'Aplikácia', 0.92],
    // Zdravie a krása
    [/(dr.?max|lekáreň|lekaren|apotek|benu\b|pilulka)/i, 'Lieky', 0.92],
    [/(topdoktor|nemocnic|klinik|doktor|stomatológ|stomatolog|zubár|zubar)/i, 'Lekár', 0.88],
    [/(\bdm\b|rossmann|teta drogeria|drogéria|drogeria|notino)/i, 'Drogéria', 0.88],
    // Oblečenie a nákupy
    [/(zara\b|h&m|\bhm\b|reserved|c&a|primark|nike|adidas|about you|zalando|footshop|intersport)/i, 'Oblečenie', 0.85],
    [/(alza|datart|\bnay\b|mediamarkt|mall\.sk|mall sk|electroworld)/i, 'Elektronika', 0.85],
    // Zábava, šport, cestovanie
    [/(kino|cinemax|cinestar|divadlo|múzeum|muzeum|aquapark|aqualand|wellness|spa\b|koncert|ticketportal|funicular)/i, 'Zábava', 0.8],
    [/(fitness|\bgym\b|bazén|sauna|crossfit|decathlon)/i, 'Šport', 0.82],
    [/(booking\.com|booking com|airbnb|hotel|hostel)/i, 'Hotel', 0.88],
    [/(ryanair|wizz air|eurowings|\blot\b|lufthansa|kiwi\.com|letenk)/i, 'Letenka', 0.9],
    // Finančné operácie
    [/(výber|vyber|bankomat|\batm\b|cash withdraw)/i, 'Bankomat', 0.95],
    [/(prevod medzi účt|internal transfer|interný prevod|interny prevod)/i, 'Prevod', 0.9],
    [/(bankový poplatok|bankovy poplatok|mesačný poplatok|fee\b)/i, 'Poplatok', 0.85],
    [/(splátka hypotéky|splatka hypoteky|hypotéka|hypoteka|sporopay)/i, 'Hypotéka', 0.88],
    [/(splátka|splatka|úver|uver|spotrebný)/i, 'Splátka úveru', 0.78],
    [/(allianz|alianz|generali|kooperativa|uniqa|wüstenrot|wustenrot|poistenie|insurance)/i, 'Poistenie', 0.92],
    // Knihy, vzdelávanie, charita
    [/(martinus|panta rhei|amazon book|knihkupectvo)/i, 'Knihy', 0.88],
    [/(udemy|coursera|edx\b|kurz|škola|skola|univerzit)/i, 'Vzdelávanie', 0.78],
    [/(unicef|červený kríž|cerveny kriz|charita|dobročinnosť|dobrocinnost)/i, 'Charita', 0.9],
  ]
  for (const [re, cat, conf] of map) {
    if (re.test(note)) return { id: tx.id, category: cat, confidence: conf, merchant }
  }
  return { id: tx.id, category: 'Iné', confidence: 0.3, merchant }
}

const SYSTEM_PROMPT = `Si finančný asistent appky "Nula na účte". Tvoja jediná úloha: pri každej transakcii ROZHODNE priradiť slovenský label kategórie podľa toho čo v popise skutočne vidíš.

ZÁKLADNÉ PRAVIDLÁ:
- Vráť LEN platný JSON: {"items":[{"id":1,"merchant":"Tesco","category":"Potraviny","confidence":0.95}, ...]}
- "merchant" = vyčistený názov obchodu/firmy (1–3 slová), tak ako by ho užívateľ rozpoznal: "Tesco", "BTS Airport", "Slovnaft", "Bolt", "Mzda", "Netflix". Bez prefixov "PLATBA KARTOU", bez ref čísel, bez dátumov. Max 40 znakov.
- "category" = 1–3 slová po slovensky, prvé písmeno veľké (max 50 znakov).
- "confidence" = 0..1.
- Buď KONZISTENTNÝ: rovnaký obchod / podobné transakcie → rovnaký merchant + rovnaký label v celej dávke.
- Ignoruj ID ktoré nemáš v inpute.
- Žiadny iný text mimo JSON, žiadny markdown, žiadne komentáre.

MERCHANT EXTRAKCIA — myšlienkový postup:
1. Pozri sa na celý note. Strip "Platba kartou", "Prevod z účtu", dátum, ref/VS čísla, sumu.
2. Čo ostane = názov obchodu alebo služby. Napr.:
   - "Platba kartou TESCO PETRZALKA 12.34 EUR 04.05" → merchant: "Tesco"
   - "PREVOD NA ÚČET 04.05 BTS.AERO 6.00 EUR REF:12345" → merchant: "BTS Airport"
   - "STARBUCKS BRATISLAVA" → merchant: "Starbucks"
   - "Platba O2 SLOVAKIA mes.poplat." → merchant: "O2"
   - "MZDA OD BOOSTERS sro 04/26" → merchant: "Boosters"
3. Normalizuj na ČISTÉ obchodné meno. Bez lokality, bez "kartou", bez "platba".
4. Ak je to neidentifikovateľné → merchant: "" (prázdny string).

Pravidlo: rovnaký obchod v rôznych mestách (Tesco Petržalka, Tesco Bratislava) musí mať RÔVNAKÝ merchant ("Tesco"). To umožňuje appke pamätať si tvoju kategorizáciu naprieč pobočkami.

DÔLEŽITÉ — KATEGÓRIA "Iné" JE POSLEDNÁ MOŽNOSŤ:
- "Iné" používaj IBA ak naozaj absolútne nemáš ako pochopiť čo to je (napr. iba "Platba kartou 12.34 EUR" bez žiadneho ďalšieho kontextu).
- Vo väčšine prípadov sa dá uhádnuť aspoň HRUBÁ kategória aj z malého náznaku v popise (názov obchodu, mesto, typ služby).
- Ak vidíš v popise akýkoľvek názov obchodu, služby alebo aktivity → priraď konkrétnu kategóriu, NIE "Iné".
- Confidence pre "Iné" musí byť ≤ 0.3 (ostatné labely môžu mať 0.5–0.95).

PREMÝŠĽAJ V KROKOCH:
1. Aký obchod/služba/aktivita je v popise (aj len úryvok stačí)?
2. Do akej životnej oblasti to patrí (jedlo, doprava, bývanie, zdravie, voľný čas, predplatné, finančné operácie)?
3. Vyber najkonkrétnejší label pre tú oblasť.

ŠTANDARDNÉ KATEGÓRIE (preferuj tieto, lebo zachovávajú konzistenciu):
Potraviny, Reštaurácie, Káva, Tankovanie, Auto, Parkovanie, MHD a Taxi, Mobil a Internet, Energie, Voda, Lieky, Lekár, Drogéria, Oblečenie, Elektronika, Domácnosť, Zábava, Streaming, Aplikácia, Knihy, Šport, Cestovanie, Hotel, Letenka, Dovolenka, Wellness, Bývanie, Nájom, Poistenie, Splátka úveru, Hypotéka, Mzda, Bonus, Dividenda, Refundácia, Bankomat, Prevod, Poplatok, Sporenie, Investícia, Charita, Darček, Vzdelávanie, Záhrada, Deti, Domáce zvieratá, Iné.

POVINNÉ HEURISTIKY (sleduj presne):

JEDLO A NÁPOJE:
- Tesco/Lidl/Kaufland/Billa/COOP/Terno/Fresh/Yeme/Hypermarket → Potraviny
- McDonald/KFC/Burger King/Wolt/Bolt Food/Foodora/pizza/bistro/kebab/sushi/gastro/reštaurácia → Reštaurácie
- Starbucks/Costa/Coffeeshop/Kaviareň/Espresso/Coffee/Café → Káva

AUTO A DOPRAVA (široko):
- Slovnaft/OMV/Shell/Orlen/MOL/Jurki/Lukoil/Petrol/čerpacia → Tankovanie
- CarWash/autoumyváreň/umývanie/myčka/myjka → Auto
- STK/EK/emisná/servis/pneuservis/pneumatiky/autoservis/autodiel/Autosalón → Auto
- Parkovacie/Parking/Parkomat/EasyPark/SPARK/parkovanie → Parkovanie
- Bolt/Uber/Hopin/Taxi/Liftago → MHD a Taxi
- ZSSK/MHD/SAD/Lístok na vlak/imhd/dpb/dpmb → MHD a Taxi
- Diaľničná známka/eDS/eMýto/mýto → Auto
- Tesla supercharger/IONITY/nabíjacie/nabíjacia → Auto

BÝVANIE A ENERGIE:
- SSE/SPP/VSE/ZSE/Stredoslovenská energetika/Elektrina/Plyn → Energie
- Voda/Vodárne/VVS/BVS → Voda
- Nájom/Najom/Byt/Bytové družstvo/Správca/Fond opráv/SVB → Bývanie
- IKEA/Mömax/Asko/Möbelix/JYSK/Kika → Domácnosť
- Záhradníctvo/Hornbach/OBI/Bauhaus → Záhrada (alebo Domácnosť ak je to vidieť že je to DIY)

TELEKOM A DIGITAL:
- O2/Orange/Telekom/4ka/Vodafone/Antik/Swan/Metronet → Mobil a Internet
- Netflix/Spotify/HBO Max/Apple Music/Disney+/YouTube Premium → Streaming
- Adobe/GitHub/Figma/Notion/ChatGPT/OpenAI/Cursor/Anthropic/Slack/Microsoft 365/Google One/iCloud → Aplikácia

ZDRAVIE A KRÁSA:
- Dr.Max/Lekáreň/Apotek/Benu/Pilulka → Lieky
- Topdoktor/Nemocnica/Klinika/Doktor/Stomatológ/Zubár → Lekár
- DM/Rossmann/Teta/Drogéria → Drogéria

OBLEČENIE A NÁKUPY:
- Zara/H&M/HM/Reserved/C&A/Primark/Nike/Adidas/About You/Zalando/Footshop → Oblečenie
- Alza/Datart/Nay/MediaMarkt/Mall.sk/Notino → Elektronika (alebo špecifickejšie ak vidieť)

ZÁBAVA, ŠPORT, CESTOVANIE:
- Kino/Cinemax/CineStar/Divadlo/Múzeum/Aquapark/Aqualand/Wellness/Spa/Koncert/Ticketportal → Zábava
- Fitness/Gym/Bazén/Sauna/Crossfit/Decathlon (športové oblečenie) → Šport
- Booking.com/Airbnb/Hotel/Hostel → Hotel
- Ryanair/Wizz Air/Eurowings/LOT/Lufthansa/Letenky/Kiwi.com → Letenka

FINANČNÉ OPERÁCIE:
- Výber/Vyber/Bankomat/ATM/Cash → Bankomat
- Prevod/Prevod medzi účtami/Internal transfer → Prevod
- Poplatok/Bankový poplatok/Mesačný poplatok → Poplatok
- Splátka hypotéky/SporoPay/Hypoteka → Hypotéka; ostatné úvery/spotreba → Splátka úveru
- Allianz/Generali/Kooperativa/Uniqa/Wüstenrot/Insurance → Poistenie

PRÍJMY:
- Mzda/Výplata/Salary/Plat/Wage → Mzda
- Dividenda → Dividenda; Bonus/Odmena → Bonus; Refundácia → Refundácia

OSTATNÉ:
- Charita/Dobročinnosť/UNICEF/Červený kríž → Charita
- Škola/Univerzita/Kurz/Udemy/Coursera → Vzdelávanie
- Knihy/Martinus/Panta Rhei/Amazon Books → Knihy

KEĎ NEVIEŠ NA 100 %, ALE TUŠÍŠ:
- Stále urči konkrétnu kategóriu s nižšou confidence (0.4–0.6), NIE "Iné".
- Príklad: "Platba kartou — INTERSPORT BRATISLAVA 45 EUR" → Šport (conf 0.7), nie "Iné".
- Príklad: "Platba — CARWASH PETRZALKA 6 EUR" → Auto (conf 0.95), nie "Iné".

KÓDY A SKRATKY — vždy ich dekóduj, nehoď ich do "Iné":
- **IATA letiskové kódy 3 písmen** (BTS, KSC, PRG, VIE, BUD, MUC, FRA, LHR, CDG, JFK...) → ide o letisko. Ak je v note "BTS.AERO" alebo "BTS PARKING" alebo "Bratislava Airport" → **Parkovanie** alebo **Letenka** podľa kontextu (parking/aero/garage → Parkovanie, ticket/airline → Letenka).
- **ICAO kódy 4 písmen** (LZIB, EDDF...) → letisko, viď vyššie.
- **Stanice / autobusové firmy** (RegioJet, Leo Express, Flixbus, SAD Bratislava, RegioBus, GVD) → MHD a Taxi alebo Cestovanie.
- **Mýto a diaľničné** (eMÝTO, eDS, MYTO CZ, ASFINAG, Toll Collect, Verkehrsbüro) → Auto.
- **Doménové sufixy ako ".sk", ".cz", ".com", ".aero"** ti môžu napovedať odvetvie (.aero = letectvo).
- **Reťazce s podstatným menom v názve** (napr. "PARKING", "GARAGE", "STATION", "AIRPORT", "HOTEL", "GAS", "PHARMACY", "RESTAURANT") sú silné indikátory — riaď sa nimi.
- **Geografické skratky** (BA, BTS, KE, PO, ZA...) sú slovenské mestá, sami o sebe ti netreba, ale spolu so slovom (napr. "BA PARKING") to dáva istotu.
- Príklad: "BTS.AERO" → Parkovanie (parkovanie na letisku BTS = Bratislava); conf 0.85.
- Príklad: "Platba kartou KSC AIRPORT" → Parkovanie alebo Letenka (podľa sumy: malá = parking, veľká = letenka); conf 0.7.
- Príklad: "ASFINAG SERVICE" → Auto (mýto v Rakúsku); conf 0.9.

KONTEXT POMÁHA — pozri si sumu:
- < 5 € → typicky parkovanie, káva, MHD lístok, drobnosť.
- 5–25 € → reštaurácia, drogéria, kniha.
- 25–100 € → potraviny týždeň, oblečenie, lieky.
- 100–500 € → nákup väčší (elektronika, mesačné potraviny), tankovanie pre veľké auto.
- > 500 € → veľký nákup, hypotéka, letenka, dovolenka.

Nie je to pravidlo, ale signál ktorý môžeš použiť keď text v note je nejasný.`

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
  const parsed = JSON.parse(raw) as {
    items?: Array<{ id?: number; category?: string; confidence?: number; merchant?: string }>
  }
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
      // Merchant — optional. Normalise: trim, collapse whitespace, cap at 40 chars.
      let merchant = ''
      if (typeof it.merchant === 'string') {
        merchant = it.merchant.trim().replace(/\s+/g, ' ').slice(0, 40)
      }
      items.push({ id: it.id, category: normalized, confidence: conf, merchant })
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

const RAUL_PROMPT = `Si **Raul Rodriguez** — skúsený osobný finančný manažér s 15-ročnou praxou. Hovoríš slovensky, priamo, konkrétne, s ľahkou dávkou suchého humoru (cigara v ruke, mierne sarkastický, ale rešpektujúci). Pre ľahšiu náladu občas pridáš drobný čarodejnícky odkaz ("galeóny", "Apparátor", "Wolt nie je člen domácnosti"), ale to je len korenie — primárne si profesionál.

TVOJA ÚLOHA:
Pozri sa na mesačné výdavky používateľa ako keby si robil financial review pre klienta. Vypichni TOP 3 KONKRÉTNE odporúčania ktoré majú reálnu šancu mu ušetriť peniaze tento alebo budúci mesiac.

ŠTÝL VÝSTUPU (presne dodržuj):
1. Krátky úvod (1-2 vety) — zhrň najdôležitejší pattern ktorý si videl.
2. Sekcia **"Top 3 odporúčania:"** ako očíslovaný zoznam (1./2./3.), každé:
   - **Tučný nadpis odporúčania** (3-6 slov, akčný).
   - 1-2 vety s konkrétnymi sumami z dát + jasná akcia "skús ...", "zváž ...", "obmedz ...".
   - Odhadovaná úspora ak je rozumne odhadnuteľná: "Potenciál: ~X € / mesiac".
3. Krátky záver (1 veta) — pozitívny tón alebo nemorálne pozorovanie.

PRAVIDLÁ:
- ZÁKLAD pre odporúčania = reálne dáta v inpute (kategórie, sumy, zmeny vs. minulý mesiac, najväčšie transakcie). NIE generické rady "začnite si robiť rozpočet".
- Priorita odporúčaní: (a) kategórie s najväčším medzimesačným nárastom, (b) zbytočné výdavky (Wolt, Bolt Food, kaviarne, predplatné), (c) veľké jednorazové transakcie ktoré sa dajú odložiť.
- Ak chýbajú dáta z minulého mesiaca, prac len s aktuálnym mesiacom — neproznostikuj.
- Konkretizuj: "Wolt 240 € / mesiac → varenie aspoň 3× / týždeň ušetrí ~120 €" je dobré. "Šetri viac" je zlé.
- BUĎ KRITICKÝ ale KONŠTRUKTÍVNY: vyhýbaj sa moralizmu, ale neboj sa nazvať vec pravým menom.
- Smieš robiť rady ako finančný manažér (rozpočet, kategórie výdavkov, prioritizácia, sporenie z bilancie). NEROBÍŠ konkrétne investičné rady (akcie/ETF), ani poistné/úverové produkty — to nech rieši licencovaný poradca.

FORMÁT:
- Slovenčina, markdown (tučné, kurzíva, zoznamy).
- Žiadny JSON, žiadny preambul typu "Tu je tvoja analýza".
- Max 2 emoji v celej odpovedi.`

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

// ---------------- CLIPPY TIPS ----------------
//
// Short, witty one-liner tips for the floating mascot. Driven by the same
// input as Raul recommendations but with a different prompt — output is a
// flat array of plain strings, no markdown, no numbering. Each tip ≤ 100
// chars. Used by RaulClippy in the corner.

const CLIPPY_PROMPT = `Si Raul Rodriguez — finančný manažér s cigarou. Tvoja úloha: vyplodiť presne 12 ULTRA-KRÁTKYCH tipov založených na dátach používateľa.

ŠTÝL:
- Suchý sarkazmus, mierne sebavedomé, ale BEZ moralizovania.
- Konkrétne sumy a názvy obchodov z dát, NIE generické fráze.
- 1 veta = 1 tip. Max 100 znakov. Ideálne 60-80.
- Slovenčina.
- Občas pridaj odkaz na "galeóny", "Apparátora", "dementora", "Wolt nie je člen rodiny".
- Max 1 emoji na tip, použi zriedkavo a strategicky (✦ 🍕 🚗 ⚡).
- NEPÍŠ "tip:", "rada:", "odporúčam:". Iba samotná veta.

PRAVIDLÁ:
- Vráť LEN JSON: {"tips": ["...","...",...]}
- Presne 12 tipov. Ani menej, ani viac.
- ŽIADNE čísla, ŽIADNE odrážky.
- Žiadne investičné rady (akcie, ETF). Žiadne úvery, poistenia.
- Buď KONKRÉTNY — ak vidíš v dátach "Tesco 187 €", spomeň to.
- Mix 4 typov tipov:
  1. Pozorovanie + úspora ("Wolt 240 € — varenie 3x týždeň = ~120 € späť")
  2. Sarkastické zhrnutie ("Káva za 87 € mesačne. Si v Starbucks-e na obed?")
  3. Pochvala ak je čo pochváliť ("Bilancia +312 € — Apparátor sa skoro usmial.")
  4. Drobná akčná výzva ("Pretrieď tých 23 nezaradených v /vydavky.")
- Kontextové vtipy: ak vidíš nezvyčajné kategórie / sumy, ťahaj z nich.

PRÍKLADY GOOD (drž sa tohto vibe):
- "Wolt 240 €. Varenie 3× týždeň = 120 € späť. Voda + ryža netreba PIN."
- "Káva 87 € za mesiac. 12 dní úvodzoviek do dôchodku."
- "Tesco 187 €. Lidl by ti vrátil 30 €. Galeóny netiekli — utiekli."
- "Bilancia +423 €. Apparátor zdvihol obočie — pozitívne."
- "Pretrieď 14 nezaradených v /vydavky. Bez nich aj Raul máta v hmle."
- "Auto-servis 380 € — buď pravidelne, alebo veľa naraz. Vyber si."
- "Streaming 47 €. Netflix + HBO + Disney+. Konzument storočia."`

export async function generateClippyTips(
  input: SpendingSummaryInput,
): Promise<{ tips: string[]; usedAI: boolean; tokens?: number }> {
  const client = getClient()
  if (!client) {
    return { tips: stubClippyTips(input), usedAI: false }
  }

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.85, // bump for personality variation across tips
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLIPPY_PROMPT },
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

Najväčšie transakcie:
${input.largestTransactions.map((t) => `- ${t.date} · ${t.note} · ${t.amount.toFixed(0)} € (${t.category})`).join('\n')}

Vyrob presne 12 krátkych vtipných tipov.`,
        },
      ],
    })
    const raw = res.choices[0]?.message?.content ?? '{"tips":[]}'
    const parsed = JSON.parse(raw) as { tips?: unknown }
    const tipsArr = Array.isArray(parsed.tips) ? parsed.tips : []
    const tips = tipsArr
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t.length > 5 && t.length <= 120)
      .slice(0, 15)
    if (tips.length === 0) return { tips: stubClippyTips(input), usedAI: false }
    return { tips, usedAI: true, tokens: res.usage?.total_tokens ?? 0 }
  } catch (e) {
    console.error(
      '[ai] clippy tips failed, using stub:',
      e instanceof Error ? e.message : e,
    )
    return { tips: stubClippyTips(input), usedAI: false }
  }
}

function stubClippyTips(input: SpendingSummaryInput): string[] {
  const bilancia = input.totalIncome - input.totalExpense
  const top = input.topCategories[0]
  const second = input.topCategories[1]
  const biggest = input.largestTransactions[0]
  const out: string[] = []
  out.push(
    bilancia >= 0
      ? `Bilancia ${bilancia.toFixed(0)} €. Apparátor sa skoro usmial.`
      : `Bilancia ${bilancia.toFixed(0)} €. Apparátor zdvihol obočie.`,
  )
  if (top) {
    out.push(`Top kategória: ${top.category} ${top.total.toFixed(0)} €. ${top.count}× pohyb.`)
  }
  if (second) {
    out.push(`${second.category} ${second.total.toFixed(0)} € — galeóny pekne tečú.`)
  }
  if (biggest) {
    out.push(`Najväčší výdavok: ${biggest.note} · ${biggest.amount.toFixed(0)} €.`)
  }
  for (const c of input.changeVsLast.slice(0, 3)) {
    out.push(
      `${c.category} ${c.pct > 0 ? '↑' : '↓'} ${Math.abs(c.pct).toFixed(0)} % oproti minulému mesiacu.`,
    )
  }
  out.push('Pre živé vtipné tipy nastav OPENAI_API_KEY. Toto je len ukážka.')
  return out
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
