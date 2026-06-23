# Design System

*"Pergamen pri sviečkovom svetle"* — light parchment theme with gold accents and wizarding microcopy. Single theme; dark mode was tried in early versions and removed in v0.6.

---

## Tokens (`frontend/styles.css`)

Tailwind v4 uses `@theme {}` block instead of `tailwind.config.js`. All design tokens are CSS custom properties under the `--color-*`, `--font-*`, `--shadow-*` namespace; Tailwind auto-generates utilities for each (`bg-gold-bright`, `text-text-primary`, …).

### Colors

```
/* Always-dark — used for text on gold buttons + modal overlays */
--color-ink:           #0a0608

/* Surfaces */
--color-void:          #faf3e0   /* page bg — warm parchment */
--color-obsidian:      #fffef9   /* cards — off-white */
--color-stone:         #f1e7cc   /* subtle bg / input bg */
--color-dungeon:       #ede2c4   /* toasts / strong accent surfaces */
--color-parchment:     #f4ead5
--color-aged:          #e8d9b5

/* Gold accents */
--color-gold-dim:      #5a4500
--color-gold:          #a07820
--color-gold-bright:   #b8842a
--color-gold-glow:     #ffd700

/* Status colors */
--color-crimson:       #8b1a1a    /* dim */
--color-crimson-bright:#a52a2a    /* errors, expenses */
--color-cobalt:        #0f2d5e
--color-cobalt-bright: #1a4a9c    /* info, AI-set categories */
--color-emerald:       #0a3d1f
--color-emerald-bright:#1a6b3a    /* income, success */

/* Bonus accents (rare use) */
--color-magic:         #4fc3f7
--color-fire:          #ff6b00

/* Text */
--color-text-primary:  #1c1620    /* body */
--color-text-secondary:#5a4527    /* secondary copy */
--color-text-muted:    #8a7350    /* hints, captions */
--color-text-accent:   #7a5c1e    /* highlights */

/* Borders — brown-tinted for visibility on cream */
--color-border:        rgba(122,92,30,0.35)
--color-border-bright: rgba(122,92,30,0.65)
--color-border-dim:    rgba(122,92,30,0.15)
```

### Shadows

```
--shadow-gold:       0 0 8px rgba(160,120,32,0.25), 0 0 24px rgba(160,120,32,0.15)
--shadow-gold-hover: 0 0 12px rgba(160,120,32,0.4),  0 0 40px rgba(160,120,32,0.2)
--shadow-card:       0 8px 32px rgba(90,69,39,0.15)
```

### Fonts

| Token | Family | Use |
|---|---|---|
| `--font-display` | Cinzel Decorative | Hero `<h1>` headlines |
| `--font-heading` | Cinzel | Section headings, labels, tags, buttons (uppercase + tracking-widest) |
| `--font-body` | IM Fell English | Body copy, transaction notes |
| `--font-ui` | Cormorant Garamond | Italic captions, "ako keby písané husacím brkom" mikrocopy |

Loaded from Google Fonts (`@import url(...)` at top of `styles.css`). Fallback: Georgia, serif.

---

## Type scale

| Class | Px | Typical use |
|---|---|---|
| `text-display` / `font-display text-5xl` | 48 | Splash page hero |
| `font-display text-3xl sm:text-4xl md:text-5xl` | 30→48 | Page headers (responsive) |
| `font-heading text-xl` | 20 | Section H2 |
| `font-heading text-base` / `text-sm` | 16 / 14 | Card titles |
| `font-heading text-xs uppercase tracking-widest` | 12 | UI labels, buttons |
| `font-heading text-[0.65rem] uppercase tracking-widest` | 10.4 | Tiny eyebrows |
| `font-body text-base` | 16 | Body copy |
| `font-ui italic text-xs` | 12 | Captions, hints |

---

## Layout primitives

### Card
`frontend/components/ui/Card.tsx`

```tsx
<Card>
  <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
    ✦ Sekciový eyebrow
  </p>
  <h2 className="font-heading text-xl text-text-primary mb-4">Card title</h2>
  {/* content */}
</Card>
```

- Bg `bg-obsidian/80` + backdrop blur
- 1px border + 6px inner gold ring
- Four `✦` corner stars
- `shadow-card`

### StatCard
Big number display with tone-coloured accent.

```tsx
<StatCard
  label="Príjmy (Apríl 2026)"
  value="2 340 €"
  hint="14 pohybov"
  tone="emerald"
  icon="⚜"
/>
```

Tones: `gold` / `emerald` / `crimson` / `cobalt`.

### MonthPicker
Dropdown + arrows pre month navigation. Auto-populated from `/api/months`.

