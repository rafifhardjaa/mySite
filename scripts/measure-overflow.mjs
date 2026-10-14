/**
 * Mengukur overflow horizontal pada beberapa lebar viewport.
 * Pakai Emulation.setDeviceMetricsOverride supaya viewport mobile sungguhan,
 * bukan window yang dijepit Chrome.
 *
 * Usage: node scripts/measure-overflow.mjs <url> [width...]
 */
import { launchChrome, wait, waitForPage, openCdpSession } from './lib/chrome.mjs'

const PORT = 9355
const url = process.argv[2] ?? 'http://localhost:8851/'
const widths = process.argv.slice(3).map(Number)
const sizes = widths.length > 0 ? widths : [360, 420, 768, 1024, 1280]

const chrome = launchChrome({ port: PORT, profileDir: '/tmp/overflow-profile' })

const page = await waitForPage(PORT)
const { ws, send, evaluate } = await openCdpSession(page)

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
