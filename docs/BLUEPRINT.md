# Blueprint — postav si vlastnú verziu

Toto je „fork a rebrand" guide. Ak chceš na svojej doméne podobnú appku — Slovák importuje výpisy, AI to triedi, dashboard ukáže kam tečú peniaze — týmto postupom sa tam dostaneš za 1–2 hodiny.

> **TL;DR:** klonuj → 4 services accounty (Neon, Vercel, Resend, OpenAI) → vyplň env vars → push → ide.

---

## 1. Predtým než začneš

### Čo potrebuješ
- **GitHub účet** (free)
- **Vercel účet** (free hobby tier)
- **Neon Postgres** (free 0.5 GB)
- **OpenAI API key** (~$5 kreditu vystačí na rok pre osobnú appku)
- **Resend** (free 100 emailov/deň, 3000/mes — viac než dosť)
- **Doménu** (voliteľné — Vercel ti dá `.vercel.app` subdoménu zadarmo)

Mesačná cena ak používaš sám: **0 €**. Ak by si pustil pre 10–50 ľudí: **~$2–5 / mes** (OpenAI dominuje).

### Čo ti táto appka NEROBÍ
- ❌ Open Banking / PSD2 — neexistuje Slovenský provider so spoľahlivým prístupom k SK bankám pre osobné použitie. Appka vie čítať PDF/CSV výpisy, ktoré si stiahneš ručne.
- ❌ Daňové priznania
- ❌ Sledovanie investícií v reálnom čase
- ❌ Splátkový kalendár hypotéky s diff vs realita (len ručná evidencia)

---

## 2. Klon + rebrand

```bash
git clone https://github.com/martinbulak/Nulanaucte.git mojafin
cd mojafin
rm -rf .git
git init && git add -A && git commit -m "Initial fork"
```

### Premenovať produkt

Hľadaj a nahraď tieto stringy:

| Old | New (príklad) | Kde |
|---|---|---|
| `Nula na účte` | „Moja Financia" | brand v UI, emaily, návod |
| `nulanaucte.sk` | `mojafin.com` | README, vercel.json, env defaults |
| `Raul uprace tvoje financie. Lebo ty nevieš. Zadarmo.` | tvoj slogan | sidebar, login, emaily |
| `Raul` (persona) | tvoj maskot | AI prompty (`src/lib/ai.ts`), UI (RaulPanel, RaulClippy) |
| Wizarding mikrocopy (galeóny, Apparátor, dementor, sova) | tvoj theme | celé UI |

VSCode global find/replace ti to spraví za 10 minút. **Pozor na CSP** v `vercel.json` — ak meníš subdoménu, premysli si `connect-src`.

### Vymeň logo
- Nahraď `frontend/assets/raul.png` (242×256 PNG s transparentným pozadím) svojím obrázkom
- Nahraď `public/raul.png` (rovnaký súbor — slúži ako stabilná URL pre emaily)
- Komponenta: `frontend/components/ui/BrandLogo.tsx` (nemení sa, len `import logoUrl from './raul.png'` ti načíta nový)

### Slovenské vs iné jazyky
Všetky UI texty sú v slovenčine, hardcoded — nie i18n. Ak chceš inú lokalizáciu, je to **veľká refaktorizácia** (každý komponent prepísať). Najjednoduchšie: nechaj slovenčinu, alebo prelož ručne hľadaním-nahrádzaním.

---

## 3. Service setup (15 min)

