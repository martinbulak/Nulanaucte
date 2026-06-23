# AI features

Three AI-powered surfaces, all using **OpenAI gpt-4o-mini**:

1. **Categorize** — auto-tag transactions with a Slovak category label + extract clean merchant name
2. **Raul recommendations** — long-form monthly financial review (top 3 actionable tips)
3. **Clippy tips** — 12 short witty one-liners for the floating mascot

All prompts live in [`src/lib/ai.ts`](../src/lib/ai.ts) and are designed to fall back gracefully when OpenAI is unreachable or `OPENAI_API_KEY` is missing.

---

## Model + cost

| Property | Value |
|---|---|
| Model | `gpt-4o-mini` |
| Input price | $0.15 per 1M tokens |
| Output price | $0.60 per 1M tokens |
| Typical categorize call (25 txs) | ~500 input + ~300 output = ~$0.00026 |
| Full categorize run (200 txs, 8 batches) | ~4000 input + ~2400 output = ~$0.002 |
| Raul recommendation | ~500 input + ~400 output = ~$0.0003 |
| Clippy tips (12) | ~500 input + ~700 output = ~$0.0005 |
| **Total month for one user** (1 import + 1 Raul) | **~$0.003** |

Annual cost per active user: **~$0.04**.

---

## Categorize (`POST /api/ai/categorize`)

### Flow

```
1. Fetch transactions to process
     - default: only those with categorizedBy='system' (untouched)
     - { force: true }: all except categorizedBy='user' (re-classify AI + system)
2. Load user's merchant_rules → apply locally:
     - rule by `merchant:<name>` (strongest signal)
     - rule by `iban:...` or normalised note key (fallback)
     - matched txs get their category copied from the rule, AI is skipped
3. For unmatched txs:
     - Split into 25-item batches, run up to 6 in parallel
     - Each batch → OpenAI with SYSTEM_PROMPT + JSON-mode response
     - AI returns { id, category, confidence, merchant } per tx
     - Failed batches fall back to rule-based regex matcher (offline-safe)
4. Persist:
     - Each tx: category + ai_confidence + categorizedBy='ai' + merchant
     - For high-confidence (≥0.7, not 'Iné') results: also upsert merchant_rules
       (note-key + merchant-key variants) so the next import skips AI
```

### SYSTEM_PROMPT (categorize)

Excerpt — full text in `src/lib/ai.ts`:

> Si finančný asistent appky "Nula na účte". Tvoja jediná úloha: pri každej transakcii ROZHODNE priradiť slovenský label kategórie...
>
> "Iné" je posledná možnosť — používaj iba ak naozaj absolútne nemáš ako pochopiť čo to je. Vo väčšine prípadov sa dá uhádnuť aspoň HRUBÁ kategória aj z malého náznaku v popise...
>
> [extensive heuristics: Tesco → Potraviny, McDonald → Reštaurácie, Slovnaft → Tankovanie, BTS.AERO → Parkovanie, ...]

### Rule-based fallback

If `OPENAI_API_KEY` is unset OR a batch fails, `ruleBased(tx)` runs regex matchers like:
```ts
[/(kaufland|lidl|tesco|billa|coop)/i, 'Potraviny', 0.95],
[/(slovnaft|omv|shell|orlen)/i, 'Tankovanie', 0.95],
[/(bts\.aero|airport|\.aero\b)/i, 'Parkovanie', 0.78],
// ...30+ patterns
```
Returns a `CategorizedTx` with `confidence` and a guessed `merchant`. Final fallback: `Iné` with confidence 0.3.

### Merchant rules — how memory works

When the user opens `/vydavky` and clicks on a category, the inline editor PATCHes the row AND upserts a `merchant_rules` entry:

```sql
INSERT INTO merchant_rules (user_id, key, category, source)
VALUES (42, 'tesco bratislava', 'Potraviny', 'user')
ON CONFLICT (user_id, key) DO UPDATE SET category = EXCLUDED.category, source = 'user';
```

If the tx already had an AI-extracted merchant, a `merchant:tesco` key gets upserted too — that's the **cross-store match**: next time the same chain shows up under any note text, the user's category applies.

User-sourced rules win over AI-sourced rules for the same key.

---

## Raul recommendations (`POST /api/ai/recommendations`)

### Flow

```
1. Fetch month transactions, build the SpendingSummaryInput:
     - monthLabel (e.g. "Apríl 2026")
     - totalIncome, totalExpense
     - topCategories[5] — sorted by spend desc, "Iné" filtered out
     - changeVsLast[4] — categories where |%change vs previous month| ≥ 20%
     - largestTransactions[4] — biggest individual expenses
2. Run generateRecommendations(input) → markdown content + usedAI flag
3. If usedAI === true: saveRecommendation(user, month, content)
   If false: don't cache; return stub with fallbackReason for the UI
4. Side-effect: generateClippyTips(input) with the SAME input
   - If clippy.usedAI === true: saveClippyTips(user, month, tips)
5. Return { content, usedAI, fallbackReason, clippyTips, clippyUsedAi, clippyFallbackReason }
```

### RAUL_PROMPT (excerpt)

> Si **Raul Rodriguez** — skúsený osobný finančný manažér s 15-ročnou praxou. Hovoríš slovensky, priamo, konkrétne, s ľahkou dávkou suchého humoru...
>
> ŠTÝL VÝSTUPU (presne dodržuj):
> 1. Krátky úvod (1-2 vety) — zhrň najdôležitejší pattern.
> 2. Sekcia **"Top 3 odporúčania:"** ako očíslovaný zoznam, každé:
>    - **Tučný nadpis** (3-6 slov, akčný)
>    - 1-2 vety s konkrétnymi sumami + jasná akcia
>    - "Potenciál: ~X € / mesiac" ak je odhadnuteľný
> 3. Krátky záver (1 veta)
>
> ZÁKAZ: investičné rady, úverové produkty, poistenia, moralizovanie.

