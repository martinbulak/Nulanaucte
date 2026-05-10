import type { Context, MiddlewareHandler } from 'hono'

/**
 * Naïve in-memory rate limiter using a fixed-window counter per IP+key.
 *
 * Good enough for: dev, single-instance deploys, Vercel low-traffic personal use.
 * NOT good enough for: serious production at scale on serverless (state isn't
 * shared across lambda instances). Replace with Upstash Redis or Vercel KV
 * before opening to untrusted users.
 */

interface Bucket {
  count: number
  resetAt: number // epoch ms
}

const stores = new Map<string, Map<string, Bucket>>()

function getStore(name: string): Map<string, Bucket> {
  let s = stores.get(name)
  if (!s) {
    s = new Map()
    stores.set(name, s)
  }
  return s
}

function clientKey(c: Context): string {
  // Vercel sets x-forwarded-for; trust first hop only
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const xri = c.req.header('x-real-ip')
  if (xri) return xri.trim()
  // Hono dev — fallback to connection-info-ish
  return c.req.header('host') || 'unknown'
}

export interface RateLimitOpts {
  /** Bucket name (e.g. "login", "inbound"). */
  name: string
  /** Max events per window per key. */
  max: number
  /** Window length in ms. */
  windowMs: number
  /** Optional extra key derivation (default: client IP). */
  keyer?: (c: Context) => string
  /** What to do on hit (default: return 429 JSON). */
  onLimit?: (c: Context, retryAfterSec: number) => Response | Promise<Response>
}

export function rateLimit(opts: RateLimitOpts): MiddlewareHandler {
  return async (c, next) => {
    const store = getStore(opts.name)
    const baseKey = opts.keyer ? opts.keyer(c) : clientKey(c)
    const key = `${baseKey}`
    const now = Date.now()

    let bucket = store.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs }
      store.set(key, bucket)
    }

    bucket.count += 1
    const remaining = Math.max(0, opts.max - bucket.count)
    c.res.headers.set('X-RateLimit-Limit', String(opts.max))
    c.res.headers.set('X-RateLimit-Remaining', String(remaining))
    c.res.headers.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

    if (bucket.count > opts.max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      c.res.headers.set('Retry-After', String(retryAfterSec))
      if (opts.onLimit) return await opts.onLimit(c, retryAfterSec)
      return c.json(
        {
          ok: false,
          error: `Príliš veľa pokusov. Skús znovu o ${retryAfterSec}s.`,
        },
        429,
      )
    }

    await next()
  }
}

/** Lightweight cleanup — call periodically if process is long-lived. */
export function pruneExpiredBuckets(): void {
  const now = Date.now()
  for (const store of stores.values()) {
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key)
    }
  }
}
