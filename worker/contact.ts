/**
 * Cloudflare Worker — contact form endpoint for the portfolio.
 *
 * Pipeline (in order, cheapest check first):
 *   1. honeypot field      — free, silent, catches naive bots
 *   2. Cloudflare rate limit binding — stops bursts before any crypto
 *   3. Turnstile token verify — the real bot check
 *   4. field validation + length caps
 *   5. Resend delivery
 *
 * DNS is not part of this. Cloudflare DNS only maps names to hosts; it does
 * not inspect form posts. Turnstile + rate limiting is what actually keeps
 * spam out of the inbox.
 *
 * Setup:
 *   wrangler.toml:
 *     [[kv_namespaces]]  binding = "RATE_LIMITER"  id = "<kv namespace>"
 *     [vars]
 *     RESEND_API_KEY = "re_..."
 *     TO_EMAIL       = "you@email.com"
 *     FROM_EMAIL     = "Portfolio <hello@yourdomain.com>"
 *     ALLOWED_ORIGIN = "https://yourdomain.com"
 *
 *   Secrets:
 *     wrangler secret put TURNSTILE_SECRET
 *
 * The client needs the matching public key as PUBLIC_TURNSTILE_SITE_KEY.
 */

interface Env {
  RESEND_API_KEY: string
  TO_EMAIL: string
  FROM_EMAIL: string
  ALLOWED_ORIGIN: string
  TURNSTILE_SECRET: string
  RATE_LIMITER: KVNamespace
}

const MAX_NAME = 120
const MAX_EMAIL = 200
const MAX_MESSAGE = 5000
const RATE_LIMIT = { limit: 3, windowSeconds: 600 }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''

  return {
    'access-control-allow-origin': origin === env.ALLOWED_ORIGIN ? origin : 'null',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const base = cors(request, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: base })
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, base)

    const origin = request.headers.get('origin') ?? ''
    if (origin !== env.ALLOWED_ORIGIN) return json({ error: 'bad_origin' }, 403, base)

    let payload: Record<string, string>
    try {
      payload = await request.json()
    } catch {
      return json({ error: 'bad_json' }, 400, base)
    }

    // 1 — honeypot. Real users never see this input, so anything filled in is a bot.
    if (payload.website) return json({ ok: true }, 200, base)

    const name = (payload.name ?? '').trim()
    const email = (payload.email ?? '').trim()
    const message = (payload.message ?? '').trim()
    const token = payload.turnstileToken ?? ''

    if (!name || !email || !message) return json({ error: 'missing_fields' }, 400, base)
    if (name.length > MAX_NAME || email.length > MAX_EMAIL || message.length > MAX_MESSAGE) {
      return json({ error: 'field_too_long' }, 413, base)
    }
    if (!EMAIL_RE.test(email)) return json({ error: 'bad_email' }, 400, base)

    // 2 — rate limit by client address, before spending a Turnstile verification
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const bucket = `rl:${ip}`
    const current = await env.RATE_LIMITER.get(bucket, 'json')

    if (current && current.count >= RATE_LIMIT.limit) {
      return json(
        { error: 'rate_limited', retryAfter: RATE_LIMIT.windowSeconds },
        429,
        { ...base, 'retry-after': String(RATE_LIMIT.windowSeconds) },
      )
    }

    await env.RATE_LIMITER.put(
      bucket,
      JSON.stringify({ count: (current?.count ?? 0) + 1, first: current?.first ?? Date.now() }),
      { expirationTtl: RATE_LIMIT.windowSeconds },
    )

    // 3 — Turnstile
    if (!token) return json({ error: 'missing_turnstile' }, 400, base)

    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    })

    if (!verify.ok) return json({ error: 'verify_failed' }, 502, base)

    const verdict = (await verify.json()) as { success?: boolean }
    if (!verdict.success) return json({ error: 'turnstile_failed' }, 403, base)

    // 4 + 5 — deliver
    const subject = `Portfolio contact — ${name}`
    const text = `From: ${name} <${email}>\n\n${message}\n`

    const resend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [env.TO_EMAIL],
        reply_to: email,
        subject,
        text,
      }),
    })

    if (!resend.ok) {
      return json({ error: 'delivery_failed' }, 502, base)
    }

    return json({ ok: true }, 200, base)
  },
} satisfies ExportedHandler<Env>