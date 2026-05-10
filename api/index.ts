/**
 * Vercel adapter — Edge runtime + Hono handle().
 *
 * `hono/vercel` `handle()` je natívne pre Edge runtime (Web Standards Request/Response).
 * Node runtime má inú signatúru a vyžadoval by extra adapter — pre náš stack
 * je Edge spoľahlivejší a rýchlejší (zero cold starts).
 *
 * Pdfjs-dist v inbound webhooke je lazy import — ak by padol v Edge,
 * vyčlení sa do samostatnej Node funkcie.
 */
import { handle } from 'hono/vercel'
import app from '../src/index.js'

export const runtime = 'edge'

export default handle(app)
