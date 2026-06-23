# Bank statement imports

Two paths: **CSV** (most banks) and **PDF** (SLSP mostly). Both go through preview → confirm flow so the user can review duplicates before commit.

---

## High-level flow

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│   User drops file into ImportModal                          │
│   ↓                                                          │
│   detectKind(file) → 'csv' | 'pdf'                          │
│   ↓                                                          │
│   if PDF: extractPdfText(file) via pdfjs-dist in browser    │
│   ↓                                                          │
│   POST /api/imports/{csv,pdf}/preview { bankId, text }      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Server                                                       │
│   Detect format (slsp/tatra/revolut) from headers           │
│   Run parser → array of { date, amount, description }       │
│   For each row: compute fingerprint = sha256(date|amt|desc) │
│   Check existing fingerprints in DB → mark as duplicate     │
│   Return { preview, total, duplicates, detectedFormat }     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  User reviews preview → Confirm
                              │
                              ▼
              POST /api/imports/{csv,pdf}  (same body)
                              │
                              ▼
              Insert non-duplicates into transactions
              ON CONFLICT (bank_id, fingerprint) DO NOTHING
```

---

## Supported formats

| Bank | CSV | PDF | Source code |
|---|---|---|---|
| SLSP (Slovenská sporiteľňa) | ✅ George export | ✅ Mesačný výpis | `csv-parsers.ts` + `pdf-parsers.ts` |
| Tatra banka | ✅ Internet banking export | ❌ | `csv-parsers.ts` |
| Revolut | ✅ Statement CSV | ❌ | `csv-parsers.ts` |
| Manual | — | — | Use the closest format + edit afterwards |

The bank picker on `/nastavenia` shows 15 SK/EU options; only those three have native parsers, the rest accept CSV with manual format selection.

---

## Browser-side PDF extraction

`pdfjs-dist` in the browser converts PDF → plain text. We do this client-side because:
1. **No server CPU spent** on PDF parsing (Vercel free tier matters)
2. **PDFs never leave the browser** before tokenisation — privacy win
3. **Faster UX** — extraction happens in parallel with the user reviewing the file picker UI

See [`frontend/utils/pdf.ts`](../frontend/utils/pdf.ts). The extracted text is then POSTed to `/api/imports/pdf/preview` as `text: string`.

---

## CSV parsers (`src/lib/csv-parsers.ts`)

### Auto-detection
- **SLSP George CSV** — first non-empty line contains `"ID účtu";"IBAN";"Mena účtu"`
- **Tatra CSV** — header includes `Dátum;Suma;Mena;Variabilný symbol;Konšt. symbol;Špec. symbol;Účet;...`
- **Revolut CSV** — header `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,...`

If user manually overrides via the format dropdown, we trust them. If auto-detect picks wrong, the preview shows it and the user can correct it.

### Per-format quirks

**SLSP**:
- Slovak number format: `1 234,56` → parse as `1234.56`
- Slovak date format: `31.12.2025` → ISO `2025-12-31`
- "Vlastná suma" column → expense if negative, income if positive
- Multi-line descriptions: join with `; `

**Tatra**:
- Similar SK formats
- Description = "Identifikácia príkazcu/príjemcu" + variabilný symbol if present
- Amount field has sign already (no separate type column)

**Revolut**:
- ISO date, dot decimal separator
- "Type" column: `CARD_PAYMENT`, `TRANSFER`, `EXCHANGE`, ...
- Description = "Description" or composed from merchant + counterparty
- Fee column subtracted from amount

---

## PDF parser (`src/lib/pdf-parsers.ts`)

Currently SLSP only. Strategy:

1. Split text into transaction blocks (each starts with a date in `DD.MM.YYYY` format)
2. For each block extract: date, amount, description, optional counterparty IBAN
3. Reconcile with "Diff zostatkov" — the running balance column. If sum of parsed amounts doesn't match the start/end balances, flag an error.
4. Return `{ date, amount, description, fingerprint }[]`

The diff-zostatkov check catches partial parses (e.g. a transaction at page break that got truncated). Errors go into the preview response so the user knows something looks off.

---

## Fingerprint dedup

Every row gets `fingerprint = sha256(date + amount + description)`. Stored on `transactions.fingerprint`. Unique index `transactions_bank_fingerprint_uq ON (bank_id, fingerprint)`.

Re-importing the same PDF/CSV → `ON CONFLICT DO NOTHING` → zero new rows inserted.

This means:
- **Safe re-imports** — no duplicates even if you upload the file twice
- **Idempotent statements** — if the bank issues the same statement format for overlapping months, you can import both
- **Per-bank scope** — same transaction at two different banks would create two rows (correct, they're distinct events)

---

## Adding a new bank format

Suppose you want to add **VÚB** auto-detection.

### 1. Add to bank registry (`src/lib/banks.ts`)

Already there as `'vub'` with `parserSupport: 'csv'`. Change to `'auto'` once parser exists.

### 2. Sample CSV

Download a VÚB CSV export. Note the header row + a few sample data rows. Identify:
- Date column + format
- Amount column + sign convention
- Description / merchant column
- Anything else useful (variable symbol, counterparty IBAN, original currency, ...)

### 3. Write the detector + parser

In `src/lib/csv-parsers.ts`:

```ts
// Inside detectCsvFormat(headerLine)
if (/Dátum splatnosti.*Suma operácie.*Účet partnera/i.test(headerLine)) {
  return 'vub'
}

// Add parser branch
function parseVubCsv(rows: string[][]): ParsedRow[] {
  // Skip header(s), iterate data rows, normalize per the format
  return rows.slice(1).map((row) => {
    const date = parseDateSk(row[0])
    const amount = parseAmountSk(row[1]) // handles "−1 234,56"
    const description = [row[2], row[3]].filter(Boolean).join(' · ').trim()
    return {
      date,
      amount,
      description,
      fingerprint: sha256(`${date}|${amount}|${description}`),
    }
  })
}

// Add the branch in the main switch
case 'vub': return parseVubCsv(rows)
```

### 4. Test locally

```bash
npm run dev
# /banky → Importovať na VÚB banke → drop CSV
# Server logs: '[imports] detected format=vub' should appear
```

### 5. Update docs

Add a row to the support table in this file. Mention in README.

---

## Error handling

Common preview errors:

| Error | Cause | User fix |
|---|---|---|
| `Nepodporovaný typ súboru` | File extension is neither .csv nor .pdf | Re-export as CSV from the bank |
| `Z PDF sa nepodarilo extrahovať žiadny text` | Scanned PDF (image), not text-based | Re-download from bank as text PDF, or OCR it externally |
| `Detegovaný formát X, ale nevyzerá ako X` | Auto-detect was wrong | Use the format pills to override |
| `Sum mismatch X € vs balance diff Y €` (SLSP PDF only) | Partial parse, page break dropped a row | Re-export PDF or import a different month's PDF |

---

## File size limits

`src/middleware/bodyLimit.ts` caps request bodies at **8 MB**. Typical CSV/PDF imports are <1 MB so this is a guardrail not a real limit.

Larger imports: split the PDF/CSV by month and import separately.

---

## Inbound email (legacy, gated)

Earlier versions supported `slug-token@inbox.tvojadomena.com` per-user addresses receiving bank PDFs via Resend Inbound webhook. The route still exists (`src/routes/inbound.ts`) but **isn't recommended for new deploys** — Resend moved inbound to their Pro plan ($20/mo) since v0.5 of this project.

Workaround: stick with manual drag-and-drop import. Three to five PDFs per month per bank is manageable.
