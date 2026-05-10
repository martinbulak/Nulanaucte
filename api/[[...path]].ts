/**
 * Vercel adapter — exportuje celú Hono appku ako jeden serverless handler.
 *
 * Vercel automaticky routne všetky requesty zhodujúce sa s týmto súborom
 * (catch-all `[[...path]].ts`) na túto funkciu. V kombinácii s rewrite
 * pravidlami v `vercel.json` to znamená:
 *
 *   GET  /api/auth/me      → /api/[[...path]] → Hono routes /api/auth/me
 *   POST /api/imports/csv  → /api/[[...path]] → Hono routes /api/imports/csv
 *   POST /api/inbound/email → ako vyššie (verejný webhook)
 *
 * Pre /api/* SPA routes (ako /dashboard, /banky, /verify) Vercel
 * najprv skúsi statický súbor v dist/, potom rewrite v vercel.json
 * presmeruje na /index.html.
 *
 * Runtime: nodejs (potrebné pre pdfjs-dist, ktoré nie je 100% Edge-compatible).
 */
import { handle } from 'hono/vercel'
import app from '../src/index'

export const config = {
  runtime: 'nodejs',
  // Default 10s na Hobby tier — toto stačí na všetky operácie okrem
  // veľkých PDF importov (do 8 MB) a veľkých Resend webhookov.
  // Na Pro tier môžeme zdvihnúť.
  maxDuration: 30,
}

export default handle(app)
