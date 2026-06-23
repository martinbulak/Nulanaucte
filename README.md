# Nula na účte

> *Raul uprace tvoje financie. Lebo ty nevieš. Zadarmo.*

Personal finance tracker pre Slovákov — bankové výpisy v PDF/CSV, AI kategorizácia výdavkov, dlhodobé trendy, mesačné reporty a Raul (vtipný finančný manažér v podobe čarodejníka).

**Stack:** React 18 + Vite + Hono + Drizzle ORM + Neon Postgres + Resend + OpenAI GPT-4o-mini.
**Deploy:** Vercel.
**Doména:** [nulanaucte.sk](https://nulanaucte.sk).

---

## 📖 Dokumentácia

| Súbor | O čom je |
|---|---|
| [docs/BLUEPRINT.md](./docs/BLUEPRINT.md) | **Začni tu.** Krok-za-krokom ako forknúť projekt a postaviť si vlastnú verziu |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Systémová architektúra — vrstvy, request flow, invarianty |
| [docs/DESIGN.md](./docs/DESIGN.md) | Design system — paleta, typografia, komponenty, responsive |
| [docs/DATABASE.md](./docs/DATABASE.md) | Drizzle schéma, migrácie, key per tabuľka |
| [docs/API.md](./docs/API.md) | REST endpointy + payload reference |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Vercel + Neon + Resend + OpenAI + custom doména |
| [docs/AI.md](./docs/AI.md) | AI features deep-dive: prompty, ceny, fallback semantika |
| [docs/IMPORTS.md](./docs/IMPORTS.md) | CSV/PDF parser dizajn — ako pridať novú banku |
| [docs/FEATURES.md](./docs/FEATURES.md) | Katalóg features s krátkym popisom každej |
| [docs/MOBILE.md](./docs/MOBILE.md) | Responsive design notes |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Čo je hotové, čo bude |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Dev workflow + PR pravidlá |
| [CHANGELOG.md](./CHANGELOG.md) | Verzie a notable changes |
| [SECURITY.md](./SECURITY.md) | Bezpečnostný status |
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | 37-nálezový audit |

---

## ⚡ Hlavné features

### Multi-user, GDPR-friendly
- Otvorená registrácia + email verification
- Password reset
- Account deletion s cascade na všetky dáta
- JSON / CSV export pre data portability

### Import bankových výpisov
- **PDF aj CSV** — auto-detekcia formátu
- **Podporované banky:** SLSP (PDF + George CSV), Tatra (CSV), Revolut (CSV) s auto-importom; ďalších 12 SK + neobanky cez manuálny formát-picker
- **Drag & drop** alebo file picker
- **Deduplication** cez `(bank_id, fingerprint)` unique index — bezpečné re-importy
- Náhľad pred uložením so summary, počtom duplikátov, chybami

### AI kategorizácia (GPT-4o-mini, ~$0.001 / import)
- Batch processing s rule-based fallback ak nie je OpenAI key
- **Merchant extrakcia** — z „Platba kartou TESCO PETRZALKA…" → merchant: „Tesco"
- **Per-user rules** — tvoje manuálne úpravy sa pamätajú, ďalší import preskakuje AI pre známe obchody
- 12 stub regexov ako rýchla cesta pre časté merchants (Wolt, Bolt, Slovnaft, Tesco, Lidl, ...)
- Re-analyze button pretriedi všetko (zachová tvoje manuálne overrides)
- Číselník kategórií per type (výdavky / príjmy), CRUD v `/nastavenia`

### Raul Rodriguez — finančný manažér AI
- Po importe klikneš „Spýtať sa Raula" → vygeneruje top 3 odporúčania s konkrétnymi sumami
- Cache per (user, month) — druhé otvorenie zdarma
- Filteruje „Iné" z analýzy, nedáva investičné/úverové/poistné rady

### Clippy — floating mascot s tipmi
- Pravý dolný roh, typewriter efekt
- 12 vtipných tipov vygenerovaných z rovnakých dát ako Raul (side-effect)
- 3 režimy (zapnuté / iba avatar / vypnuté) + 3 veľkosti — konfig v Settings

### Dashboard
- Mesačný cashflow (príjmy / výdavky / splátky úverov)
- Top 6 výdavkových kategórií ako mini-tiles
- 6-mesačný stacked trend kategórií
- 6-mesačný income vs expense bar chart + net sparkline
- Posledné transakcie s editovateľnou kategóriou inline
- Default mesiac = predchádzajúci kalendárny (alebo posledný s dátami)

### Email reporty
- Týždenné / mesačné cez Vercel Cron
- Parchment design (Lumos theme) — všetky inline štýly
- Raul medailón v hornom paneli aj pri odporúčaniach
- Frequency / off konfig v Settings

### Banks registry
- 15 SK/SK-používaných inštitúcií (klasické + stavebné sporiteľne + neobanky)
- Checkbox enable/disable v Settings — disabled banky ostávajú v DB s transakciami, len sa skryjú
- „Iná banka (manuálne)" pre custom záznam

### Feedback widget
- 📮 v sidebare → modál (chyba / nápad / iné) → POST /api/feedback → email maintainerovi
- Rate-limit 5/h

### Účet & UX
- **Single light theme** (Lumos — parchment by candlelight). Dark mode zrušený
- **Mobile-friendly** od v0.6 — slide-in drawer namiesto sidebaru, scrollovateľné tabuľky
- **Návod** stránka s 14-sekciovým user manuálom
- **Privacy / Bezpečnosť / Ako to funguje** verejné info stránky (aj pred prihlásením)

---

## ⚡ Quick start (lokálne)

```bash
# 1. Klonuj
git clone https://github.com/martinbulak/Nulanaucte.git
cd Nulanaucte
npm install

# 2. .env
cp .env.example .env
# Vyplň aspoň DATABASE_URL (Neon free tier)

# 3. Schema
npx drizzle-kit push --force

# 4. Dev server
npm run dev
# → http://localhost:8787
```

Dev seed user: email `koduvanica`, heslo `koduvanica`.

Plný onboarding (Vercel + Neon + Resend + OpenAI) → [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

---

## 🔧 Príkazy

```bash
npm run dev            # Vite + Hono dev server na :8787
npm run build          # tsc -b && vite build → dist/
npm run preview        # serve prod build lokálne

npx drizzle-kit push   # apply schema do DB
npx drizzle-kit studio # GUI DB browser
```

---

## 📜 Licencia

MIT. Klonuj, hostuj, modifikuj. Kredit poteší ale nie je povinný.

Open-source repo: [github.com/martinbulak/Nulanaucte](https://github.com/martinbulak/Nulanaucte)
