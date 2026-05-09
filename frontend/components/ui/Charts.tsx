/**
 * Lightweight inline SVG charts — no chart library dependency.
 * Designed for the wizarding theme: gold, crimson, emerald, parchment.
 */

const eur0 = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const SK_MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

function shortMonth(ym: string): string {
  const [, m] = ym.split('-')
  return SK_MONTH_SHORT[parseInt(m, 10) - 1] ?? m
}

export interface TrendPoint {
  month: string
  prijmy: number
  vydavky: number
  net: number
  count?: number
}

// ----------------------------------------------------------------
// IncomeExpenseBarChart — paired bars per month + net line overlay
// ----------------------------------------------------------------

interface IncomeExpenseBarChartProps {
  data: TrendPoint[]
  height?: number
  highlightMonth?: string
}

export function IncomeExpenseBarChart({
  data,
  height = 240,
  highlightMonth,
}: IncomeExpenseBarChartProps) {
  if (data.length === 0) return null

  const W = 800 // viewBox width
  const H = height
  const padL = 56
  const padR = 16
  const padT = 16
  const padB = 36
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const maxAbs = Math.max(
    1,
    ...data.flatMap((d) => [Math.abs(d.prijmy), Math.abs(d.vydavky), Math.abs(d.net)]),
  )

  // Round axis up to a "nice" number
  const niceMax = niceUp(maxAbs)
  const groupW = innerW / data.length
  const barW = Math.min(28, (groupW - 12) / 2)

  // Y scale (negative growing down isn't needed here because all bars are absolute amounts up)
  const yFor = (v: number) => padT + innerH - (Math.max(0, Math.min(niceMax, v)) / niceMax) * innerH

  // Net line scale — we map net (which can go negative) onto same scale by treating zero as bottom
  // Actually for the net line, plot net relative to ±niceMax range so positive nets float up,
  // negative ones dip below the baseline.
  const yLine = (v: number) => {
    // Map [-niceMax, +niceMax] to [innerH, 0]
    const norm = (v + niceMax) / (2 * niceMax)
    return padT + innerH - norm * innerH
  }
  // Baseline (net = 0)
  const baselineY = yLine(0)

  // Y axis ticks (4)
  const ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax]

  // Net line path
  const linePath = data
    .map((d, i) => {
      const x = padL + i * groupW + groupW / 2
      const y = yLine(d.net)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      preserveAspectRatio="none"
      role="img"
      aria-label="Príjmy a výdavky podľa mesiacov"
    >
      {/* Grid lines + Y labels */}
      <g>
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke="var(--color-border-dim)"
              strokeWidth="1"
              strokeDasharray={i === 0 ? '0' : '2 4'}
            />
            <text
              x={padL - 8}
              y={yFor(t) + 4}
              fontSize="10"
              textAnchor="end"
              fill="var(--color-text-muted)"
              fontFamily="var(--font-heading)"
              letterSpacing="0.05em"
            >
              {eur0.format(t)}
            </text>
          </g>
        ))}
      </g>

      {/* Bars */}
      <g>
        {data.map((d, i) => {
          const xCenter = padL + i * groupW + groupW / 2
          const xIncome = xCenter - barW - 1
          const xExpense = xCenter + 1
          const yIncome = yFor(d.prijmy)
          const yExpense = yFor(d.vydavky)
          const isActive = highlightMonth === d.month
          return (
            <g key={d.month}>
              {/* Highlighted month background */}
              {isActive && (
                <rect
                  x={padL + i * groupW + 2}
                  y={padT}
                  width={groupW - 4}
                  height={innerH}
                  fill="var(--color-gold)"
                  opacity="0.06"
                  rx="2"
                />
              )}
              {/* Income (emerald) */}
              <rect
                x={xIncome}
                y={yIncome}
                width={barW}
                height={padT + innerH - yIncome}
                fill="var(--color-emerald-bright)"
                opacity={d.prijmy > 0 ? 0.85 : 0}
                rx="1"
              />
              {/* Expense (crimson) */}
              <rect
                x={xExpense}
                y={yExpense}
                width={barW}
                height={padT + innerH - yExpense}
                fill="var(--color-crimson-bright)"
                opacity={d.vydavky > 0 ? 0.85 : 0}
                rx="1"
              />
              {/* Month label */}
              <text
                x={xCenter}
                y={H - 18}
                fontSize="11"
                textAnchor="middle"
                fill={isActive ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)'}
                fontFamily="var(--font-heading)"
                letterSpacing="0.1em"
              >
                {shortMonth(d.month)}
              </text>
              <text
                x={xCenter}
                y={H - 4}
                fontSize="9"
                textAnchor="middle"
                fill="var(--color-text-muted)"
                fontFamily="var(--font-ui)"
              >
                {d.month.slice(2, 4)}
              </text>
            </g>
          )
        })}
      </g>

      {/* Net line baseline (subtle) */}
      <line
        x1={padL}
        x2={W - padR}
        y1={baselineY}
        y2={baselineY}
        stroke="var(--color-gold-dim)"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {/* Net line */}
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-gold-bright)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 6px rgba(201,151,42,0.45))' }}
      />
      {/* Net dots */}
      {data.map((d, i) => {
        const x = padL + i * groupW + groupW / 2
        const y = yLine(d.net)
        return (
          <circle
            key={'dot-' + i}
            cx={x}
            cy={y}
            r="3"
            fill="var(--color-gold-bright)"
            stroke="var(--color-obsidian)"
            strokeWidth="1.5"
          />
        )
      })}
    </svg>
  )
}

