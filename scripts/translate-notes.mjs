#!/usr/bin/env node
/**
 * Translates English notes in src/content/notes/ into Indonesian twins.
 *
 * Usage:
 *   pnpm translate-notes                 # only notes that have no .id.mdx yet
 *   pnpm translate-notes -- --force      # re-translate existing ones
 *   pnpm translate-notes -- battle-of-ain-jalut
 *
 * Output: `<name>.id.mdx` with `lang: id` and `urlPath` matching the English
 * note's URL. `urlPath` rather than `slug`, because Astro silently drops a
 * collection entry whose `slug` duplicates another entry's.
 *
 * Code fences, inline code, links, images and JSX tags are replaced with
 * placeholders before the model sees them and restored afterwards, so Markdown
 * structure survives translation. Every result is validated before it is
 * written; a note that fails validation is reported and skipped rather than
 * written in a broken state.
 *
 * Credentials come from .env.local (git-ignored), loaded via the node --env-file
 * flag in package.json. Never hardcode a key here.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const notesDir = resolve(root, 'src/content/notes')

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter((a) => !a.startsWith('--'))

const apiKey = process.env.GEMINI_API_KEY
const model = process.env.MODEL ?? 'gemini-3.8-flash'

if (!apiKey) {
  console.error('Missing GEMINI_API_KEY. Set it in .env.local.')
  process.exit(1)
}

const SYSTEM_PROMPT = [
  'Kamu penerjemah profesional untuk catatan blog berbahasa Inggris ke Bahasa Indonesia.',
  '',
  'Aturan penting:',
  '1. Terjemahkan hanya prosa. Jangan pernah mengubah, menambah, atau menghapus blok kode,',
  '   tautan, placeholder, atau tag — semuanya sudah dilindungi dan akan dikembalikan apa adanya.',
  '2. Pertahankan struktur Markdown persis: jumlah dan urutan heading, bullet, blockquote, tabel.',
  '3. Gaya: jernih, langsung, dan sedikit informal. Hindari bahasa kaku dan slang.',
  '4. Terjemahkan nama tempat ke nama Indonesia yang lazim: Egypt menjadi Mesir, Syria menjadi',
  '   Suriah, Galilee menjadi Galilea, Damascus menjadi Damaskus, Aleppo tetap Aleppo,',
  '   Euphrates menjadi Eufratis, Persia menjadi Persia, Baghdad tetap Baghdad.',
  '5. Jangan terjemahkan nama orang, nama dinasti, nama dinasti, istilah teknis',
  '   (khanate, Ilkhanate, wazir, Mamluk), maupun judul buku berbahasa Inggris. Untuk judul buku,',
  '   boleh tambahkan keterangan singkat dalam kurung hanya bila sangat membantu pembaca.',
  '6. Jangan mengarang fakta, angka, tanggal, atau sumber yang tidak ada di teks asli.',
  '7. Balas HANYA hasil terjemahan, tanpa penjelasan dan tanpa pembungkus markdown.',
].join('\n')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function request(body) {
  const maxAttempts = Number(process.env.TRANSLATE_ATTEMPTS ?? 8)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      }
    )

    if (res.ok) return res.json()

    if ([429, 500, 502, 503, 504].includes(res.status)) {
      const wait = Math.min(4000 * 2 ** (attempt - 1), 60000)
      console.warn(`  ${res.status} — retry ${attempt}/${maxAttempts} in ${wait}ms`)
      await sleep(wait)
      continue
    }

    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  throw new Error('Gemini: retries exhausted')
}

async function translate(text) {
  const data = await request({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { temperature: 0.4 },
  })

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
}

/**
 * Replaces untranslatable spans with placeholders.
 *
 * @returns {{ text: string, restore: (value: string) => string }}
 */
