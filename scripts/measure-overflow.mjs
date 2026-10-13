/**
 * Mengukur overflow horizontal pada beberapa lebar viewport.
 * Pakai Emulation.setDeviceMetricsOverride supaya viewport mobile sungguhan,
 * bukan window yang dijepit Chrome.
 *
 * Usage: node scripts/measure-overflow.mjs <url> [width...]
 */
import { spawn } from 'node:child_process'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9355
const url = process.argv[2] ?? 'http://localhost:8851/'
const widths = process.argv.slice(3).map(Number)
const sizes = widths.length > 0 ? widths : [360, 420, 768, 1024, 1280]

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/overflow-profile',
  'about:blank',
])

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function findPage() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {}
    await wait(250)
  }
  throw new Error('chrome tidak merespons')
}

const page = await findPage()
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

await send('Page.enable')

console.log(`viewport  scrollWidth  innerWidth  overflow  culprits`)
for (const width of sizes) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await send('Page.navigate', { url })
  await wait(700)

  const data = JSON.parse(
    await evaluate(`(() => {
      const doc = document.documentElement
      const overflow = doc.scrollWidth - doc.clientWidth
      const culprits = []
      if (overflow > 0) {
        document.querySelectorAll('*').forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.right > doc.clientWidth + 1 && r.width > 0) {
            culprits.push(el.tagName.toLowerCase() +
              (el.className && typeof el.className === 'string'
                ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.')
                : ''))
          }
        })
      }
      return JSON.stringify({ scroll: doc.scrollWidth, client: doc.clientWidth, overflow,
        culprits: [...new Set(culprits)].slice(0, 5) })
    })()`)
  )

  const flag = data.overflow > 0 ? '  ⚠️' : ''
  console.log(
    `${String(width).padEnd(9)}${String(data.scroll).padEnd(12)}${String(data.client).padEnd(11)}${String(data.overflow).padEnd(9)}${data.culprits.join(', ') || '-'}${flag}`
  )
}

ws.close()
chrome.kill()
process.exit(0)
