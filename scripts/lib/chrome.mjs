import { spawn } from 'node:child_process'

export const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export const wait = (ms) => new Promise((done) => setTimeout(done, ms))

export function launchChrome({ port, profileDir }) {
  return spawn(CHROME_BIN, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ])
}

/** Polls the DevTools endpoint until a page target appears. */
export async function waitForPage(port, { attempts = 40, intervalMs = 250 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {}
    await wait(intervalMs)
  }
  throw new Error('chrome tidak merespons')
}

/**
 * Minimal CDP session over the page target: send() for raw calls and
 * evaluate() for Runtime.evaluate. Pass an array as captureLogs to also
 * collect console and exception output.
 */
export async function openCdpSession(page, { captureLogs = null } = {}) {
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (captureLogs) {
      if (msg.method === 'Runtime.exceptionThrown') {
        captureLogs.push(
          'EXCEPTION: ' +
            (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
        )
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        captureLogs.push(
          'CONSOLE: ' + msg.params.args.map((a) => a.value ?? a.description).join(' ')
        )
      }
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  })

  await new Promise((r) => ws.addEventListener('open', r))

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const messageId = ++id
      pending.set(messageId, resolve)
      ws.send(JSON.stringify({ id: messageId, method, params }))
    })

  const evaluate = async (expression, extra = {}) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, ...extra })
    return res.result?.result?.value
  }

  return { ws, send, evaluate }
}