### `fallbackReason` enum

Returned in API response when AI didn't actually run:
- `'no-key'` — `OPENAI_API_KEY` env var missing
- `'api-error'` — call threw (network, quota, invalid key, …); `errorDetail` in server logs
- `'empty-response'` — OpenAI returned blank content

The Raul panel UI shows a crimson warning banner with reason-specific guidance.

---

## Clippy tips (`GET /api/ai/clippy-tips`)

Short witty one-liners shown by the floating mascot bottom-right.

### Generation

Triggered as a **side effect** of `POST /api/ai/recommendations` (same OpenAI call burst as Raul, paid for once). Auto-backfill on first read: if user has a cached Raul rec but no clippy tips, GET endpoint generates them once and caches.

### CLIPPY_PROMPT (excerpt)

> Si Raul Rodriguez — finančný manažér s cigarou. Vyplodi presne 12 KRÁTKYCH tipov.
>
> ŠTÝL:
> - Suchý sarkazmus, mierne sebavedomé, BEZ moralizovania
> - Konkrétne sumy a názvy obchodov z dát
> - 1-2 vety = 1 tip. Max 200 znakov. Ideálne 120-180
> - Občas odkaz na "galeóny", "Apparátora", "Wolt nie je člen rodiny"
> - Max 1 emoji na tip, použi zriedkavo
>
> Vráť LEN JSON: {"tips": ["...", "...", ...]}

Examples baked into the prompt:
- "Wolt 240 €. Varenie 3× týždeň = 120 € späť. Voda + ryža netreba PIN."
- "Káva 87 € za mesiac. 12 dní úvodzoviek do dôchodku."
- "Tesco 187 €. Lidl by ti vrátil 30 €. Galeóny netiekli — utiekli."

### Rendering

`frontend/components/ui/RaulClippy.tsx` reads `/api/ai/clippy-tips`, runs a **typewriter effect** (35 ms / char), pauses 5 s after each tip, cycles forever. User can:
- Click avatar or bubble → skip to next tip
- Click × → silence for 7 days
- Switch mode to "mascot only" (no auto-rotation) or "off" in Settings

---

## Rate limiting

Three buckets per user, refilled hourly (see [`src/routes/ai.ts`](../src/routes/ai.ts)):

| Bucket | Limit/h | Endpoints |
|---|---|---|
| `ai-read` | 300 | `GET /api/ai/categories`, `GET /api/ai/recommendations`, `GET /api/ai/clippy-tips` |
| `ai-edit` | 200 | `PATCH /api/ai/transactions/:id/category` |
| `ai-expensive` | 20 | `POST /api/ai/categorize`, `POST /api/ai/recommendations` |

The expensive bucket caps user-bound OpenAI cost at ~$0.04/h worst case.

On 429: error response includes `code` (`RATE_LIMIT_READ`/`EDIT`/`AI`) so UI shows specific guidance.

---

## Cost guardrails

- **Stub fallback is never cached.** A failed OpenAI call shows the user a friendly stub but doesn't pollute DB. Next regenerate tries live.
- **Confident AI results become rules.** Future imports with same merchant skip OpenAI entirely.
- **User rules override AI.** No re-categorization burns tokens on transactions the user has manually fixed.
- **Cache is per (user, month).** Re-opening the dashboard for the same month is free.
- **Auto-trigger is OFF for Raul.** Original behaviour fired POST /recommendations on every mount per uncategorised month — wasteful when browsing. Now strictly user-initiated.

---

## Disabling AI entirely

Don't set `OPENAI_API_KEY`. The app:
- Categorizes via rule-based regex (works offline, lower quality)
- Returns stub Raul recommendation with `fallbackReason: 'no-key'`
- Returns stub Clippy tips ("Toto sú rule-based náhradné tipy.")
- All endpoints work, just less smart

Useful for dev / demo / privacy-first deploys.

---

## Adding a new AI feature

If you want a fourth surface (e.g. "explain this transaction"):

1. Add a generator in `src/lib/ai.ts` following the `generateClippyTips` pattern:
   - Accept structured input
   - Return `{ content, usedAI, fallbackReason?, errorDetail? }`
   - Wrap OpenAI call in try/catch
   - Provide a stub fallback
2. Add endpoint in `src/routes/ai.ts`:
   - Pick rate-limit bucket (read or expensive)
   - Validate input + return structured response
3. (Optional) Add cache table in `src/db.ts` ensureSeeded + helpers
4. Document in this file + add to [API.md](./API.md)
5. Don't forget to surface `fallbackReason` to the UI

---

## OpenAI alternative

To swap models / providers:

1. `src/lib/ai.ts` → `const MODEL = 'gpt-4o-mini'` → change to e.g. `'gpt-4o'`, `'claude-haiku-4-5-20251001'` (with Anthropic SDK)
2. For Anthropic: replace `import OpenAI from 'openai'` with `@anthropic-ai/sdk`, adjust call signature (model + max_tokens + messages format are similar)
3. For local Ollama: hit `http://localhost:11434/api/chat` directly via fetch

Cost / quality trade-offs documented in [openai.com/api/pricing](https://openai.com/api/pricing) and Anthropic docs.
