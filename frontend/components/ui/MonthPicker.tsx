interface MonthPickerProps {
  month: string // "YYYY-MM"
  months: string[] // sorted desc, available months with data
  onChange: (month: string) => void
  className?: string
}

const MONTH_NAMES = [
  'Január',
  'Február',
  'Marec',
  'Apríl',
  'Máj',
  'Jún',
  'Júl',
  'August',
  'September',
  'Október',
  'November',
  'December',
]

export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const idx = parseInt(m, 10) - 1
  return `${MONTH_NAMES[idx] ?? m} ${y}`
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MonthPicker({ month, months, onChange, className = '' }: MonthPickerProps) {
  const goPrev = () => onChange(shiftMonth(month, -1))
  const goNext = () => onChange(shiftMonth(month, +1))

  // Build option list: union of "months with data" + the currently selected month
  const optionSet = new Set([month, ...months])
  const options = [...optionSet].sort((a, b) => (a < b ? 1 : -1))

  return (
    <div
      className={`inline-flex items-center gap-1 bg-obsidian/60 border border-border rounded-[3px] [box-shadow:0_2px_8px_rgba(0,0,0,0.2)] ${className}`}
    >
      <button
        type="button"
        onClick={goPrev}
        aria-label="Predchádzajúci mesiac"
        className="font-heading text-base text-gold hover:text-gold-bright px-3 py-2 transition-colors cursor-pointer border-r border-border-dim"
      >
        ‹
      </button>
      <div className="relative">
        <select
          value={month}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-transparent font-heading text-sm uppercase tracking-widest text-gold-bright px-4 py-2 pr-8 outline-none cursor-pointer focus:text-gold-bright"
        >
          {options.map((m) => (
            <option key={m} value={m} className="bg-obsidian text-text-primary">
              {formatMonth(m)}
              {months.includes(m) ? '' : ' (žiadne dáta)'}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gold text-xs">
          ▾
        </span>
      </div>
      <button
        type="button"
        onClick={goNext}
        aria-label="Nasledujúci mesiac"
        className="font-heading text-base text-gold hover:text-gold-bright px-3 py-2 transition-colors cursor-pointer border-l border-border-dim"
      >
        ›
      </button>
    </div>
  )
}
