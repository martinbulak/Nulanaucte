# Nula na účte

> *Raul uprace tvojej financie. Lebo ty nevieš. Zadarmo.*

Personal finance tracker s automatickým importom bankových výpisov (PDF/CSV/email),
AI kategorizáciou výdavkov, mesačnými reportami a lebkou v čarodejníckom klobúku.

Stack: **React 18 + Vite + Hono + Drizzle ORM + Neon Postgres + Resend + OpenAI GPT-4o-mini**.
Deploy target: **Vercel**.

---

## Funkcie

### Multi-user
- Otvorená registrácia s email verification
- Password reset cez email
- Profile management, GDPR export, account deletion s cascade
- Admin role (technický prehľad bez finančných dát)

### Bankový import
- **Manual upload** — PDF + CSV (SLSP, Tatra banka, Revolut)
- **Automatický email** — Resend Inbound webhook → per-user `slug-token@nula.tvojadomena.sk`
- Auto-detekcia formátu, dedup cez fingerprint unique index
- Server-side PDF text extraction cez pdfjs-dist

### AI features (GPT-4o-mini, lacné a rýchle)
- **Kategorizácia transakcií** *(„Roztriediť výdavky kúzlom")* — 17 kategórií, confidence score, manual override
- **Raul odporúčania** *(„Raul, kde mi miznú galeóny?")* — kontextuálna analýza výdavkov
- **Rule-based fallback** keď nie je `OPENAI_API_KEY` — appka funguje aj offline

### Dashboard a reporty
- Mesačná navigácia s grafmi (income/expense bars, net trend, kategórie)
- 6-mesačný trend s comparison
- **Email reporty** — týždenné (pondelok 8:00) alebo mesačné (1. v mesiaci 8:00) cez Vercel Cron
- Wizarding mikrocopy: *„Sova ti priniesla list...", „Mesačný výpis z Rokfortu reality"*

### Bezpečnosť
- httpOnly secure SameSite=Strict cookies + JWT s tokenVersion revocation
- PBKDF2 600k pre heslá, constant-time login (anti-timing)
- Rate limiting per-IP (login, register, forgot, AI, inbound)
- Account lockout po 5 zlých pokusoch
- Body size limits (10 MB inbound, 8 MB import)
- Webhook HMAC signing (Svix) + replay protection (5min window)
- CSP, HSTS, X-Frame-Options cez `vercel.json`
- 37 audit findings z [SECURITY_AUDIT.md](./SECURITY_AUDIT.md), všetky CRITICAL + HIGH fixnuté

---

## Lokálne spustenie

### 1. Závislosti
```bash
npm install
```

### 2. `.env` (root projektu)

```bash
# Required everywhere
DATABASE_URL=postgresql://neondb_owner:...@ep-xxx.neon.tech/neondb?sslmode=require

# Required only in production (dev má fallbacky)
JWT_SECRET=                          # openssl rand -base64 48 (≥32 chars)
INBOUND_WEBHOOK_SECRET=              # whsec_... z Resend dashboardu
RESEND_API_KEY=                      # re_... z Resend
OPENAI_API_KEY=                      # sk-... z OpenAI

# Optional
INBOUND_DOMAIN=nula.tvojadomena.sk   # default: inbox.local
PUBLIC_ORIGIN=http://localhost:8787  # default: localhost:8787
EMAIL_FROM=Nula na účte <noreply@nula.tvojadomena.sk>
CRON_SECRET=                         # ochrana POST /api/reports/run/* (prod)
```

`.env` je `.gitignore`-ovaný. Pre dev stačí len `DATABASE_URL` (zvyšok má fallbacky).

### 3. DB schema
```bash
npx drizzle-kit push --force
```

### 4. Dev server
```bash
npm run dev
# → http://localhost:8787
```

### 5. Test účet
Po prvom spustení sa autoseednete dev user:
- Email: `koduvanica`
- Heslo: `koduvanica`

Pre nový účet použiť **Register** (verify link sa vypíše do konzoly servera ak nie je `RESEND_API_KEY`).

---

## Príprava na Vercel deploy

### 1. Push do GitHub repa
```bash
git add -A
git commit -m "Production-ready"
git remote add origin https://github.com/YOUR/nula-na-ucte.git
git push -u origin main
```

### 2. Import projektu vo Vercel dashboarde
- Connect GitHub repo
- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

### 3. Env vars vo Vercel project settings
Pridaj všetky required env vars (pozri tabuľku vyššie). Vygeneruj:
- `JWT_SECRET` — `openssl rand -base64 48`
- `CRON_SECRET` — `openssl rand -hex 32`

### 4. Resend Inbound (pre automatický email import)
- Pridaj doménu v Resend dashboarde + DNS verifikácia (TXT)
- MX record subdomény `nula.tvojadomena.sk` → `feedback-smtp.eu-west-1.amazonses.com` (pozri Resend docs)
- Inbound rule: catch-all `*@nula.tvojadomena.sk` → POST `https://nula-na-ucte.vercel.app/api/inbound/email`
- Skopíruj webhook signing secret → `INBOUND_WEBHOOK_SECRET`

### 5. Cron jobs
`vercel.json` už definuje:
- **Pondelok 8:00 UTC** — týždenné reporty
- **1. v mesiaci 8:00 UTC** — mesačné reporty

Nastaví sa automaticky pri deploy. Pozri Vercel → Project → Cron Jobs.

### 6. Test produkcie
```bash
curl https://nula-na-ucte.vercel.app/api/auth/me  # má vrátiť 401
```

### 7. Promote first admin
V Neon SQL Editori:
```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

---

## Architektúra

```
src/
├─ env.ts              ← centralizovaný env validator (fail at boot)
├─ schema.ts           ← Drizzle Postgres schema
├─ db-client.ts        ← Neon serverless driver
├─ db.ts               ← všetky DB queries (async)
├─ index.ts            ← Hono app (mountuje routes)
├─ middleware/
│  ├─ auth.ts          ← JWT cookie + tokenVersion check
│  ├─ rateLimit.ts     ← per-IP token bucket
│  └─ bodyLimit.ts     ← Content-Length cap
├─ lib/
│  ├─ jwt.ts           ← jose JWT signing/verification
│  ├─ password.ts      ← PBKDF2 600k Web Crypto
│  ├─ email.ts         ← Resend SDK + dev console fallback
│  ├─ email-reports.ts ← weekly/monthly templates
│  ├─ ai.ts            ← OpenAI categorization + Raul + rule-based fallback
│  ├─ csv-parsers.ts   ← SLSP/Tatra/Revolut CSV
│  ├─ pdf-parsers.ts   ← SLSP PDF (diff-zostatkov stratégia)
│  ├─ pdf-extract.ts   ← server-side PDF→text (pdfjs-dist)
│  └─ parser-utils.ts  ← SK formát čísel, dátumov
└─ routes/
   ├─ auth.ts          ← login/register/verify/forgot/reset/logout
   ├─ user.ts          ← profile, password change, account deletion, inbound widget
   ├─ banks.ts         ← CRUD bánk
   ├─ imports.ts       ← CSV/PDF upload + parser
   ├─ inbound.ts       ← Resend webhook → parse → store
   ├─ ai.ts            ← /api/ai/categorize, /api/ai/recommendations
   ├─ mortgages.ts     ← CRUD hypoték
   ├─ reports.ts       ← cron endpoints + email render
   └─ admin.ts         ← admin-only stats (no financial data)

frontend/
├─ App.tsx             ← React Router (verejné /login + chránené /dashboard etc.)
├─ pages/              ← Login, Register, Verify, Forgot, Reset, Dashboard,
│                       Banky, Prijmy, Vydavky, Hypoteky, Settings, Admin
├─ components/
│  ├─ layout/          ← Layout (sidebar), AuthShell, Sidebar
│  └─ ui/              ← Card, MonthPicker, Charts, BrandLogo, AIButtons,
│                       InboundEmailWidget
├─ hooks/              ← useAuth, useTheme
└─ utils/              ← apiFetch, pdf extraction (browser pdfjs)

drizzle/               ← migrácie (generated by drizzle-kit)
tests/e2e.sh          ← end-to-end smoke test (20 prípadov)

.env.example
vercel.json            ← cron + security headers + CSP
SECURITY.md            ← status audit findingov + zostávajúce riziká
SECURITY_AUDIT.md      ← detailný audit (37 nálezov)
```

---

## Príkazy

```bash
npm run dev            # Vite dev server na :8787 (Hono inside)
npm run build          # tsc -b + vite build → dist/
npm run preview        # preview prod build lokálne

npx drizzle-kit push --force  # apply schema do Neon (pre dev/prod)
npx drizzle-kit generate      # generuje migration files (pre verzovanie)
npx drizzle-kit studio        # GUI DB browser

bash tests/e2e.sh      # multi-user smoke test (vyžaduje bežiaci dev server)
```

---

## API rýchly prehľad

```
# Public auth
POST   /api/auth/register       open registration
POST   /api/auth/verify         email verify (token)
POST   /api/auth/login          → cookie
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/forgot         password reset request
POST   /api/auth/reset          consume reset token

# User
GET    /api/user/inbound        per-user email address
POST   /api/user/inbound/regenerate
PATCH  /api/user/profile        name, frequency, notifs
POST   /api/user/change-password
DELETE /api/user                account deletion + cascade
GET    /api/user/export         GDPR JSON download

# Data
GET    /api/banks
POST   /api/banks
GET    /api/transactions?bankId=&type=&month=&limit=
DELETE /api/transactions        wipe all (test/reset)
GET    /api/months              months with data
GET    /api/mortgages
POST   /api/mortgages
PATCH  /api/mortgages/:id
DELETE /api/mortgages/:id
GET    /api/dashboard/summary?month=YYYY-MM
GET    /api/dashboard/trend?months=N

# Imports
POST   /api/imports/csv/preview
POST   /api/imports/csv
POST   /api/imports/pdf/preview
POST   /api/imports/pdf
POST   /api/inbound/email       Resend webhook (HMAC signed)

# AI
GET    /api/ai/categories       list of allowed categories
POST   /api/ai/categorize       batch process uncategorized
PATCH  /api/ai/transactions/:id/category   manual override
GET    /api/ai/recommendations?month=YYYY-MM
POST   /api/ai/recommendations  generate new

# Cron
POST   /api/reports/run/weekly  (auth: x-vercel-cron header or CRON_SECRET)
POST   /api/reports/run/monthly

# Admin (role=admin required)
GET    /api/admin/stats         counts only, no financial data
```

---

## Prispievanie

Pred PR:
```bash
bash tests/e2e.sh           # všetky 20 testov musia prejsť
npm run build               # nesmie failnúť
```

Pre nové features:
- Citlivý kód → audit cez `Skill: security-review` na PR diff
- Schema zmena → `npx drizzle-kit generate` aby vznikla migrácia
- Nový endpoint → musí mať `requireAuth` (alebo verejný = HMAC verified)

---

## Licencia

MIT.
