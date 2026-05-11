/**
 * Vercel Node runtime adapter for Hono.
 *
 * Hono's `hono/vercel` `handle()` returns an Edge-style handler (Request → Response),
 * which is incompatible with Vercel Node runtime that uses (req, res) Express-style.
 * We need Node runtime because PBKDF2 600k iterations exceed Edge CPU limits.
 *
 * This adapter manually converts Node IncomingMessage/ServerResponse to/from
 * Web Standards Request/Response that Hono expects internally.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import app from '../src/index.js'

export const config = {
  runtime: 'nodejs',
  // 60s = Vercel Hobby max. Bulk AI categorization of large imports takes ~5-15s
  // with chunked parallelism; 60s gives headroom for slower months.
  maxDuration: 60,
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Build a Web Request from the Node request.
    const host = (req.headers['host'] as string) || 'localhost'
    const proto =
      (req.headers['x-forwarded-proto'] as string) ||
      ((req.socket as { encrypted?: boolean })?.encrypted ? 'https' : 'http')
    const url = `${proto}://${host}${req.url ?? '/'}`

    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue
      if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv))
      else headers.set(k, v as string)
    }

    let body: BodyInit | undefined
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = []
      for await (const chunk of req as AsyncIterable<Buffer>) chunks.push(chunk)
      if (chunks.length > 0) body = Buffer.concat(chunks)
    }

    const webReq = new Request(url, {
      method: req.method,
      headers,
      body,
    })

    // Hand off to Hono.
    const webRes = await app.fetch(webReq)

    // Convert Web Response → Node response.
    res.statusCode = webRes.status
    webRes.headers.forEach((value, key) => {
      // Skip headers that Node sets automatically
      if (key.toLowerCase() === 'content-length') return
      res.setHeader(key, value)
    })
    const buf = Buffer.from(await webRes.arrayBuffer())
    res.end(buf)
  } catch (err) {
    console.error('[adapter] handler crashed:', err instanceof Error ? err.stack : err)
    res.statusCode = 500
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'Internal server error' }))
  }
}
