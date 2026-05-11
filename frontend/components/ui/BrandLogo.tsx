import logoUrl from '../../assets/logo.png'

/**
 * Brand mark for "Nula na účte — Raul uprace tvojej financie. Lebo ty nevieš. Zadarmo.".
 *
 * Hand-drawn sepia sketch portrait — bushy beard + cigar.
 * Rendered as a circular crop with a subtle gold ring so it reads as a "mark"
 * even at small sizes. The sepia palette of the source artwork lines up with
 * the gold accent of the rest of the design system.
 */
export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative inline-block overflow-hidden rounded-full border border-gold/30 bg-stone/40 align-middle ${className}`}
      style={{
        boxShadow:
          '0 0 0 1px rgba(201,151,42,0.15) inset, 0 0 16px rgba(201,151,42,0.18), 0 2px 8px rgba(0,0,0,0.4)',
      }}
      aria-label="Nula na účte logo"
      role="img"
    >
      <img
        src={logoUrl}
        alt=""
        className="block w-full h-full object-cover"
        // Tightly framed crop — nudges the face into the circle viewport.
        // The source has a lot of beard at the bottom and forehead at the top
        // that we don't need for an icon.
        style={{
          objectPosition: '50% 35%',
          filter: 'contrast(1.05) saturate(1.05)',
        }}
        draggable={false}
      />
    </span>
  )
}