function niceUp(value: number): number {
  if (value <= 0) return 1
  const exponent = Math.floor(Math.log10(value))
  const fraction = value / Math.pow(10, exponent)
  let nice: number
  if (fraction <= 1) nice = 1
  else if (fraction <= 2) nice = 2
  else if (fraction <= 5) nice = 5
  else nice = 10
  return nice * Math.pow(10, exponent)
}

// ----------------------------------------------------------------
// Sparkline — small inline trend line for the net flow
// ----------------------------------------------------------------

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
}

export function Sparkline({
  values,
  width = 160,
  height = 40,
  color = 'var(--color-gold-bright)',
  fillOpacity = 0.18,
}: SparklineProps) {
  if (values.length === 0) return null
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const range = max - min || 1
  const padding = 2
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  const points = values.map((v, i) => {
    const x = padding + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW)
    const y = padding + innerH - ((v - min) / range) * innerH
    return [x, y] as const
  })

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${padding + innerH} L ${points[0][0]} ${padding + innerH} Z`
  const baselineY = padding + innerH - ((0 - min) / range) * innerH

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <path d={areaPath} fill={color} opacity={fillOpacity} />
      <line
        x1={padding}
        x2={width - padding}
        y1={baselineY}
        y2={baselineY}
        stroke={color}
        opacity="0.3"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ----------------------------------------------------------------
// HorizontalBars — list with a bar each, used for category/bank breakdown
// ----------------------------------------------------------------

export interface HBarItem {
  label: string
  value: number
  hint?: string
}

interface HorizontalBarsProps {
  items: HBarItem[]
  tone?: 'crimson' | 'emerald' | 'gold' | 'cobalt'
  format?: (v: number) => string
}

const TONE_BAR: Record<string, string> = {
  crimson: 'from-crimson via-crimson-bright to-crimson-bright',
  emerald: 'from-emerald via-emerald-bright to-emerald-bright',
  gold: 'from-gold-dim via-gold to-gold-bright',
  cobalt: 'from-cobalt via-cobalt-bright to-cobalt-bright',
}
const TONE_TEXT: Record<string, string> = {
  crimson: 'text-crimson-bright',
  emerald: 'text-emerald-bright',
  gold: 'text-gold-bright',
  cobalt: 'text-cobalt-bright',
}

export function HorizontalBars({
  items,
  tone = 'gold',
  format = (v) => eur0.format(v),
}: HorizontalBarsProps) {
  if (items.length === 0) {
    return <p className="font-ui italic text-text-muted text-sm">—</p>
  }
  const max = Math.max(...items.map((i) => Math.abs(i.value)))
  const total = items.reduce((s, i) => s + Math.abs(i.value), 0)
  const barClass = TONE_BAR[tone] ?? TONE_BAR.gold
  const textClass = TONE_TEXT[tone] ?? TONE_TEXT.gold

  return (
    <div className="space-y-2">
      {items.map((i) => {
        const pct = max > 0 ? Math.round((Math.abs(i.value) / max) * 100) : 0
        const sharePct = total > 0 ? Math.round((Math.abs(i.value) / total) * 100) : 0
        return (
          <div key={i.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-heading text-text-primary tracking-wide truncate">
                {i.label}
                {i.hint && (
                  <span className="font-ui text-xs text-text-muted italic ml-2">{i.hint}</span>
                )}
              </span>
              <span className={`font-heading ${textClass} whitespace-nowrap`}>
                {format(i.value)}{' '}
                <span className="text-text-muted text-xs">{sharePct}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 bg-stone/60 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${barClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
