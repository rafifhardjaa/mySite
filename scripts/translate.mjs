#!/usr/bin/env node
/**
 * Syncs src/i18n/id.json from src/i18n/en.json.
 *
 * Usage:
 *   pnpm translate            # fill only keys missing from id.json
 *   pnpm translate -- --force # re-translate every key
 *
 * Credentials are read from .env.local (git-ignored) via the node --env-file
 * flag wired up in package.json. Never hardcode a key in this file.
 *
 * Providers (pick one via env):
 *   PROVIDER=gemini   GEMINI_API_KEY=…   MODEL=gemini-3.8-flash
 *   PROVIDER=openai   OPENAI_API_KEY=…   OPENAI_BASE_URL=…  MODEL=…
 *                     covers OpenAI, Groq, DeepSeek, Mistral, Ollama, …
 *   PROVIDER=google   GOOGLE_API_KEY=…
 *   PROVIDER=libretranslate             LIBRETRANSLATE_URL=…  (no key needed self-hosted)
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(root, 'src/i18n/en.json')
const targetPath = resolve(root, 'src/i18n/id.json')

const force = process.argv.includes('--force')
const provider = process.env.PROVIDER ?? 'gemini'

const SYSTEM_PROMPT = [
  'Kamu penerjemah untuk UI website portfolio pribadi.',
  'Terjemahkan input JSON (key -> teks) ke Bahasa Indonesia.',
  'Aturan: gaya santai tapi profesional. Gunakan bahasa sehari-hari yang rapi,',
  'bukan bahasa formal kaku dan slang. Pertahankan kapitalisasi di awal kalimat.',
  'Jangan terjemahan proper noun, nama brand, atau nama orang.',
  'Kembalikan HANYA objek JSON dengan key yang sama persis, tanpa penjelasan,',
  'tanpa pembungkus markdown.',
].join(' ')

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing ${name}. Set it, or choose a different PROVIDER.`)
    process.exit(1)
  }
  return value
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** Retries transient upstream failures. Free-tier models 429/503 under load regularly. */
async function request(url, options, { attempts = 5, label = 'provider' } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, options)

    if (response.ok) return response

    const retryable = [429, 500, 502, 503, 504].includes(response.status)
    const body = await response.text()

    if (!retryable || attempt === attempts) {
      throw new Error(`${label} ${response.status}: ${body}`)
    }

    const wait = attempt * 2000
    console.warn(
      `  ${label} ${response.status} — retrying in ${wait / 1000}s (${attempt}/${attempts})`
    )
    await sleep(wait)
  }
}

async function viaGemini(entries) {
  const key = requireEnv('GEMINI_API_KEY')
  const model = process.env.MODEL ?? 'gemini-3.8-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

  const response = await request(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          { role: 'user', parts: [{ text: JSON.stringify(Object.fromEntries(entries)) }] },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    },
    { label: 'gemini' }
  )

  const data = await response.json()
  return JSON.parse(data.candidates[0].content.parts[0].text)
}

async function viaOpenAiCompatible(entries) {
  const key = process.env.OPENAI_API_KEY ?? 'ollama'
  const base = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.MODEL ?? 'gpt-4o-mini'

  const response = await request(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(Object.fromEntries(entries)) },
        ],
      }),
    },
    { label: base }
  )

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}

async function viaGoogle(entries) {
  const key = requireEnv('GOOGLE_API_KEY')
  const response = await request(
    `https://translation.googleapis.com/language/translate/v2?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        q: entries.map(([, value]) => value),
        source: 'en',
        target: 'id',
        format: 'json',
      }),
    },
    { label: 'google' }
  )

  const data = await response.json()
  return Object.fromEntries(
    entries.map(([entryKey], index) => [entryKey, data.data.translations[index].translatedText])
  )
}

async function viaLibreTranslate(entries) {
  const url = process.env.LIBRETRANSLATE_URL ?? 'http://localhost:5000/translate'
  const apiKey = process.env.LIBRETRANSLATE_KEY

  const out = {}

  for (const [entryKey, value] of entries) {
    const response = await request(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          q: value,
          source: 'en',
          target: 'id',
          format: 'text',
          ...(apiKey ? { api_key: apiKey } : {}),
        }),
      },
      { label: 'libretranslate' }
    )

    out[entryKey] = (await response.json()).translatedText
  }

  return out
}

const providers = {
  gemini: viaGemini,
  openai: viaOpenAiCompatible,
  google: viaGoogle,
  libretranslate: viaLibreTranslate,
}

const run = providers[provider]

if (!run) {
  console.error(`Unknown PROVIDER "${provider}". Use one of: ${Object.keys(providers).join(', ')}`)
  process.exit(1)
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'))
const target = JSON.parse(await readFile(targetPath, 'utf8'))

const sourceEntries = Object.entries(source)
const pending = force ? sourceEntries : sourceEntries.filter(([key]) => !target[key])

if (pending.length === 0) {
  console.log('Nothing to do — id.json already covers every key.')
} else {
  console.log(`Translating ${pending.length} key(s) with ${provider}…`)
  const translated = await run(pending)

  for (const [key, value] of Object.entries(translated)) {
    if (typeof value !== 'string' || value.length === 0) {
      console.warn(`  ! skipped "${key}" — empty response`)
      continue
    }
    target[key] = value
  }

  const merged = Object.fromEntries(sourceEntries.map(([key]) => [key, target[key] ?? source[key]]))

  await writeFile(targetPath, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(`Wrote ${Object.keys(merged).length} keys to src/i18n/id.json`)
}

const orphans = Object.keys(target).filter((key) => !(key in source))
if (orphans.length > 0) console.warn(`Keys in id.json but not en.json: ${orphans.join(', ')}`)
