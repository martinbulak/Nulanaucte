import { useState } from 'react'
import { apiFetch } from '../../utils/api'

/**
 * Inline combobox for editing a single transaction's category.
 *
 * Renders a small text input pre-filled with the current category,
 * a `<datalist>` populated from the user's known categories, and saves
 * via PATCH /api/ai/transactions/:id/category on blur / Enter.
 *
 * The colour of the chip reflects who set the category:
 *   gold-bright = user manually set
 *   cobalt-bright = AI set (with confidence in tooltip)
 *   text-secondary = system default ("Nezaradené")
 *
 * Used by both /vydavky (TransactionsPage) and the Dashboard's recent
 * transactions table — same UX everywhere a category is shown.
 */
export interface CategorySelectTx {
  id: number
  category: string
  categorizedBy?: 'system' | 'ai' | 'user'
  aiConfidence?: number | null
}

interface Props {
  tx: CategorySelectTx
  options: string[]
  onChange: (newCat: string) => void
  /** "default" (in transaction tables) or "compact" (narrower, used on Dashboard). */
  size?: 'default' | 'compact'
}

export function CategorySelect({ tx, options, onChange, size = 'default' }: Props) {
  const [value, setValue] = useState(tx.category)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const tone =
    tx.categorizedBy === 'user'
      ? 'text-gold-bright'
      : tx.categorizedBy === 'ai'
      ? 'text-cobalt-bright'
      : 'text-text-secondary'

  async function commit(next: string) {
    const trimmed = next.trim()
    if (!trimmed || trimmed.length < 2) {
      setErr('min 2 znaky')
      return
    }
    if (trimmed === tx.category) return
    setBusy(true)
    setErr(null)
    const res = await apiFetch<{ category: string }>(`/api/ai/transactions/${tx.id}/category`, {
      method: 'PATCH',
      body: JSON.stringify({ category: trimmed }),
    })
    setBusy(false)
    if (res.ok) {
      setValue(res.data.category)
      onChange(res.data.category)
    } else {
      setErr(res.error)
    }
  }

  const listId = `cats-${tx.id}`
  const widthClass = size === 'compact' ? 'max-w-[160px]' : 'max-w-[200px]'

  return (
    <div className={`inline-flex flex-col gap-0.5 ${widthClass}`}>
      <input
        type="text"
        value={value}
        list={listId}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === 'Escape') {
            setValue(tx.category)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        maxLength={60}
        className={`bg-transparent border border-border-dim rounded-[2px] px-2 py-1 font-heading text-[0.65rem] uppercase tracking-widest ${tone} hover:border-gold focus:border-gold-bright outline-none w-full`}
        title={
          tx.categorizedBy === 'ai'
            ? `AI · confidence ${Math.round((tx.aiConfidence ?? 0) * 100)}%`
            : tx.categorizedBy === 'user'
            ? 'Ručne upravené'
            : 'Nezaradené'
        }
      />
      <datalist id={listId}>
        {options.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {err && <span className="font-ui text-[10px] text-crimson-bright italic">{err}</span>}
    </div>
  )
}
