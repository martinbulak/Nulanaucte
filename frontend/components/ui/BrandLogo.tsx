import logoUrl from '../../assets/raul.png'

/**
 * Brand mark for "Nula na účte — Raul uprace tvoje financie. Lebo ty nevieš. Zadarmo.".
 *
 * Stylised portrait of Raul (the in-app financial wizard): bearded man in a
 * purple robe inside a gold ring. The source PNG already has a transparent
 * background and its own circular ring composition, so we render it as-is
 * with object-contain (no clipping needed, the alpha channel handles the
 * non-circle area). The wrapper only adds a subtle ambient gold glow.
 *
 * Sizing: pass tailwind w-* h-* utilities via `className`. Pick sizes that
 * match the cap-height of the adjacent "Nula na účte" text:
 *   - small UI (sidebar):       w-9 h-9   (36px) next to text-2xl
 *   - info shells:              w-10 h-10 (40px) next to text-3xl
 *   - splash/login title:       w-14 h-14 (56px) next to text-5xl
 *   - inline byline (RaulPanel) w-12 h-12 (48px) next to text-xl
 */
export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative inline-block align-middle shrink-0 ${className}`}
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
        className="block w-full h-full object-contain select-none"
        draggable={false}
      />
    </span>
  )
}
