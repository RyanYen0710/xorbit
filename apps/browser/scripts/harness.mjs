// Drives a built X Orbit over the Node inspector (playwright-core's Electron driver doesn't attach to Electron 44).
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import path from 'node:path'

const electronPath = createRequire(import.meta.url)('electron')

export const until = async (fn, what, ms = 8000) => {
  const t = Date.now()
  for (;;) {
    const v = await fn().catch(() => null)
    if (v) return v
    if (Date.now() - t > ms) throw new Error('timeout: ' + what)
    await new Promise((r) => setTimeout(r, 100))
  }
}

export function launch({ userData, downloads }) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.env.ORBIT_APP_BIN ?? electronPath,
      process.env.ORBIT_APP_BIN ? ['--inspect=0'] : ['--inspect=0', '.'],
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'ignore', 'pipe'],
        env: {
          ...process.env,
          ORBIT_TEST: '1',
          ORBIT_USER_DATA: userData,
          ORBIT_DOWNLOADS: downloads ?? path.join(userData, 'dl'),
        },
      },
    )
    let buf = ''
    proc.stderr.on('data', (d) => {
      buf += d
      const m = /ws:\/\/127\.0\.0\.1:(\d+)\/([\w-]+)/.exec(buf)
      if (!m || proc.ws) return
      const ws = (proc.ws = new WebSocket(m[0]))
      const pending = new Map()
      let id = 0
      ws.onmessage = (e) => {
        const r = JSON.parse(e.data)
        pending.get(r.id)?.(r)
        pending.delete(r.id)
      }
      ws.onopen = async () => {
        const app = { proc }
        app.eval = (expression) =>
          new Promise((res, rej) => {
            const i = ++id
            pending.set(i, (r) =>
              r.result?.exceptionDetails
                ? rej(new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed'))
                : res(r.result?.result?.value),
            )
            ws.send(
              JSON.stringify({
                id: i,
                method: 'Runtime.evaluate',
                params: { expression, awaitPromise: true, returnByValue: true },
              }),
            )
          })
        // Run `body` in the main process with the first window `w`.
        app.W = (body, arg) =>
          app.eval(
            `(async()=>{ const arg = ${JSON.stringify(arg ?? null)}; const o = globalThis.__orbit; const w = [...o.windows][0]; ${body} })()`,
          )
        app.state = () => app.W('return w.state()')
        app.act = (type, payload = {}) =>
          app.W(
            `return w.chrome.webContents.executeJavaScript('window.orbit.act(' + JSON.stringify(arg.type) + ',' + JSON.stringify(arg.payload) + ')')`,
            { type, payload },
          )
        app.tab = async () => {
          const s = await app.state()
          return s.tabs.find((t) => t.id === s.activeTabId)
        }
        app.quit = () =>
          new Promise((res) => {
            proc.once('exit', res)
            app.eval('globalThis.__orbit.app.quit()').catch(() => {})
            setTimeout(() => {
              proc.kill()
              res()
            }, 8000)
          })
        await until(
          () =>
            app.eval(
              'typeof globalThis.__orbit === "object" && globalThis.__orbit.windows.size > 0',
            ),
          'test hook',
        )
        resolve(app)
      }
    })
    proc.on('error', reject)
    setTimeout(() => reject(new Error('launch timeout')), 30000)
  })
}