### 3a. Neon Postgres
1. [neon.tech](https://neon.tech) → Sign up → New Project
2. Region najbližšie k tebe (Frankfurt pre SK / EU)
3. Skopíruj **Connection string** (`postgresql://...neon.tech/neondb?sslmode=require`)

### 3b. Vercel
1. [vercel.com](https://vercel.com) → New Project → Import z tvojho GitHub repa
2. Framework preset: **Vite** (auto-detect)
3. Build command: `npm run build`
4. Output: `dist`
5. **Neclikni Deploy yet** — najprv pridaj env vars

### 3c. Resend (email)
1. [resend.com](https://resend.com) → API Keys → Create → `re_xxx...`
2. Voliteľné: Add Domain pre `noreply@tvojadomena.com` (vyžaduje DNS DKIM/SPF)
3. Bez vlastnej domény: posielanie funguje len na adresu owner-a Resend účtu (testing limit)

### 3d. OpenAI
1. [platform.openai.com](https://platform.openai.com) → API Keys → Create → `sk-proj-xxx...`
2. Pridaj $5 prepaid credit (Settings → Billing)
3. Model `gpt-4o-mini` je default — najlacnejší schopný model

### 3e. Vercel env vars
V Vercel Project Settings → Environment Variables (Production scope):

```
DATABASE_URL              postgresql://...neon.tech/...
JWT_SECRET                <openssl rand -base64 48>
RESEND_API_KEY            re_xxx
OPENAI_API_KEY            sk-proj-xxx
PUBLIC_ORIGIN             https://tvojadomena.com (alebo .vercel.app URL)
EMAIL_FROM                Tvoja Appka <noreply@tvojadomena.com>
CRON_SECRET               <openssl rand -hex 32>
INBOUND_WEBHOOK_SECRET    <openssl rand -hex 32>  (povinné v prod aj ak inbound nepoužívaš)
```

### 3f. Custom doména (voliteľné)
1. Vercel Project → Settings → Domains → Add `tvojadomena.com`
2. Vercel ti povie aký DNS record nastaviť (A 76.76.21.21 alebo CNAME na `cname.vercel-dns.com`)
3. Vercel automaticky vystaví Let's Encrypt cert (1-5 min)
4. Pridaj aj `www.tvojadomena.com` → vyber „Redirect to tvojadomena.com" v UI

### 3g. Push + deploy
```bash
git remote add origin https://github.com/teba/mojafin.git
git push -u origin main
```
Vercel auto-deployne za ~60s. Na produkcii ide automatická DB migrácia pri prvom requeste (cez `ensureSeeded()` v `src/db.ts`).

---

## 4. Customizácia features

Decision tree — ktoré features chceš/nechceš:

### Banky (`src/lib/banks.ts`)
Predvolených 15 SK/EU. Pre iný trh (CZ, AT, DE):
- Edituj `KNOWN_BANKS` array — pridaj svoje, odstráň irelevantné
- `parserSupport: 'auto'` = už máme parser pre formát
- `parserSupport: 'csv'` = user musí ručne vybrať najbližší formát (SLSP/Tatra/Revolut)
- `parserSupport: 'none'` = iba manuálne zadávanie

Pre **nový auto-parser**: pozri [docs/IMPORTS.md](./IMPORTS.md).

### AI prompty (`src/lib/ai.ts`)
Tri prompty:
1. **`SYSTEM_PROMPT`** — kategorizácia transakcií (cca 80 riadkov heuristík)
2. **`RAUL_PROMPT`** — dlhé odporúčania (15-ročný finančný manažér persona)
3. **`CLIPPY_PROMPT`** — krátke vtipné tipy pre floating mascot

Ak meníš persóna / jazyk / tone-of-voice, edituj tieto. Examples in-prompt sú dôležité — drž ich, prepíš na vlastné.

**Pozor na kategórie:** `VYDAVOK_STARTERS` (37 položiek) a `PRIJEM_STARTERS` (12) sú default zoznamy v dropdownoch. Pre iný trh možno chceš iné (US: „Health insurance", „401k contribution" atď.).

### Email templates (`src/lib/email.ts`, `src/lib/email-reports.ts`)
- Šablóny sú HTML inline-styled (kvôli email klientom). Light parchment paleta = hex hodnoty na hardcoded.
- Ak meníš branding, prejdi všetky `<p>`, `<table>` štýly a swapni farby.
- `verifyEmailTemplate`, `passwordResetTemplate`, `weeklyReportTemplate`, `monthlyReportTemplate` — to sú primárne.

### Cron schedule (`vercel.json`)
```json
"crons": [
  { "path": "/api/reports/run/weekly", "schedule": "0 8 * * 1" },
  { "path": "/api/reports/run/monthly", "schedule": "0 8 1 * *" }
]
```
Pondelok 8:00 UTC / 1. v mesiaci 8:00 UTC. UTC! Slovenský čas = UTC+1 (zima) / UTC+2 (leto). Ak chceš lokálne 8:00, posunúť o 1–2.

Vercel free tier dovoľuje 2 crons. Hobby tier = unlimited.

### Theme & design
- **Single light theme** (parchment by candlelight). Tokeny v `frontend/styles.css` `@theme` block.
- Ak chceš corporate look, zmeň `--color-gold-*` na firemnú farbu + `--color-text-*` na neutrálnu.
- Detaily: [docs/DESIGN.md](./DESIGN.md)

### Strip features čo nepotrebuješ

| Feature | Súbory na odstránenie | Poznámka |
|---|---|---|
| Hypotéky | `src/routes/mortgages.ts`, `frontend/pages/Hypoteky.tsx`, nav item v `Sidebar.tsx`, `mortgages` tabuľka v `schema.ts` | |
| Admin | `src/routes/admin.ts`, `frontend/pages/Admin.tsx`, route v `App.tsx` | |
| Inbound email webhook | `src/routes/inbound.ts`, env `INBOUND_WEBHOOK_SECRET` | Aj tak nepoužívaš ak nemáš Resend Pro |
| Clippy mascot | `frontend/components/ui/RaulClippy.tsx`, mount v `Layout.tsx`, `clippy_tips` tabuľka | |
| Feedback widget | `src/routes/feedback.ts`, `frontend/components/ui/FeedbackWidget.tsx` | |
| Návod / Privacy / How-it-works | `frontend/pages/Navod.tsx`, `Privacy.tsx`, `Security.tsx`, `HowItWorks.tsx`, `InfoShell.tsx` | Aj routy v App.tsx |

---

## 5. Branding checklist

Pred public launch over:

- [ ] Brand mená vyhľadané + nahradené (Nula na účte, Raul, nulanaucte.sk)
- [ ] Logo v `frontend/assets/raul.png` + `public/raul.png` nahradené
- [ ] Favicon v `index.html` (SVG inline emoji) zmenený
- [ ] `<title>` v `index.html` zmenený
- [ ] AI prompty (`src/lib/ai.ts`) — persóna upravená
- [ ] Email templates — branding okrúhle
- [ ] Návod (`frontend/pages/Navod.tsx`) — texty / sekcie aktualizované
- [ ] Privacy policy (`frontend/pages/Privacy.tsx`) — kontakt + údaje
- [ ] `EMAIL_FROM` env var na tvoju doménu
- [ ] `PUBLIC_ORIGIN` env var = tvoja produkčná URL
- [ ] CSP v `vercel.json` ak meníš connect-src/img-src
- [ ] README + LICENSE → tvoj credit / forky link

---

## 6. Po launchi — operatíva

### Monitoring
- **Vercel → Logs** — všetky API requesty + console.log z backendu
- **Vercel → Analytics** — traffic + Web Vitals (free hobby)
- **Neon → Monitoring** — DB query latencies, storage usage
- **OpenAI Dashboard → Usage** — koľko mesačne pracháš

### Bezpečnosť
Prečítaj [SECURITY.md](../SECURITY.md) — aktívne mitigations, čo ešte nebolo dorobené, kde sú slabé miesta.

### Updates
Drž si fork synchronizovaný s upstream-om:
```bash
git remote add upstream https://github.com/martinbulak/Nulanaucte.git
git fetch upstream
git merge upstream/main  # alebo rebase
```

### Pridanie nového používateľa
Ak chceš zatvorenú registráciu (len tvoji ľudia):
- V `src/routes/auth.ts → authRoutes.post('/register', ...)` pridaj allowlist check
- Alebo vypni registráciu úplne a vytváraj userov priamo v Neon SQL

---

## 7. Limity a workaroundy

| Limit | Príčina | Ako obíť |
|---|---|---|
| Vercel hobby = 100 GB-h serverless / mes | Vercel free plan | Pre osobnú appku úplne stačí. Ak rastieš → Pro $20 |
| Neon free = 0.5 GB storage | Free tier | 500K transakcií ~ 50 MB. Treba 5+ rokov používania |
| OpenAI = $X kredit | tvoj billing | Set rate limit per-user nižšie (aktuálne 20 expensive/h) |
| Resend free = 100 emailov/deň | tvoja kvóta | Vystačí. Týždenne / mesačne x N userov = malé čísla |
| Vercel hobby cron = max 2 | Plan limit | Ak chceš denné notifikácie → upgrade alebo external scheduler |

---

## 8. Známe gotchas

- **Vercel maxDuration** je 10s na hobby. AI categorize chunkuje preto na 25-item batches × 6 parallel. Ak meníš, drž sa pod 60s (Pro limit).
- **DB migrácia pri cold start** — prvý request po deployi beží `ensureSeeded()` ktorá robí `CREATE TABLE IF NOT EXISTS`. Spomalí prvý request o ~200ms, potom je to no-op.
- **Email z `noreply@vercel-default`** nefunguje. Musíš mať buď vlastnú overenú doménu v Resend, alebo posielaš len na owner adresu Resend účtu.
- **OPENAI_API_KEY musí byť v Production env scope.** Aj keď ho pridáš do Preview, produkcia ho neuvidí.
- **www subdoména je samostatný DNS + Vercel domain.** Pridaj oba — `tvoja.com` aj `www.tvoja.com` — a v Vercel UI nastav „redirect to" pre www.

---

## 9. Komunita

Ak svoj fork pustíš, pošli mi link: **bulak.martin@gmail.com**. Pridám ho do README ako "built with this template".

Pull requests do upstream-u (`martinbulak/Nulanaucte`) sú vítané — fixes, nové banky, nové jazykové varianty. Pred PR si pozri [CONTRIBUTING.md](../CONTRIBUTING.md).

Good luck. 🦉
