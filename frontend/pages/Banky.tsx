import { useEffect, useState, useRef, ChangeEvent } from 'react'
import { Card } from '../components/ui/Card'
import { apiFetch } from '../utils/api'
import { extractPdfText } from '../utils/pdf'

type BankSource = 'slsp' | 'tatra' | 'revolut' | 'manual'

interface Bank {
  id: number
  name: string
  type: string
  balance: number
  currency: string
  source: BankSource
  transactionCount: number
}

interface PreviewRow {
  date: string
  amount: number
  description: string
  fingerprint: string
}

type FileKind = 'csv' | 'pdf'

interface PreviewResult {
  kind: FileKind
  detectedFormat: BankSource | null
  usedFormat: BankSource
  total: number
  preview: PreviewRow[]
  errors: string[]
}

interface ImportResult {
  kind: FileKind
  usedFormat: BankSource
  total: number
  imported: number
  duplicates: number
  errors: string[]
}

const eur = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' })

const SOURCE_LABEL: Record<BankSource, string> = {
  slsp: 'Slovenská sporiteľňa',
  tatra: 'Tatra banka',
  revolut: 'Revolut',
  manual: 'Manuálne',
}

const SOURCE_ICON: Record<BankSource, string> = {
  slsp: '⚖',
  tatra: '⚱',
  revolut: '◊',
  manual: '✦',
}

export function Banky() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [importBank, setImportBank] = useState<Bank | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [wipeResult, setWipeResult] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const res = await apiFetch<Bank[]>('/api/banks')
    if (res.ok) setBanks(res.data)
    else setErr(res.error)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const totalBalance = banks.reduce((s, b) => s + b.balance, 0)
  const totalTx = banks.reduce((s, b) => s + b.transactionCount, 0)

  async function wipeAll() {
    setWiping(true)
    const res = await apiFetch<{ count: number }>('/api/transactions', { method: 'DELETE' })
    setWiping(false)
    if (res.ok) {
      setWipeResult(res.data.count)
      load()
    } else {
      setErr(res.error)
      setConfirmWipe(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-10 reveal reveal-1 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.3em] text-gold mb-2">
            ✦ Sieň trezorov ✦
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-text-primary leading-tight [text-shadow:0_0_40px_rgba(201,151,42,0.3)]">
            Tvoje <span className="text-gold-bright">banky</span>
          </h1>
          <p className="font-body italic text-text-secondary mt-3 text-lg">
            „Každý galeón si pamätá svoju cestu — stačí nahrať pergamen z banky."
          </p>
        </div>
        {totalTx > 0 && (
          <button
            onClick={() => setConfirmWipe(true)}
            className="font-heading text-[0.65rem] uppercase tracking-widest text-crimson-bright border border-crimson/40 bg-crimson/5 px-3 py-2 rounded-[3px] hover:border-crimson-bright hover:bg-crimson/15 transition-all duration-300 cursor-pointer self-start"
            title="Vymaže všetky importované transakcie zo všetkých bánk"
          >
            ⌫ Vymazať dáta ({totalTx})
          </button>
        )}
      </div>

      {err && (
        <div className="mb-6 bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-5 py-4 reveal">
          <p className="font-heading text-xs uppercase tracking-widest text-crimson-bright">
            ⚠ Chyba
          </p>
          <p className="font-body text-sm text-text-secondary mt-0.5">{err}</p>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="reveal reveal-2">
          <Card>
            <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted">
              Trezory
            </p>
            <p className="font-display text-3xl text-gold-bright mt-2 [text-shadow:0_0_24px_rgba(201,151,42,0.3)]">
              {banks.length}
            </p>
          </Card>
        </div>
        <div className="reveal reveal-3">
          <Card>
            <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted">
              Súčet zostatkov
            </p>
            <p className="font-display text-3xl text-gold-bright mt-2 [text-shadow:0_0_24px_rgba(201,151,42,0.3)]">
              {eur.format(totalBalance)}
            </p>
          </Card>
        </div>
        <div className="reveal reveal-4">
          <Card>
            <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted">
              Naimportovaných transakcií
            </p>
            <p className="font-display text-3xl text-gold-bright mt-2 [text-shadow:0_0_24px_rgba(201,151,42,0.3)]">
              {totalTx}
            </p>
          </Card>
        </div>
      </div>

      {/* Banks list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && (
          <p className="font-heading text-sm uppercase tracking-widest text-gold flicker col-span-full">
            ✦ Načítavam trezory ✦
          </p>
        )}
        {!loading &&
          banks.map((b, i) => (
            <div key={b.id} className={`reveal reveal-${Math.min(6, i + 2)}`}>
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="text-3xl text-gold-bright"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(201,151,42,0.4))' }}
                    >
                      {SOURCE_ICON[b.source]}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-heading text-lg text-text-primary tracking-wide truncate">
                        {b.name}
                      </h3>
                      <p className="font-ui text-xs text-text-muted italic">
                        {SOURCE_LABEL[b.source]}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mb-5 text-sm">
                  <div className="flex justify-between">
                    <span className="font-ui text-text-muted">Zostatok</span>
                    <span className="font-heading text-gold-bright">
                      {eur.format(b.balance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-ui text-text-muted">Transakcie</span>
                    <span className="font-heading text-text-primary">
                      {b.transactionCount}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setImportBank(b)}
                  className="w-full font-heading text-xs uppercase tracking-widest text-gold border border-border px-3 py-2 rounded-[3px] hover:border-gold hover:text-gold-bright hover:bg-gold/5 transition-all duration-300 cursor-pointer"
                >
                  ⌬ Importovať CSV / PDF
                </button>
              </Card>
            </div>
          ))}
      </div>

      {/* Import modal */}
      {importBank && (
        <ImportModal
          bank={importBank}
          onClose={() => setImportBank(null)}
          onDone={() => {
            setImportBank(null)
            load()
          }}
        />
      )}

      {/* Wipe confirm modal */}
      {confirmWipe && (
        <WipeConfirmModal
          totalTx={totalTx}
          wiping={wiping}
          result={wipeResult}
          onConfirm={wipeAll}
          onClose={() => {
            setConfirmWipe(false)
            setWipeResult(null)
          }}
        />
      )}
    </div>
  )
}

interface ImportModalProps {
  bank: Bank
  onClose: () => void
  onDone: () => void
}

function detectKind(file: File): FileKind | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf'
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) return 'csv'
  if (file.type.startsWith('text/')) return 'csv'
  return null
}

