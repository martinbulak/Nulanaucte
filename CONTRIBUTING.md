# Contributing

Welcome. This is a personal-scale open project; PRs are reviewed when I have time. Below: dev setup, conventions, and what gets approved.

---

## Dev setup

```bash
git clone https://github.com/martinbulak/Nulanaucte.git
cd Nulanaucte
npm install
cp .env.example .env
# Fill DATABASE_URL minimum (Neon free tier)
npm run dev
# → http://localhost:8787
```

Seed account: `koduvanica` / `koduvanica`.

Full setup details (env vars, services, custom domain, …): [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

---

## Before opening a PR

1. **Build clean**
   ```bash
   npm run build
   ```
   `tsc -b && vite build` must succeed with zero TS errors. Vite warnings about chunk size > 500 kB are OK.

2. **Self-test the change manually**
   - Log in, go through the flow your change affects
   - Open browser DevTools console — no errors
   - Check responsive: Chrome DevTools → Toggle Device → iPhone 13

3. **Schema changes**
   - Add the table/column to `src/schema.ts` AND `src/db.ts → ensureSeeded()` (idempotent DDL)
   - Don't break existing data. Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` not `ALTER COLUMN`.
   - Update [docs/DATABASE.md](./docs/DATABASE.md)

4. **New API endpoint**
   - Mount in `src/index.ts` with `requireAuth` middleware (or document why public)
   - Pick the right rate-limit bucket (see [docs/API.md](./docs/API.md))
   - Validate inputs explicitly (no implicit type trust)
   - Update [docs/API.md](./docs/API.md)

5. **AI prompt change**
   - Test with at least one real month of data
   - Keep examples in-prompt (they shape the output more than instructions)
   - Always handle stub fallback path
   - Update [docs/AI.md](./docs/AI.md)

---

## Code conventions

### TypeScript
- **Strict mode** enabled in `tsconfig.json` — no `any`
- Async functions everywhere; no callback-style code
- Discriminated unions for response types: `{ ok: true, data: T } | { ok: false, error: string }`
- No barrel-export `index.ts` files — explicit imports

### React
- Functional components only
- Hooks for local state, no Redux / Zustand
- Single `useAuth()` for auth context
- Inline event handlers OK for short ones; extract for clarity over 5 lines
- One component per file, named export matching filename

### Styling
- **Tailwind utility classes only** — no inline styles unless dynamic (e.g. `style={{ width: pct + '%' }}`)
- Use design tokens from `@theme` in `styles.css`, don't hard-code hex outside that file
- Responsive prefix order: default → `sm:` → `md:` → `lg:`
- Class lists over 80 chars → array-join for readability

### Backend
- Hono context only used inside handler functions; pass typed data down to helpers
- DB queries live in `src/db.ts` as exported helpers — routes don't reach into Drizzle directly
- Logs: `console.log` for info, `console.warn` for unexpected-but-recoverable, `console.error` for failures
- No PII in logs (email, names → redact or just use user.id)

### Slovak text
- All user-facing strings are in Slovak. Hardcoded — no i18n.
- Diacritics required: "návod" not "navod", "kategórie" not "kategorie"
- Wizarding metaphors as flavor: 1 per paragraph max ("galeóny", "Apparátor", "sova"...)

---

## What gets merged

✅ **Likely merged:**
- Bug fixes with reproduction steps
- New bank parser (CSV) with sample file in PR description
- UX polish (better empty states, loading skeletons, mobile fixes)
- Performance wins backed by numbers
- New AI surface following existing fallback pattern
- Documentation improvements

⚠️ **Discussion first:**
- New top-level page / nav item
- Breaking API changes
- New external service dependency (more env vars)
- AI prompt rewrites — open an issue with sample I/O comparison

❌ **Probably declined:**
- Adding a CSS / component framework
- Migrating to a different runtime (Edge, Bun, Deno)
- i18n — currently single-language by design
- Crypto / stock features (out of scope)
- AI features without fallback path

---

## Commit messages

Keep them informative but short:
- `fix(ai): stop caching stub fallbacks` ✅
- `feat(mobile): drawer sidebar + scrollable tables` ✅
- `chore: bump deps` ✅
- `update` ❌
- `wip` ❌ (don't push WIP to main)

Co-Authored-By footer is welcome:
```
Co-Authored-By: Name <email>
```

---

## Deployment flow

`main` branch auto-deploys to production on Vercel. **Push to main = live in ~60 s.** If you're not sure, open a PR (Vercel will build a preview URL for it) — review there before merging.

For breaking changes, manually rollback via Vercel UI: Deployments → previous successful → ··· → Promote to Production.

---

## Reporting bugs (non-contributors)

You don't need a PR. Either:
- **In-app:** 📮 in sidebar → form → emails me directly
- **GitHub:** [open an issue](https://github.com/martinbulak/Nulanaucte/issues)

Include:
- What you did, what happened, what you expected
- Browser + OS
- Screenshot if visual

---

## License

MIT. By contributing, you agree your work is MIT-licensed.

---

## Communication

- **GitHub Issues** — bug reports + feature requests
- **Email** — bulak.martin@gmail.com for anything not appropriate for public issue
- **PR reviews** — usually within 1 week for small changes; bigger PRs may take longer

Thanks for taking the time to contribute. 🦉
