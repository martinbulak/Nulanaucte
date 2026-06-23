# Deployment

Production deploy: Vercel + Neon + Resend + OpenAI. Total setup time: **~20 minutes** if you have accounts ready, **~45 minutes** including new account signups.

---

## Architecture recap

```
DNS → Vercel Edge → Node serverless function
                    ↓
              Neon Postgres  ⟵ data
              Resend         ⟵ outbound email
              OpenAI         ⟵ AI calls
```

---

## Step-by-step

### 1. GitHub repo

Fork or push your own:
```bash
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

### 2. Neon Postgres (free tier)

1. [neon.tech](https://neon.tech) → Sign up
2. **New Project** → name it (e.g. "nulanaucte-prod")
3. Region: closest to your users (Frankfurt for SK/EU)
4. **Postgres version:** 16 (or latest)
5. Copy the **Connection string** — looks like:
   ```
   postgresql://neondb_owner:xxx@ep-cool-name-123.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
6. Save it — you'll paste it into Vercel.

> **Don't run migrations manually.** The app's `ensureSeeded()` runs `CREATE TABLE IF NOT EXISTS` on first request. Fresh Neon DB → first /api request takes ~2 s while it sets up the schema, then it's no-op forever.

### 3. Resend (transactional email)

1. [resend.com](https://resend.com) → Sign up
2. **API Keys** → Create API Key → copy `re_xxxxxxxxxxxxxxxx`
3. **Optional but recommended** — add your custom domain:
   - Domains → Add Domain → enter `tvojadomena.com`
   - Add the DKIM + SPF DNS records to your registrar
   - Wait for verification (5–60 min)
   - This lets you send from `noreply@tvojadomena.com` (otherwise you can only send to the email associated with your Resend account)

### 4. OpenAI (AI)

1. [platform.openai.com](https://platform.openai.com) → API keys → Create
2. Copy `sk-proj-xxxxxxxx` (only shown once)
3. **Billing** → add $5 prepaid credit (no auto-recharge needed for personal use)
4. Default model `gpt-4o-mini` works on the free $5 — vystačí na rok pre osobnú appku

### 5. Vercel

1. [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Framework Preset: **Vite** (auto-detected)
3. Build command: `npm run build`
4. Output Directory: `dist`
5. **Don't click Deploy yet** — first add env vars

### 6. Environment variables (Vercel → Project → Settings → Environment Variables)

Add these (all in **Production** scope; also add to Preview if you'll test branches):

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon connection string | from step 2 |
| `JWT_SECRET` | `openssl rand -base64 48` | min 32 chars; signs session cookies |
| `RESEND_API_KEY` | `re_xxx` | from step 3 |
| `OPENAI_API_KEY` | `sk-proj-xxx` | from step 4 |
| `PUBLIC_ORIGIN` | `https://tvojadomena.com` | full URL where the app is reachable |
| `EMAIL_FROM` | `Tvoja Appka <noreply@tvojadomena.com>` | requires verified Resend domain |
| `CRON_SECRET` | `openssl rand -hex 32` | optional secondary check for cron endpoints |
| `INBOUND_WEBHOOK_SECRET` | `openssl rand -hex 32` | required in prod; even if you don't use inbound email, the app refuses to boot without it |

> **Generating secrets on Windows (PowerShell):**
> ```powershell
> [Convert]::ToBase64String((1..36 | ForEach-Object { Get-Random -Maximum 256 }))
> ```
> Or just use [random.org/passwords](https://www.random.org/passwords/) to grab 48 alphanumeric chars.

### 7. Deploy

Hit **Deploy** in Vercel. First build takes ~90 s.

Once deployed:
- Get your URL (e.g. `nulanaucte-xyz.vercel.app`)
- Visit it → register your account → check email → verify → login

If verify email doesn't arrive: check Resend Logs (it'll show "sent to X" or "blocked because Y").

### 8. Custom domain (optional but recommended)

1. **Vercel → Project → Settings → Domains** → Add Domain → `tvojadomena.com`
2. Vercel tells you which DNS records to set:
   - **A** record on `@` → `76.76.21.21`
   - **CNAME** on `www` → `cname.vercel-dns.com`
3. At your registrar, add those records. Propagation: 5–60 min.
4. Vercel auto-issues a Let's Encrypt cert as soon as DNS resolves.
5. Add `www.tvojadomena.com` too → Vercel UI offers "Redirect to tvojadomena.com" → pick that.
6. **Update `PUBLIC_ORIGIN` env var** to `https://tvojadomena.com` → Redeploy.

### 9. Cron jobs

`vercel.json` already declares:
```json
"crons": [
  { "path": "/api/reports/run/weekly", "schedule": "0 8 * * 1" },
  { "path": "/api/reports/run/monthly", "schedule": "0 8 1 * *" }
]
```
- Monday 8:00 UTC = weekly reports
- 1st of month 8:00 UTC = monthly reports

These activate automatically. View them at **Vercel → Project → Cron Jobs**. To trigger manually:
```bash
curl -X POST 'https://tvojadomena.com/api/reports/run/weekly?secret=YOUR_CRON_SECRET'
```

### 10. Promote first admin

The first user with `role = 'admin'` can see `/admin`. Set it directly in Neon SQL Editor:
```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

---

## Troubleshooting

### Build fails: `Module not found '@/...' or similar`
Check `tsconfig.json` paths are mirrored in `vite.config.ts` aliases. Usually you don't touch these.

### Runtime: `OPENAI_API_KEY nie je nastavený v env`
Means the env var isn't in **Production** scope. Either add it there, or you added it to Preview only.

After adding env vars, **Vercel → Deployments → ··· → Redeploy** to pick them up. New deployments inherit new env vars automatically; older lambdas don't.

### Runtime: `ENOENT: cannot read /api/index`
Vercel routing issue. Check `vercel.json` has the rewrite `{ "source": "/api/:path*", "destination": "/api/index" }`. This is already there in the repo; only breaks if someone reformats it.

### DB: `relation "users" does not exist`
Drizzle schema wasn't applied. Either:
- Wait for first request (auto-migration via `ensureSeeded()`), OR
- Run locally: `npx drizzle-kit push --force` with `DATABASE_URL` pointing to your Neon.

### Cron not firing
Vercel free tier = max 2 cron jobs. The repo has exactly 2. If you add more, upgrade to Pro.
Also: Vercel cron requires a recent deploy — push any commit to refresh.

### Email lands in spam
- Verify domain in Resend (DKIM + SPF)
- Add DMARC TXT: `_dmarc.tvojadomena.com → v=DMARC1; p=quarantine; rua=mailto:postmaster@tvojadomena.com`
- Warm up the domain — send a few legit emails to known recipients first

### `www.tvojadomena.com` returns Vercel 404
DNS for `www` not configured OR Vercel doesn't have `www` as a domain. Both must be done. See [README](../README.md) issue #X for one-page fix.

---

## Cost projection

| Stage | Vercel | Neon | Resend | OpenAI | Total / mes |
|---|---|---|---|---|---|
| **Solo user** (you) | Hobby Free | Free | Free (100/day) | ~$0.05 (~30 imports + 3 Raul) | **~$0.05** |
| **5 users** | Hobby Free | Free | Free | ~$0.25 | **~$0.25** |
| **50 users** | Hobby Free | Free → Launch $19 if storage caps | Free (still under 100/day) | ~$2.50 | **~$2.50–22** |
| **500 users** | Pro $20 | Launch $19 | Pro $20 | ~$25 | **~$84** |

Solo / family-and-friends scale: practically free. Real users at 50+ → marginal cost is mostly OpenAI.

---

## Rollback

If a deploy is broken:
1. **Vercel → Deployments** → pick last good deploy → **··· → Promote to Production**
2. Reverts in ~5 seconds. No DB rollback needed (additive migrations only).

For breaking schema changes, you're on your own — Drizzle migrations are forward-only.

---

## Updates from upstream

If you forked `martinbulak/Nulanaucte`:
```bash
git remote add upstream https://github.com/martinbulak/Nulanaucte.git
git fetch upstream
git merge upstream/main   # or rebase
git push
```
Vercel auto-deploys the merge.

---

## Monitoring

- **Vercel → Logs** — all API request logs + console output
- **Vercel → Analytics** — Real-User Monitoring (free hobby)
- **Neon → Monitoring** — DB performance, slow queries, storage usage
- **OpenAI Dashboard → Usage** — monthly spend, requests, errors
- **Resend → Logs** — sent/bounced emails, deliverability
