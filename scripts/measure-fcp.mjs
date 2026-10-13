/**
 * Mengukur apakah pergantian bahasa terjadi SEBELUM first paint.
 * Kalau swapAt < FCP, tidak ada kilat bahasa Inggris.
 */
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
const SRC = process.argv[2] ?? 'http://localhost:8791/index.html'
const work = '/tmp/flash'
mkdirSync(work, { recursive: true })

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${work}/profile`,
  'about:blank',
])

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function targets() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await res.json()
      if (list.length > 0) return list
    } catch {}
    await wait(250)
  }
  throw new Error('chrome tidak merespons')
}

const list = await targets()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)

let id = 0
const pending = new Map()

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})

await new Promise((r) => ws.addEventListener('open', r))

function send(method, params = {}) {
  return new Promise((resolve) => {
    const messageId = ++id
    pending.set(messageId, resolve)
    ws.send(JSON.stringify({ id: messageId, method, params }))
  })
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true })
  return res.result?.result?.value
}

// set localStorage sebelum dokumen pertama di-parse
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { localStorage.setItem('lang','id') } catch (e) {}`,
})

await send('Page.enable')
await send('Performance.enable')
await send('Page.navigate', { url: SRC })
await wait(2500)

const result = await evaluate(`JSON.stringify({
  swapAt: window.__swapAt ?? null,
  fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime ?? null,
  domInteractive: performance.timing?.domInteractive ?? null,
  lang: document.documentElement.getAttribute('lang'),
  greeting: document.querySelector('[data-i18n="home.hero.greeting"]')?.textContent?.trim(),
  navFirst: document.querySelector('[data-i18n="nav.notes"]')?.textContent?.trim(),
})`)

const data = JSON.parse(result)
console.log('lang        :', data.lang)
console.log('greeting    :', data.greeting)
console.log('nav.notes    :', data.navFirst)
console.log(
  'swap at     :',
  data.swapAt === null ? 'tidak diinstrumentasi' : `${data.swapAt.toFixed(1)} ms`
)
console.log('FCP         :', data.fcp === null ? 'tidak ada' : `${data.fcp.toFixed(1)} ms`)
console.log('DOM interactive:', data.domInteractive, 'ms')

if (data.swapAt !== null && data.fcp !== null) {
  console.log(
    data.swapAt < data.fcp
      ? '\n✅ Swap terjadi SEBELUM first paint — tidak ada kilat.'
      : '\n⚠️  Swap terjadi SESUDAH first paint — ada kilat.'
  )
}

// uji pergantian bahasa tanpa reload (jalur 'i18n:change')
const before = await evaluate(
  `document.querySelector('[data-i18n="nav.notes"]').textContent.trim()`
)
await evaluate(
  `localStorage.setItem('lang','en'); window.dispatchEvent(new Event('i18n:change')); 'ok'`
)
await wait(120)
const after = await evaluate(`JSON.stringify({
  nav: document.querySelector('[data-i18n="nav.notes"]').textContent.trim(),
  lang: document.documentElement.getAttribute('lang'),
  dataLang: document.documentElement.getAttribute('data-lang'),
  bioIdVisible: getComputedStyle(document.querySelector('.lang-id')).display,
  bioEnVisible: getComputedStyle(document.querySelector('.lang-en')).display,
})`)
await evaluate(
  `localStorage.setItem('lang','id'); window.dispatchEvent(new Event('i18n:change')); 'ok'`
)
await wait(120)
const back = await evaluate(
  `JSON.stringify({ nav: document.querySelector('[data-i18n="nav.notes"]').textContent.trim(), lang: document.documentElement.getAttribute('lang') })`
)

const b = JSON.parse(after)
console.log('\n--- runtime toggle (tanpa reload) ---')
console.log('kembali ke id:', JSON.parse(back).nav, '| lang attr:', JSON.parse(back).lang)
console.log('nav sebelum :', before)
console.log('nav sesudah :', b.nav, '| lang attr:', b.lang, '| data-lang:', b.dataLang)
console.log('.lang-id display:', b.bioIdVisible, '| .lang-en display:', b.bioEnVisible)

ws.close()
chrome.kill()
process.exit(0)