---

## Component library

| File | Role |
|---|---|
| `layout/Layout.tsx` | Authed wrapper — sidebar + main + Clippy |
| `layout/Sidebar.tsx` | Nav, theme-of-self, user block. Drawer mode on `<lg` |
| `layout/MobileTopBar.tsx` | Sticky top bar on `<lg` only |
| `layout/AuthShell.tsx` | Splash shell for login/register/etc. Centred card + floating top-right links |
| `layout/InfoShell.tsx` | Long-form doc shell (Privacy, Bezpečnosť, Návod, Ako to funguje) |
| `ui/Card.tsx` | Generic surface |
| `ui/MonthPicker.tsx` | Month selector |
| `ui/Charts.tsx` | `IncomeExpenseBarChart`, `Sparkline`, `HorizontalBars`, `CategoryTrendChart`, `CategoryLegend` (all inline SVG, no library) |
| `ui/CategorySelect.tsx` | Combobox: input + portal-rendered dropdown |
| `ui/AIButtons.tsx` | `CategorizeButton`, `RaulPanel`, `RaulMarkdown` |
| `ui/RaulClippy.tsx` | Floating mascot with typewriter tips |
| `ui/FeedbackWidget.tsx` | 📮 sidebar pill + modal |
| `ui/BrandLogo.tsx` | Raul portrait, transparent PNG |
| `ui/PoweredBy.tsx` | Footer badges (Powered by OpenAI / Secured by Vercel) |

---

## Responsive breakpoints

Stock Tailwind:
- `sm`: ≥ 640 px
- `md`: ≥ 768 px
- `lg`: ≥ 1024 px (sidebar appears)
- `xl`: ≥ 1280 px
- `2xl`: ≥ 1536 px

**Mobile-first.** Default styles target mobile; `sm:` / `md:` / `lg:` progressively layer on for bigger viewports.

Sidebar appears at `lg+`. Below that → hamburger + slide-in drawer. See [MOBILE.md](./MOBILE.md).

---

## Iconography

No icon library. Used:
- **Unicode glyphs** — ✦ ✧ ⚜ ⚖ ⚱ ☥ ◊ ⌂ ⌬ ⌫ ⚙ ⛤ 🜔 ⚸ ⚛ ⚹ ⚺ ⚻ — wizarding alphabet vibe
- **Emoji** — 📜 🪄 ⚡ 🔮 🦉 🛡 ✕ — used sparingly (one per surface)
- **Custom SVG marks** in `PoweredBy.tsx` (OpenAI knot, Vercel triangle)
- **Brand portrait** — `raul.png` (242×256 transparent PNG)

---

## Microcopy guidelines

The voice is **"jemne magické, sucho ironické, slovensky"** — wizarding metaphors as flavor, never as full sentences. Examples used throughout:

- Trezor (vault) = bank account
- Galeóny (galleons) = money
- Apparátor / dementor = mood metaphors
- Sova (owl) = email notification
- Pergamen = document / statement
- Komnata = section / room
- Veštba = AI prediction / recommendation

Don't over-do it. One wizarding word per paragraph max. Real numbers + concrete observations > flowery prose.

---

## Motion

- `reveal` animation (CSS `unfurl` keyframes) — fades + slides up on mount, used on every section
- `reveal-1` … `reveal-6` — stagger delays 0/80/160/240/320/400 ms
- `float` animation — gentle vertical loop (8s) for ambient background glows
- `flicker` animation — opacity wobble (4s) for "loading" placeholders

Transitions default to 200ms (`transition-all duration-200`).

---

## Accessibility

- All form inputs have `<label>` (or `aria-label`)
- All buttons that are icon-only have `title` + `aria-label`
- Color is never the sole signal — gold/cobalt/crimson always paired with a text label or symbol
- `prefers-reduced-motion` NOT respected yet — TODO
- WCAG contrast: parchment + text-primary = 11.3:1 (AAA); muted text = 4.5:1 (AA)

---

## Email design

Inline-styled HTML tables (no `<style>` block — survives Gmail/Outlook quirks). Light parchment palette identical to in-app, all hex hardcoded since `var(--color-*)` doesn't work in most email clients.

See `src/lib/email.ts` (verify + reset) and `src/lib/email-reports.ts` (weekly + monthly reports) for templates.

---

## What got removed

- **Dark theme** (Nox) — removed v0.6. Old palette is in git history if needed.
- **Theme toggle** (Lumos/Nox button) — removed from Sidebar, AuthShell, InfoShell.
- **useTheme hook** — deleted.
- **`data-theme` attribute init script** in `index.html` — gone.
