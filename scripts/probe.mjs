/**
 * Probe interaktif: set viewport + localStorage, jalankan aksi, laporkan computed style.
 *
 * Usage:
 *   node scripts/probe.mjs <url> <width> <height> <theme> <js-to-run> [shotPath]
 */
import { writeFileSync } from 'node:fs'
import { launchChrome, wait, waitForPage, openCdpSession } from './lib/chrome.mjs'

const PORT = 9388

const [, , url, width = '420', height = '860', theme = 'dark', action = 'null', shot = ''] =
  process.argv

const chrome = launchChrome({ port: PORT, profileDir: '/tmp/probe-profile' })

const page = await waitForPage(PORT)
const logs = []
const { ws, send, evaluate } = await openCdpSession(page, { captureLogs: logs })

await send('Runtime.enable')
await send('Page.enable')

await send('Emulation.setDeviceMetricsOverride', {
  width: Number(width),
  height: Number(height),
  deviceScaleFactor: 2,
  mobile: true,
})

await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { localStorage.setItem('theme', ${JSON.stringify(theme)}) } catch (e) {}`,
})

await send('Page.navigate', { url })
await wait(900)

if (action && action !== 'null') {
  const result = await evaluate(
    `Promise.resolve((async () => { ${action} })()).then(
    (v) => JSON.stringify(v ?? null),
    (e) => 'ACTION ERROR: ' + e.message
  )`,
    { awaitPromise: true }
  )
  await wait(700)
  if (result !== 'null') console.log('ACTION:', result)
}

const report = await evaluate(
  `(() => {
  const cs = (sel, props) => {
    const el = document.querySelector(sel)
    if (!el) return sel + ': MISSING'
    const s = getComputedStyle(el)
    return sel + ': ' + props.map((p) => p + '=' + s[p]).join(', ')
  }
  // The bar has two states: edge-attached (no radius, no border) and detached
  // as a floating pill. data-floating is what the Navbar script toggles.
  // Pick the bar that is actually rendered at this viewport: #site-nav is
  // display:none below the md breakpoint, and the dock is hidden above it.
  const bar = [...document.querySelectorAll('#site-nav, [data-nav-dock]')].find(
    (el) => getComputedStyle(el).display !== 'none'
  )
  const barState = (() => {
    if (!bar) return 'navbar: MISSING'
    const inner = bar.firstElementChild
    const s = getComputedStyle(inner)
    return [
      'navbar(' + (bar.id || 'dock') + '): floating=' + bar.hasAttribute('data-floating'),
      'hidden=' + bar.classList.contains('opacity-0'),
      'wrapPad=' + getComputedStyle(bar).paddingLeft,
      'radius=' + s.borderRadius,
      'border=' + s.borderTopWidth,
      'shadow=' + (s.boxShadow === 'none' ? 'none' : 'yes'),
      'blur=' + (s.backdropFilter === 'none' ? 'none' : 'yes'),
      'scrollY=' + Math.round(window.scrollY),
    ].join(', ')
  })()
  return [
    'html.class = ' + document.documentElement.className,
    '--color-bg = ' + getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim(),
    '--color-text = ' + getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
    cs('body', ['backgroundColor', 'color']),
    cs('#settings-menu-desktop', ['display']),
    cs('#settings-menu-mobile', ['display']),
    barState,
  ].join('\\n')
})()`,
  { awaitPromise: true }
)

console.log(`--- ${width}x${height} theme=${theme} ---`)
console.log(report)
if (logs.length > 0) console.log(logs.join('\n'))

if (shot) {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(shot, Buffer.from(result.result.data, 'base64'))
  console.log('shot:', shot)
}

ws.close()
chrome.kill()
process.exit(0)
