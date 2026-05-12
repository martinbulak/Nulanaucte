import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '../../utils/api'

/**
 * Inline combobox for editing a single transaction's category.
 *
 * Hybrid input: user can either pick from a clickable dropdown (default
 * list pulled from /api/ai/categories — user's own categories + the
 * starter set) or type a new category if the right one isn't there.
 * Saves on Enter, Tab, or click on an option.
 *
 * Why a custom combobox instead of <input list> + <datalist>: browsers
 * are inconsistent about when the datalist popup actually opens. Users
 * couldn't see the options, so the picker felt broken. This component
 * always shows a visible "▾" button that opens a proper menu.
 *
 * The dropdown is rendered through a React portal pinned to document.body
 * with `position: fixed`, because the parent transaction tables use
 * `overflow:hidden` to round their corners — a regular `absolute` menu
 * would get clipped inside the table.
 *
 * Colour of the input chip reflects who set the category:
 *   gold-bright = user manually set
 *   cobalt-bright = AI set (with confidence in tooltip)
 *   text-secondary = system default ("Nezaradené")
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

const UNCATEGORISED = new Set(['Nezaradené', 'Iné', ''])

interface MenuRect {
  top: number
  left: number
  width: number
}

export function CategorySelect({ tx, options, onChange, size = 'default' }: Props) {
  const [value, setValue] = useState(tx.category)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Filter list by what's typed; if input is empty / matches current value,
  // show full list. Trim + lowercase for case-insensitive match.
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q || q === tx.category.toLowerCase()) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [value, options, tx.category])

  const tone =
    tx.categorizedBy === 'user'
      ? 'text-gold-bright'
      : tx.categorizedBy === 'ai'
      ? 'text-cobalt-bright'
      : 'text-text-secondary'

  // Compute menu position from the input's bounding rect. Recompute on
  // open, on window resize/scroll while open. Portal coords are viewport-
  // relative (position: fixed) so overflow:hidden parents don't clip us.
  function recalcMenu() {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    const desiredWidth = Math.max(r.width, 200)
    setMenuRect({
      top: r.bottom + 4,
      left: Math.min(r.left, window.innerWidth - desiredWidth - 8),
      width: desiredWidth,
    })
  }

  useEffect(() => {
    if (!open) return
    recalcMenu()
    function onScroll() {
      recalcMenu()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  // Close on outside click — wrapRef contains the input, and the menu
  // (since it's portaled) is detected separately via the data attribute.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      // Menu portal — check by data attribute
      const menuEl = (target as HTMLElement).closest?.('[data-category-menu="true"]')
      if (menuEl) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Reset highlight when list changes
  useEffect(() => {
    setHighlight(0)
  }, [filtered.length, open])

  // Scroll the highlighted item into view as user arrows up/down
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlight] as HTMLElement | undefined
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  async function commit(next: string) {
    const trimmed = next.trim()
    if (!trimmed || trimmed.length < 2) {
      setErr('min 2 znaky')
      return
    }
    if (trimmed === tx.category) {
      setOpen(false)
      return
    }
    setBusy(true)
    setErr(null)
    const res = await apiFetch<{ category: string }>(`/api/ai/transactions/${tx.id}/category`, {
      method: 'PATCH',
      body: JSON.stringify({ category: trimmed }),
    })
    setBusy(false)
    setOpen(false)
    if (res.ok) {
      setValue(res.data.category)
      onChange(res.data.category)
    } else {
      setErr(res.error)
    }
  }

  function pickOption(opt: string) {
    setValue(opt)
    void commit(opt)
  }

  const widthClass = size === 'compact' ? 'w-[170px]' : 'w-[210px]'
  const isUncategorised = UNCATEGORISED.has(tx.category)

  return (
    <div ref={wrapRef} className={`relative inline-flex flex-col gap-0.5 ${widthClass}`}>
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!open) setOpen(true)
              setHighlight((h) => Math.min(filtered.length - 1, h + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight((h) => Math.max(0, h - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (open && filtered[highlight]) {
                pickOption(filtered[highlight])
              } else {
                void commit(value)
              }
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setValue(tx.category)
              setOpen(false)
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === 'Tab') {
              // Don't preventDefault — let tab move focus naturally; commit on the way out
              void commit(value)
            }
          }}
          maxLength={60}
          placeholder={isUncategorised ? 'vyber kategóriu' : undefined}
          className={[
            'w-full bg-stone/40 border border-border-dim rounded-[3px] pl-2 pr-7 py-1 font-heading text-[0.65rem] uppercase tracking-widest outline-none',
            'hover:border-gold focus:border-gold-bright focus:bg-stone/70 transition-all',
            'placeholder:normal-case placeholder:text-text-muted placeholder:italic placeholder:tracking-normal placeholder:text-[10px]',
            isUncategorised ? 'border-gold-dim/40' : tone,
          ].join(' ')}
          title={
            tx.categorizedBy === 'ai'
              ? `AI · confidence ${Math.round((tx.aiConfidence ?? 0) * 100)}%`
              : tx.categorizedBy === 'user'
              ? 'Ručne upravené — klikni pre zmenu'
              : 'Nezaradené — klikni pre výber'
          }
        />
        <button
          type="button"
          onMouseDown={(e) => {
            // Use mousedown so the menu toggles BEFORE the input's blur fires
            e.preventDefault()
            setOpen((o) => !o)
            inputRef.current?.focus()
          }}
          tabIndex={-1}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gold-dim hover:text-gold-bright transition-colors"
          aria-label="Otvor zoznam kategórií"
        >
          <span className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
      </div>

      {/* Dropdown menu — rendered via portal to escape parent overflow:hidden */}
      {open && menuRect &&
        createPortal(
          <ul
            ref={listRef}
            data-category-menu="true"
            className="z-50 max-h-60 overflow-auto bg-obsidian border border-gold/40 rounded-[3px] shadow-card py-1"
            style={{
              position: 'fixed',
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              boxShadow:
                '0 8px 24px rgba(90,69,39,0.18), 0 0 16px rgba(160,120,32,0.12)',
            }}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 font-ui text-xs italic text-text-muted">
                Žiadny match — Enter uloží „{value}" ako novú kategóriu.
              </li>
            ) : (
              filtered.map((opt, i) => {
                const isCurrent = opt === tx.category
                const isHi = i === highlight
                return (
                  <li
                    key={opt}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault() // keep input focused while we save
                      pickOption(opt)
                    }}
                    className={[
                      'px-3 py-1.5 font-heading text-[0.65rem] uppercase tracking-widest cursor-pointer transition-colors flex items-center justify-between gap-2',
                      isHi
                        ? 'bg-gold/15 text-gold-bright'
                        : isCurrent
                        ? 'text-gold'
                        : 'text-text-secondary hover:bg-gold/5 hover:text-gold-bright',
                    ].join(' ')}
                  >
                    <span>{opt}</span>
                    {isCurrent && <span className="text-[10px]">✓</span>}
                  </li>
                )
              })
            )}
          </ul>,
          document.body,
        )}

      {err && <span className="font-ui text-[10px] text-crimson-bright italic">{err}</span>}
    </div>
  )
}