function protect(markdown) {
  const blocks = []

  const put = (value) => {
    blocks.push(value)
    return `⟦${blocks.length - 1}⟧`
  }

  let text = markdown
    .replace(/```[\s\S]*?```/g, put)
    .replace(/`[^`\n]+`/g, put)
    .replace(/<[^>\n]+>/g, put)
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, put)
    .replace(/^\s*---+\s*$/gm, put)
    .replace(/https?:\/\/\S+/g, put)

  const restore = (value) => value.replace(/⟦(\d+)⟧/g, (_, index) => blocks[Number(index)] ?? '')

  return { text, restore }
}

/** Rejects the machine-translation artefacts that have slipped into drafts before. */
function validate(text, file) {
  const problems = []

  if (/[一-鿿Ѐ-ӿ]/.test(text)) problems.push('CJK/Cyrillic')
  if (/\b(CORRECTION|KEYNOTE)\b/.test(text)) problems.push('marker koreksi')
  if (/[a-zа-я]_[a-zа-я]/.test(text)) problems.push('underscore di prosa')
  if (/⟦\d+⟧/.test(text)) problems.push('placeholder tak kembali')
  if (!/^#{1,6}\s+\S/m.test(text)) problems.push('struktur heading hilang')

  if (problems.length) {
    console.error(`  ✗ ${file}: ${problems.join(', ')}`)
    return false
  }

  return true
}

function splitFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) throw new Error('frontmatter tidak ditemukan')
  return { frontmatter: match[1], body: match[2] }
}

/** Reads the fields this script needs without a YAML dependency. */
function field(frontmatter, name) {
  const match = frontmatter.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'))
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : undefined
}

async function main() {
  const files = (await readdir(notesDir)).filter(
    (f) => f.endsWith('.mdx') && !f.endsWith('.id.mdx') && !f.startsWith('.')
  )

  const targets = only.length ? files.filter((f) => only.some((o) => f.includes(o))) : files

  if (!targets.length) {
    console.log('Tidak ada catatan yang cocok.')
    return
  }

  let written = 0
  let skipped = 0

  for (const file of targets) {
    const target = join(notesDir, file.replace(/\.mdx$/, '.id.mdx'))

    if (existsSync(target) && !force) {
      console.log(`↷ ${file} — sudah ada .id.mdx (lewati, pakai --force)`)
      continue
    }

    const { frontmatter, body } = splitFrontmatter(await readFile(join(notesDir, file), 'utf8'))
    const urlPath = file.replace(/\.mdx$/, '')

    console.log(`\n→ ${file}`)

    const { text, restore } = protect(body)
    let translated

    try {
      translated = await translate(text)
    } catch (error) {
      console.error(`  ✗ gagal: ${error.message}`)
      skipped++
      continue
    }

    if (!translated) {
      console.error('  ✗ respons kosong')
      skipped++
      continue
    }

    const finalBody = restore(translated)

    if (!validate(finalBody, file)) {
      skipped++
      continue
    }

    const { value: title, translated: titleOk } = await translateText(
      field(frontmatter, 'title') ?? urlPath
    )
    const { value: description, translated: descOk } = await translateText(
      field(frontmatter, 'description') ?? ''
    )

    if (!titleOk || !descOk) console.warn('  ! judul/deskripsi gagal diterjemahkan')
    const tags = field(frontmatter, 'tags')

    const out = [
      '---',
      `urlPath: ${urlPath}`,
      `title: ${JSON.stringify(title)}`,
      `description: ${JSON.stringify(description)}`,
      `publishedAt: ${field(frontmatter, 'publishedAt')}`,
      `tags: ${tags}`,
      'draft: false',
      'lang: id',
      '---',
      '',
      finalBody.trim(),
      '',
    ].join('\n')

    await writeFile(target, out)
    console.log(`  ✓ ${file.replace(/\.mdx$/, '.id.mdx')}`)
    written++

    // Free-tier Gemini throttles aggressively; give the quota room to recover.
    if (written < targets.length) await sleep(Number(process.env.TRANSLATE_PAUSE_MS ?? 8000))
  }

  console.log(`\nSelesai: ${written} ditulis, ${skipped} dilewati.`)
}

async function translateText(value) {
  if (!value) return { value: '', translated: true }

  const { text, restore } = protect(value)

  try {
    const result = await translate(text)
    if (!result) return { value, translated: false }
    return { value: restore(result), translated: true }
  } catch (error) {
    console.warn(`  ! gagal: ${error.message}`)
    return { value, translated: false }
  }
}

await main()
