import logoUrl from '../../assets/raul.png'

/**
 * Brand mark for "Nula na účte — Raul uprace tvoje financie. Lebo ty nevieš. Zadarmo.".
 *
 * Stylised portrait of Raul (the in-app financial wizard): bearded man in a
 * purple robe inside a gold ring, on a parchment-cream backdrop.
 *
 * The artwork already contains its own gold ring and circular composition,
 * so the wrapper just clips the square PNG into a disc (kills the cream
 * corners on dark theme) and adds a subtle ambient gold glow. No extra
 * outer ring — that would compete with the ring drawn into the artwork.
 *
 * Sizing: pass tailwind w-* h-* utilities via `className`. Pick sizes that
 * match the cap-height of the adjacent "Nula na účte" text:
 *   - small UI (sidebar):       w-9 h-9   (36px) next to text-2xl
 *   - info shells:              w-10 h-10 (40px) next to text-3xl
 *   - splash/login title:       w-14 h-14 (56px) next to text-5xl
 *   - inline byline (Raul):     w-7 h-7   (28px) next to text-lg
 */
export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative inline-block align-middle shrink-0 overflow-hidden rounded-full ${className}`}
      aria-label="Nula na účte logo"
      role="img"
      style={{
        filter:
          'drop-shadow(0 0 8px rgba(201,151,42,0.28)) drop-shadow(0 2px 6px rgba(0,0,0,0.22))',
      }}
    >
      <img
        src={logoUrl}
        alt=""
        className="block w-full h-full object-cover select-none"
        // Slight scale-up pushes the gold ring drawn into the artwork right
        // out to the edge of the circular clip, eliminating the thin cream
        // margin that would otherwise show on dark theme.
        style={{ transform: 'scale(1.06)' }}
        draggable={false}
      />
    </span>
  )
}