function ImportModal({ bank, onClose, onDone }: ImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [payload, setPayload] = useState<{ kind: FileKind; text: string } | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [override, setOverride] = useState<BankSource>(bank.source)
  const [isDragging, setIsDragging] = useState(false)
  // dragenter/dragleave fire for every child element — use a counter so we
  // only flip isDragging off when the cursor truly leaves the dropzone.
  const dragDepth = useRef(0)

  // While the modal is open, swallow drag/drop events that land OUTSIDE the
  // dropzone — otherwise Chrome would open the dropped file as a new tab and
  // the user would lose their work. The actual handlers on the label still
  // run normally (event bubbles up but its default is already cancelled).
  useEffect(() => {
    const stop = (e: DragEvent) => {
      e.preventDefault()
    }
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
    }
  }, [])

  async function readFile(file: File) {
    setErr(null)
    setResult(null)
    setPreview(null)
    setFileName(file.name)
    setPayload(null)

    const kind = detectKind(file)
    if (!kind) {
      setErr('Nepodporovaný typ súboru. Použi CSV alebo PDF.')
      return
    }

    try {
      let text: string
      if (kind === 'pdf') {
        setExtracting(true)
        const ex = await extractPdfText(file)
        setExtracting(false)
        text = ex.text
        if (!text.trim()) {
          setErr('Z PDF sa nepodarilo extrahovať žiadny text. Možno ide o naskenovaný dokument.')
          return
        }
      } else {
        text = await file.text()
      }
      setPayload({ kind, text })
      await runPreview(kind, text, override)
    } catch (e: unknown) {
      setExtracting(false)
      setErr('Súbor sa nepodarilo načítať.')
    }
  }

  async function runPreview(kind: FileKind, text: string, source: BankSource) {
    const path = kind === 'pdf' ? '/api/imports/pdf/preview' : '/api/imports/csv/preview'
    const body = kind === 'pdf'
      ? { bankId: bank.id, text, source }
      : { bankId: bank.id, csv: text, source }
    const res = await apiFetch<PreviewResult>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (res.ok) setPreview(res.data)
    else setErr(res.error)
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) await readFile(f)
  }

  // ---- Drag & drop handlers ----------------------------------------------
  // Keep the dropzone reactive while the user drags a file over it. We must
  // call e.preventDefault() inside onDragOver, otherwise the browser will
  // never fire onDrop (the default action — "navigate to the dropped file" —
  // takes precedence).

  function onDragEnter(e: React.DragEvent<HTMLLabelElement>) {
    if (extracting) return
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current += 1
    if (dragDepth.current === 1) setIsDragging(true)
  }

  function onDragOver(e: React.DragEvent<HTMLLabelElement>) {
    if (extracting) return
    e.preventDefault()
    e.stopPropagation()
    // Tell the OS this is a "copy" target (cursor shows + sign).
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  function onDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  async function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = 0
    setIsDragging(false)
    if (extracting) return
    const f = e.dataTransfer?.files?.[0]
    if (!f) return
    // Also sync the hidden <input> so re-picking the same file later works
    // (some browsers won't re-fire onChange for the same path otherwise).
    try {
      if (fileRef.current && e.dataTransfer.files) {
        fileRef.current.files = e.dataTransfer.files
      }
    } catch {
      /* DataTransfer is read-only in some sandboxes — safe to ignore */
    }
    await readFile(f)
  }

  async function changeOverride(s: BankSource) {
    setOverride(s)
    if (payload) await runPreview(payload.kind, payload.text, s)
  }

  async function confirmImport() {
    if (!payload) return
    setImporting(true)
    setErr(null)
    const path = payload.kind === 'pdf' ? '/api/imports/pdf' : '/api/imports/csv'
    const body = payload.kind === 'pdf'
      ? { bankId: bank.id, text: payload.text, source: override }
      : { bankId: bank.id, csv: payload.text, source: override }
    const res = await apiFetch<ImportResult>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    setImporting(false)
    if (res.ok) setResult(res.data)
    else setErr(res.error)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-obsidian border border-border rounded-[4px] max-w-3xl w-full my-8 [box-shadow:0_8px_60px_rgba(0,0,0,0.8),0_0_60px_rgba(201,151,42,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-[6px] border border-gold/[0.06] rounded-[2px] pointer-events-none" />
        <span className="absolute top-2 left-2 text-gold/40 text-[10px]">✦</span>
        <span className="absolute top-2 right-2 text-gold/40 text-[10px]">✦</span>
        <span className="absolute bottom-2 left-2 text-gold/40 text-[10px]">✦</span>
        <span className="absolute bottom-2 right-2 text-gold/40 text-[10px]">✦</span>

        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="font-heading text-[0.65rem] uppercase tracking-[0.3em] text-gold mb-1">
                ✦ Pergamen z banky
              </p>
              <h2 className="font-heading text-2xl text-text-primary tracking-wide">
                Import {payload?.kind === 'pdf' ? 'PDF' : 'CSV / PDF'} — {bank.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="font-heading text-xs uppercase tracking-widest text-text-muted hover:text-crimson-bright transition-colors px-2 py-1"
            >
              ✕ Zatvoriť
            </button>
          </div>

          {!result && (
            <>
              {/* File picker — click OR drag & drop */}
              <div className="mb-6">
                <label
                  htmlFor="csv-file"
                  onDragEnter={onDragEnter}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={[
                    'block cursor-pointer border-2 border-dashed rounded-[4px] px-6 py-10 text-center transition-all duration-200',
                    isDragging
                      ? 'border-gold-bright bg-gold/15 scale-[1.01] [box-shadow:0_0_24px_rgba(201,151,42,0.35)]'
                      : 'border-border hover:border-gold hover:bg-gold/5',
                  ].join(' ')}
                >
                  <span className="text-3xl text-gold block mb-2">
                    {extracting ? (
                      <span className="flicker">✦</span>
                    ) : isDragging ? (
                      '⇩'
                    ) : (
                      '⌬'
                    )}
                  </span>
                  <span className="font-heading text-sm uppercase tracking-widest text-gold">
                    {extracting
                      ? 'Čítam pergamen…'
                      : isDragging
                      ? 'Pusti súbor sem'
                      : fileName
                      ? fileName
                      : 'Pretiahni súbor sem alebo klikni a vyber'}
                  </span>
                  <p className="font-ui text-xs text-text-muted italic mt-2">
                    {extracting
                      ? 'PDF sa lúšti v prehliadači'
                      : isDragging
                      ? 'CSV alebo PDF'
                      : fileName
                      ? `${payload?.kind === 'pdf' ? 'PDF' : 'CSV'} · klikni alebo pretiahni iný súbor`
                      : 'CSV export alebo PDF výpis (SLSP) — Tatra / Revolut tiež OK pre CSV'}
                  </p>
                  <input
                    id="csv-file"
                    ref={fileRef}
                    type="file"
                    accept=".csv,.pdf,.tsv,.txt,text/csv,text/plain,application/pdf"
                    onChange={onFile}
                    disabled={extracting}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Format override */}
              {payload && (
                <div className="mb-6">
                  <p className="font-ui text-sm uppercase tracking-widest text-text-muted mb-2">
                    Formát
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['slsp', 'tatra', 'revolut'] as BankSource[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => changeOverride(s)}
                        className={[
                          'font-heading text-xs uppercase tracking-widest px-3 py-1.5 rounded-[3px] border transition-all duration-200',
                          override === s
                            ? 'bg-gold/15 border-gold text-gold-bright'
                            : 'bg-stone/50 border-border-dim text-text-secondary hover:border-gold-dim hover:text-gold',
                        ].join(' ')}
                      >
                        {SOURCE_ICON[s]} {SOURCE_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  {preview && preview.detectedFormat && preview.detectedFormat !== override && (
                    <p className="font-ui text-xs text-gold-dim italic mt-2">
                      Auto-detekcia navrhuje:{' '}
                      <button
                        onClick={() => changeOverride(preview.detectedFormat as BankSource)}
                        className="underline text-gold hover:text-gold-bright"
                      >
                        {SOURCE_LABEL[preview.detectedFormat]}
                      </button>
                    </p>
                  )}
                </div>
              )}

              {/* Preview */}
              {preview && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-ui text-sm uppercase tracking-widest text-text-muted">
                      Náhľad ({preview.total} transakcií)
                    </p>
                    <span className="font-heading text-[0.6rem] uppercase tracking-widest text-gold border border-gold/30 bg-gold/10 px-2 py-0.5 rounded-[2px]">
                      {SOURCE_LABEL[preview.usedFormat]}
                    </span>
                  </div>
                  {preview.total === 0 ? (
                    <div className="bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-4 py-3">
                      <p className="font-heading text-xs uppercase tracking-widest text-crimson-bright">
                        ⚠ Žiadne transakcie
                      </p>
                      <p className="font-body text-sm text-text-secondary mt-0.5">
                        Skús iný formát, alebo skontroluj CSV súbor.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-stone/40 border border-border-dim rounded-[3px] overflow-hidden">
                      <table className="w-full font-body text-sm">
                        <thead className="bg-obsidian/60">
                          <tr className="border-b border-border-dim">
                            <th className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted px-3 py-2 text-left font-normal">
                              Dátum
                            </th>
                            <th className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted px-3 py-2 text-left font-normal">
                              Popis
                            </th>
                            <th className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted px-3 py-2 text-right font-normal">
                              Suma
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.preview.map((r, i) => (
                            <tr key={i} className="border-b border-border-dim/50">
                              <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                                {r.date}
                              </td>
                              <td className="px-3 py-2 text-text-primary truncate max-w-xs">
                                {r.description}
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-heading whitespace-nowrap ${
                                  r.amount < 0 ? 'text-crimson-bright' : 'text-emerald-bright'
                                }`}
                              >
                                {eur.format(r.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {preview.errors.length > 0 && (
                    <div className="mt-3 bg-stone/40 border border-border-dim rounded-[3px] px-3 py-2">
                      <p className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted mb-1">
                        Upozornenia
                      </p>
                      <ul className="font-ui text-xs text-text-muted space-y-0.5">
                        {preview.errors.map((e, i) => (
                          <li key={i}>• {e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {err && (
                <div className="mb-4 bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-4 py-3">
                  <p className="font-body text-sm text-text-secondary">{err}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="font-heading text-xs uppercase tracking-widest text-gold bg-transparent border border-border px-6 py-2.5 rounded-[3px] hover:border-gold hover:text-gold-bright hover:bg-gold/5 transition-all duration-300"
                >
                  Zrušiť
                </button>
                <button
                  onClick={confirmImport}
                  disabled={!preview || preview.total === 0 || importing}
                  className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-6 py-2.5 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px hover:[box-shadow:0_4px_20px_rgba(201,151,42,0.5)] active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {importing
                    ? '✦ Importujem… ✦'
                    : `⚡ Naimportovať ${preview?.total ?? 0}${preview?.kind === 'pdf' ? ' (PDF)' : ''}`}
                </button>
              </div>
            </>
          )}

          {/* Result */}
          {result && (
            <div className="text-center py-6">
              <p className="text-5xl mb-4">⚡</p>
              <h3 className="font-heading text-2xl text-gold-bright tracking-wide mb-2 [text-shadow:0_0_24px_rgba(201,151,42,0.4)]">
                Hotovo
              </h3>
              <p className="font-body text-text-secondary mb-6">
                Pergamen bol prečítaný a zapečatený v trezore.
              </p>
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-8">
                <div className="bg-stone/50 border border-border-dim rounded-[3px] px-3 py-3">
                  <p className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted">
                    Spolu
                  </p>
                  <p className="font-display text-2xl text-text-primary mt-1">
                    {result.total}
                  </p>
                </div>
                <div className="bg-emerald/10 border border-emerald-bright/30 rounded-[3px] px-3 py-3">
                  <p className="font-heading text-[0.6rem] uppercase tracking-widest text-emerald-bright">
                    Pridané
                  </p>
                  <p className="font-display text-2xl text-emerald-bright mt-1">
                    {result.imported}
                  </p>
                </div>
                <div className="bg-stone/50 border border-border-dim rounded-[3px] px-3 py-3">
                  <p className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted">
                    Duplicity
                  </p>
                  <p className="font-display text-2xl text-text-muted mt-1">
                    {result.duplicates}
                  </p>
                </div>
              </div>
              <button
                onClick={onDone}
                className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-8 py-3 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px hover:[box-shadow:0_4px_20px_rgba(201,151,42,0.5)] transition-all duration-200"
              >
                ✦ Späť na trezory
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Wipe confirm modal ----------

interface WipeProps {
  totalTx: number
  wiping: boolean
  result: number | null
  onConfirm: () => void
  onClose: () => void
}

function WipeConfirmModal({ totalTx, wiping, result, onConfirm, onClose }: WipeProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-obsidian border border-crimson/40 rounded-[4px] max-w-md w-full my-8 [box-shadow:0_8px_60px_rgba(0,0,0,0.8),0_0_60px_rgba(192,57,43,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-[6px] border border-crimson/[0.08] rounded-[2px] pointer-events-none" />
        <span className="absolute top-2 left-2 text-crimson-bright/50 text-[10px]">✦</span>
        <span className="absolute top-2 right-2 text-crimson-bright/50 text-[10px]">✦</span>
        <span className="absolute bottom-2 left-2 text-crimson-bright/50 text-[10px]">✦</span>
        <span className="absolute bottom-2 right-2 text-crimson-bright/50 text-[10px]">✦</span>

        <div className="p-8 text-center">
          {result === null ? (
            <>
              <p className="text-5xl text-crimson-bright mb-4">⌫</p>
              <h2 className="font-heading text-xl text-crimson-bright tracking-wide uppercase mb-2">
                Vyprázdniť trezor?
              </h2>
              <p className="font-body text-text-secondary mb-1">
                Vymažem <span className="text-text-primary font-heading">{totalTx}</span>{' '}
                transakcií zo všetkých bánk.
              </p>
              <p className="font-ui italic text-sm text-text-muted mb-7">
                Banky a ich nastavenia ostanú. Toto sa nedá vrátiť.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={onClose}
                  disabled={wiping}
                  className="font-heading text-xs uppercase tracking-widest text-gold bg-transparent border border-border px-6 py-2.5 rounded-[3px] hover:border-gold hover:text-gold-bright hover:bg-gold/5 transition-all duration-300 disabled:opacity-50"
                >
                  Zrušiť
                </button>
                <button
                  onClick={onConfirm}
                  disabled={wiping}
                  className="font-heading text-xs uppercase tracking-widest text-crimson-bright bg-crimson/10 border border-crimson-bright px-6 py-2.5 rounded-[3px] hover:bg-crimson/20 hover:[box-shadow:0_0_24px_rgba(192,57,43,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {wiping ? '✦ Mažem… ✦' : '⚡ Vymazať všetko'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-5xl text-gold-bright mb-4">✦</p>
              <h2 className="font-heading text-xl text-gold-bright tracking-wide uppercase mb-2 [text-shadow:0_0_24px_rgba(201,151,42,0.4)]">
                Trezor vyprázdnený
              </h2>
              <p className="font-body text-text-secondary mb-7">
                Vymazaných <span className="text-text-primary font-heading">{result}</span>{' '}
                transakcií. Pergameny môžeš nahrať odznova.
              </p>
              <button
                onClick={onClose}
                className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-8 py-3 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200"
              >
                ✦ Späť na trezory
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
