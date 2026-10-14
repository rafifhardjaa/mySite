import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repo root from a script's import.meta.url, so scripts run from anywhere. */
export const repoRoot = (metaUrl) => resolve(dirname(fileURLToPath(metaUrl)), '..')

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

export function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing ${name}. Set it, or choose a different PROVIDER.`)
    process.exit(1)
  }
  return value
}

/**
 * fetch with retries for transient upstream failures (429/5xx). Free-tier
 * models throttle under load regularly. Returns the Response; throws when
 * the status is permanent or the attempts run out.
 */
export async function fetchWithRetry(url, options, { attempts = 5, label = 'provider' } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, options)

    if (response.ok) return response

    const retryable = [429, 500, 502, 503, 504].includes(response.status)

    if (!retryable || attempt === attempts) {
      throw new Error(`${label} ${response.status}: ${(await response.text()).slice(0, 300)}`)
    }

    const waitMs = Math.min(4000 * 2 ** (attempt - 1), 60000)
    console.warn(
      `  ${label} ${response.status} — retrying in ${waitMs / 1000}s (${attempt}/${attempts})`
    )
    await sleep(waitMs)
  }

  throw new Error(`${label}: retries exhausted`)
}
