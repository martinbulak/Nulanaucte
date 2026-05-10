import type { MiddlewareHandler } from 'hono'

/**
 * Refuses requests larger than `maxBytes` based on Content-Length header.
 * Doesn't read the body, so it's free even if the client lies — Hono's downstream
 * `c.req.json()/text()` will still hit Vercel's hard cap (default 4.5 MB), but
 * this gives a clean 413 with a Slovak error message.
 */
export function bodyLimit(maxBytes: number): MiddlewareHandler {
  return async (c, next) => {
    const len = Number(c.req.header('content-length') || 0)
    if (Number.isFinite(len) && len > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024))
      return c.json(
        { ok: false, error: `Súbor je príliš veľký (max ${mb} MB).` },
        413,
      )
    }
    await next()
  }
}
