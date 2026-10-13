#!/usr/bin/env node
/**
 * Memeriksa catatan berbahasa Indonesia untuk fragmen yang rusak.
 *
 * Catatan ini ditulis panjang dan sering diterjemahkan, sehingga artefak mesin
 * dan token asing mudah lolos. Validator ini menandai apa yang hampir tidak
 * mungkin muncul di prosa Indonesia yang sudah disunting: karakter CJK/Cyrillic,
 * penanda koreksi, kata Latin yang bukan istilah yang diharapkan, dan kata yang
 * menempel satu sama lain.
 *
 * Usage: node scripts/check-notes.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const NOTES_DIR = 'src/content/notes'

const CHECKS = [
  { name: 'CJK / Cyrillic', re: /[\u4e00-\u9fff\u0400-\u04ff]/g },
  { name: 'penanda koreksi', re: /\b(CORRECTION|KEYNOTE|TRANSLATE)\b/g },
  { name: 'underscore di prosa', re: /[a-zа-я]_[a-zа-я]/g },
]

function isIndonesian(content) {
  return /^lang:\s*id$/m.test(content)
}

let problems = 0

for (const file of readdirSync(NOTES_DIR).filter((f) => f.endsWith('.mdx'))) {
  const content = readFileSync(join(NOTES_DIR, file), 'utf8')
  const id = isIndonesian(content)
  const body = content.replace(/^---[\s\S]*?---/, '')

  // Code legitimately contains underscores (`node_modules`, `health_score`,
  // `pass_filenames`), so prose checks run on the text outside code spans.
  const prose = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '')

  prose.split('\n').forEach((line, index) => {
    for (const { name, re } of CHECKS) {
      const hits = line.match(re)
      if (hits) {
        problems++
        console.log(`${file}:${index + 1}  [${name}] ${hits.join(', ')}`)
        console.log(`   ${line.trim().slice(0, 100)}`)
      }
    }

    if (id) {
      // "para Classification" — peng Determinan followed by a stray Latin word.
      const stray = line.match(/\bpara [A-Z][a-z]{3,}/g)
      if (stray) {
        problems++
        console.log(`${file}:${index + 1}  [kata asing setelah "para"] ${stray.join(', ')}`)
        console.log(`   ${line.trim().slice(0, 100)}`)
      }
    }
  })

  // Pasangan terjemahan wajib punya urlPath: frontmatter `slug` yang bentrok
  // membuat Astro membuang entri tanpa peringatan.
  if (id && !/^urlPath:/m.test(content)) {
    problems++
    console.log(`${file}  [kategori id tanpa urlPath]`)
  }
}

console.log(problems === 0 ? '\n✅ tidak ada fragmen rusak' : `\n⚠️  ${problems} masalah`)
process.exit(problems === 0 ? 0 : 1)
