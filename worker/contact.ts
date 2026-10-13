/**
 * Cloudflare Worker — serves the portfolio site and its contact endpoint.
 *
 * The same Worker does both jobs. Requests that match a file in dist/ are
 * served as static assets before this code ever runs (see [assets] in
 * wrangler.toml); only /api/* reaches fetch(). That keeps the contact form
 * same-origin, so there is no cross-site CORS dance — the Origin check below
 * is defense in depth, not the mechanism.
 *
 * Contact pipeline (in order, cheapest check first):
 *   1. honeypot field      — free, silent, catches naive bots
 *   2. KV rate limit       — stops bursts before any network call
 *   3. Turnstile verify    — the real bot check, hostname-bound
 *   4. field validation + length caps
 *   5. Resend delivery     — idempotent, so a retry cannot double-send
 *
 * DNS is not part of this. Cloudflare DNS only maps names to hosts; it does
 * not inspect form posts. Turnstile + rate limiting is what actually keeps
 * spam out of the inbox.
 *
 * Setup (dashboard values — never commit real ones):
 *   wrangler.toml [vars]:
 *     ALLOWED_ORIGIN = "https://<your-site>,https://www.<your-site>"
 *     TO_EMAIL       = "<your-inbox>"
 *     FROM_EMAIL     = "Portfolio <<verified-sender>>"
 *   wrangler.toml [[kv_namespaces]]:
 *     id = "<from: wrangler kv namespace create RATE_LIMITER>"
 *   Secrets (dashboard → Worker → Settings → Variables, or CLI):
 *     wrangler secret put RESEND_API_KEY
 *     wrangler secret put TURNSTILE_SECRET
 *
 * Resend free tier: until a sending domain is verified, FROM must be
 * onboarding@resend.dev and mail only reaches the account owner's inbox.
 * Turnstile: dashboard → Turnstile → Add widget; the site key goes to the
 * site build as PUBLIC_TURNSTILE_SITE_KEY, the secret key here.
 *
 * The client needs as build-time public values:
 *   PUBLIC_CONTACT_ENDPOINT=/api/contact
 *   PUBLIC_TURNSTILE_SITE_KEY=<turnstile site key>
 */

interface Env {
  RESEND_API_KEY: string
  TO_EMAIL: string
  FROM_EMAIL: string
  ALLOWED_ORIGIN: string
  TURNSTILE_SECRET: string
  RATE_LIMITER: KVNamespace
}

const API_PATH = '/api/contact'

const MAX_NAME = 120
const MAX_EMAIL = 200
const MAX_MESSAGE = 5000
const RATE_LIMIT = { limit: 3, windowSeconds: 600 }
const FETCH_TIMEOUT_MS = 8000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Bucket = { count: number; resetAt: number }

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
    'access-control-allow-origin': allowedOrigins(env).includes(origin) ? origin : 'null',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  }
}

// ALLOWED_ORIGIN is a comma-separated list because the site answers on both
// the apex and www hostnames, and an exact string match against one of them
// would reject every submission from the other. Keep the list to exactly the
// hostnames the site is served from — nothing else may post here.
function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGIN.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function allowedHostnames(env: Env): string[] {
  const hosts: string[] = []
  for (const entry of allowedOrigins(env)) {
    try {
      hosts.push(new URL(entry).hostname)
    } catch {
      console.error(`ALLOWED_ORIGIN entry is not a URL: ${entry}`)
    }
  }
  return hosts
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Anything that is not the contact API is not ours. With [assets]
    // configured, static files never reach this code in the first place.
    if (url.pathname !== API_PATH) {
      return json({ error: 'not_found' }, 404)
    }

    const base = cors(request, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: base })
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, base)

    if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET || !env.TO_EMAIL || !env.FROM_EMAIL) {
      console.error('contact worker misconfigured: a secret or mail var is missing')
      return json({ error: 'misconfigured' }, 500, base)
    }

    const origin = request.headers.get('origin') ?? ''
    if (!allowedOrigins(env).includes(origin)) return json({ error: 'bad_origin' }, 403, base)

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

    // 2 — fixed-window rate limit by client address, before spending a
    // Turnstile verification. KV has no atomic counter, so a burst of exactly
    // concurrent requests can each slip one extra send through; the window
    // itself is exact, which is what matters for sustained abuse.
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const key = `rl:${ip}`
    const now = Date.now()

    let bucket: Bucket | null
    try {
      bucket = await env.RATE_LIMITER.get<Bucket>(key, 'json')
    } catch (err) {
      console.error('rate-limit read failed', err)
      return json({ error: 'rate_limit_unavailable' }, 503, base)
    }

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + RATE_LIMIT.windowSeconds * 1000 }
    }

    if (bucket.count >= RATE_LIMIT.limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      return json({ error: 'rate_limited', retryAfter }, 429, {
        ...base,
        'retry-after': String(retryAfter),
      })
    }

    bucket.count += 1

    try {
      await env.RATE_LIMITER.put(key, JSON.stringify(bucket), {
        expirationTtl: RATE_LIMIT.windowSeconds + 60,
      })
    } catch (err) {
      console.error('rate-limit write failed', err)
      return json({ error: 'rate_limit_unavailable' }, 503, base)
    }

    // 3 — Turnstile
    if (!token) return json({ error: 'missing_turnstile' }, 400, base)

    let verifyRes: Response
    try {
      verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET,
          response: token,
          remoteip: ip,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch (err) {
      console.error('turnstile verify request failed', err)
      return json({ error: 'verify_failed' }, 502, base)
    }

    if (!verifyRes.ok) {
      console.error(`turnstile verify upstream status ${verifyRes.status}`)
      return json({ error: 'verify_failed' }, 502, base)
    }

    let verdict: { success?: boolean; hostname?: string; 'error-codes'?: string[] }
    try {
      verdict = (await verifyRes.json()) as typeof verdict
    } catch (err) {
      console.error('turnstile verify body was not JSON', err)
      return json({ error: 'verify_failed' }, 502, base)
    }

    if (!verdict.success) {
      console.error('turnstile rejected token', verdict['error-codes'] ?? [])
      return json({ error: 'turnstile_failed' }, 403, base)
    }

    // A token minted for any other site is replayable here unless the hostname
    // is checked. The expected hosts come from ALLOWED_ORIGIN, so there is one
    // value to keep correct, not two.
    if (verdict.hostname) {
      const expected = allowedHostnames(env)
      if (!expected.includes(verdict.hostname)) {
        console.error(
          `turnstile hostname mismatch: got ${verdict.hostname}, want ${expected.join(' or ')}`
        )
        return json({ error: 'turnstile_failed' }, 403, base)
      }
    }

    // 4 + 5 — deliver
    const subject = `Portfolio contact — ${name}`
    const text = `From: ${name} <${email}>\n\n${message}\n`

    let resend: Response
    try {
      resend = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          // A retried request must not double-send the visitor's email.
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          from: env.FROM_EMAIL,
          to: [env.TO_EMAIL],
          reply_to: email,
          subject,
          text,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS + 2000),
      })
    } catch (err) {
      console.error('resend request failed', err)
      return json({ error: 'delivery_failed' }, 502, base)
    }

    if (!resend.ok) {
      const detail = await resend.text().catch(() => '')
      console.error(`resend status ${resend.status} ${detail.slice(0, 200)}`)
      return json({ error: 'delivery_failed' }, 502, base)
    }

    return json({ ok: true }, 200, base)
  },
} satisfies ExportedHandler<Env>
