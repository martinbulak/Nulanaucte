# Roadmap

What's done, what's planned, what's explicitly NOT on the table.

---

## ✅ Done (v0.6)

### Core
- ✅ Multi-user auth with email verify + password reset
- ✅ Account lockout + rate limiting (login + AI)
- ✅ Open registration (with allowlist option for forks)
- ✅ GDPR export + account deletion + cascade
- ✅ Admin role (technical stats only, no financial data)

### Imports
- ✅ SLSP PDF + CSV
- ✅ Tatra CSV
- ✅ Revolut CSV
- ✅ Drag-and-drop UX with preview
- ✅ Deduplication via fingerprint
- ✅ Per-user bank registry (15 SK/EU options)

### AI
- ✅ GPT-4o-mini categorization with merchant extraction
- ✅ Rule-based fallback (works offline)
- ✅ Per-user merchant_rules (memory across imports)
- ✅ Raul long-form recommendations (top 3 actionable)
- ✅ Clippy floating mascot with 12 short tips
- ✅ Stub responses never cached → no permanent pollution from transient failures
- ✅ Fallback reason surfaced to UI

### Dashboard
- ✅ Cashflow summary cards
- ✅ Top 6 category mini-tiles
- ✅ 6-month stacked category trend
- ✅ 6-month income vs expense bar chart + sparkline
- ✅ Recent transactions with inline category editing
- ✅ Smart default month (last with data)
- ✅ Splátky úverov from real transactions (not configured mortgages)

### UX
- ✅ Light parchment theme (single theme)
- ✅ Mobile-friendly layout (drawer sidebar, scrollable tables)
- ✅ Návod (14-section user manual)
- ✅ Privacy / Bezpečnosť / Ako to funguje info pages
- ✅ Feedback widget → email to maintainer
- ✅ User name shown in sidebar (fallback email)
- ✅ Settings: bank checklist, category registry, Clippy mode/size

### Email reports
- ✅ Weekly + monthly via Vercel Cron
- ✅ Parchment-styled HTML with Raul medailón
- ✅ Frequency / off configurable per user

### Deploy
- ✅ Vercel + Neon + Resend + OpenAI
- ✅ Custom domain (nulanaucte.sk)
- ✅ www → root redirect
- ✅ DNS auto-provisioned cert (Let's Encrypt)

---

## 📋 Planned (next milestones)

### v0.7 — usability polish
- [ ] Charts respect `prefers-reduced-motion`
- [ ] Inline category edit on mobile (currently usable but cramped at 360 px)
- [ ] Better empty states across `/banky`, `/hypoteky`, `/prijmy`
- [ ] Loading skeletons for slow connections (Dashboard especially)
- [ ] Keyboard shortcuts: `g d` → dashboard, `g v` → výdavky, etc.

### v0.8 — more banks
- [ ] **VÚB** auto-detection (CSV)
- [ ] **ČSOB** auto-detection (CSV)
- [ ] **365.bank** auto-detection
- [ ] **mBank** auto-detection
- [ ] **Wise** CSV parser

Each is ~50 lines of regex + format mapping; details in [IMPORTS.md](./IMPORTS.md).

### v0.9 — analytics depth
- [ ] Monthly budget setting per category (e.g. "Reštaurácie cap: 200 €")
- [ ] Trend alerts: "Tvoje Reštaurácie sú o 60 % vyššie než priemer posledných 3 mes."
- [ ] Year-over-year comparison view
- [ ] Goal tracking (sporenie X € / mes, dosiahnuté Y %)

### v1.0 — polish for public
- [ ] Real onboarding wizard (replace "Začni tu" page with interactive)
- [ ] Mobile app (PWA install — manifest + service worker)
- [ ] i18n scaffolding (currently hardcoded slovak, add `t('key')` wrapper)
- [ ] OAuth login (Google, GitHub) alongside password
- [ ] Public API tokens for users (read-only export endpoint)

---

## 💭 Considered but parked

### Per-merchant budgeting
"Tesco: 250 € / mes max" — useful but requires UI for budget management, alerts, dashboard widget. ~2 weeks of work; deferred until usage data shows demand.

### Recurring transaction detection
Auto-spot "Spotify 9.99 €" appearing monthly → tag as subscription. Cool but AI categorization handles the categorization angle; visualisation is the missing piece.

### Family / shared accounts
Multi-user splitting of a single transaction ("Nákup 80 €: 40 € ja, 40 € partner"). Requires social model (invites, shares). Big scope creep; users with shared budgets can run two instances.

### Open Banking (PSD2)
Auto-fetch transactions from banks via real API. Slovak market has weak PSD2 coverage for personal-use APIs; the cost of integrating with Tink/Truelayer outweighs the benefit when manual PDF import works.

### Investment tracking
Stock portfolio + crypto. Different domain — better solved by purpose-built tools (Sharesight, Finary).

### Tax export
Slovak tax form structure changes yearly; needs a dedicated maintainer. Out of scope.

---

## 🚫 Explicit non-goals

- **❌ Crypto market data integration** — different beast, different audience
- **❌ Receipt OCR** — overkill for personal use; PDF import is good enough
- **❌ Multi-currency conversions** — most SK users are EUR-only; CZK/USD users can use Wise CSV
- **❌ White-label / SaaS reselling** — single-purpose tool, fork it if you want
- **❌ Mobile native app** — PWA covers 95% of the need; native apps need maintenance overhead

---

## How to influence the roadmap

- **Use the in-app feedback widget** — 📮 in sidebar → modal → emails me
- **Open an issue** on GitHub: https://github.com/martinbulak/Nulanaucte/issues
- **PR a small feature** — see [CONTRIBUTING.md](../CONTRIBUTING.md)

Most-requested features bubble up.
