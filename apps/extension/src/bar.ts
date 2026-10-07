// Orbit Bar overlay, injected on demand (activeTab) into the current page. Self-contained: no imports.
interface Item {
  id: string
  kind: string
  title: string
  sub?: string
  favicon?: string
  run: { type: string; payload: Record<string, unknown> }
}

;(() => {
  const ID = 'orbit-bar-host'
  const existing = document.getElementById(ID)
  if (existing) {
    existing.remove()
    return
  } // second press toggles it closed

  const host = document.createElement('div')
  host.id = ID
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647'
  const root = host.attachShadow({ mode: 'closed' })
  root.innerHTML = `
  <style>
    :host{all:initial}
    *{box-sizing:border-box}
    .scrim{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;justify-content:center;align-items:flex-end;padding:0 20px 24px;animation:f .12s ease-out;font:14px/1.4 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
    @keyframes f{from{opacity:0}} @keyframes r{from{opacity:0;transform:translateY(8px) scale(.985)}}
    .panel{width:min(680px,100%);display:flex;flex-direction:column-reverse;background:var(--orbit-bar,#111);color:var(--orbit-text,#f5f5f2);border:1px solid var(--orbit-border-strong,rgba(255,255,255,.22));border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);animation:r .16s cubic-bezier(.2,0,0,1)}
    .row{display:flex;align-items:center;gap:12px;height:52px;padding:0 18px;border-top:1px solid var(--orbit-border,rgba(255,255,255,.12));color:var(--orbit-text-2,#a0a0a0)}
    input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--orbit-text,#f5f5f2);font:inherit;font-size:15px}
    kbd{font:10px ui-monospace,Menlo,monospace;color:var(--orbit-muted,#686868);border:1px solid var(--orbit-border,rgba(255,255,255,.12));border-radius:4px;padding:1px 5px}
    ul{list-style:none;margin:0;padding:6px 6px 0;max-height:52vh;overflow:auto}
    ul:empty{display:none}
    li{display:flex;align-items:center;gap:12px;height:38px;padding:0 12px;border-radius:8px;cursor:default}
    li[aria-selected=true]{background:var(--orbit-tab-active,#1a1a1a)}
    li img,li .ico{width:16px;height:16px;flex:none;border-radius:3px}
    li .ico{display:grid;place-items:center;color:var(--orbit-muted,#686868);font-size:12px}
    .t{flex:none;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .s{flex:1;min-width:0;text-align:right;color:var(--orbit-muted,#686868);font:11px ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    @media (prefers-reduced-motion:reduce){*{animation:none!important}}
  </style>
  <div class="scrim"><div class="panel" role="dialog" aria-label="Orbit Bar">
    <div class="row"><span aria-hidden="true">⌕</span><input spellcheck="false" autocomplete="off" placeholder="Search, enter address, @tabs, @history, /settings" aria-label="Search or enter address"><kbd>esc</kbd></div>
    <ul role="listbox"></ul>
  </div></div>`

  const $ = <T extends Element>(s: string) => root.querySelector(s) as T
  const input = $<HTMLInputElement>('input'),
    list = $<HTMLUListElement>('ul'),
    scrim = $<HTMLElement>('.scrim')
  let items: Item[] = [],
    itemsFor = '',
    sel = 0,
    seq = 0

  const close = () => {
    host.remove()
    document.removeEventListener('keydown', esc, true)
  }
  const esc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    }
  }
  const paint = () => {
    list.replaceChildren(
      ...items.map((it, i) => {
        const li = document.createElement('li')
        li.setAttribute('role', 'option')
        li.setAttribute('aria-selected', String(i === sel))
        if (it.favicon) {
          const im = document.createElement('img')
          im.src = it.favicon
          im.alt = ''
          li.append(im)
        } else {
          const ic = document.createElement('span')
          ic.className = 'ico'
          ic.textContent = it.kind === 'command' ? '›' : it.kind === 'calc' ? '=' : '⌕'
          li.append(ic)
        }
        const t = document.createElement('span')
        t.className = 't'
        t.textContent = it.title
        const s = document.createElement('span')
        s.className = 's'
        s.textContent = it.sub ?? ''
        li.append(t, s)
        li.onmousemove = () => {
          if (sel !== i) {
            sel = i
            paint()
          }
        }
        li.onclick = () => go(it, false)
        return li
      }),
    )
  }
  const go = async (it: Item | undefined, newTab: boolean) => {
    const text = input.value
    close()
    if (it?.run.type === 'copy') {
      try {
        await navigator.clipboard.writeText(String(it.run.payload.text))
      } catch {
        /* page may block clipboard */
      }
      return
    }
    const run = it
      ? {
          ...it.run,
          payload: it.run.type === 'navigate' ? { ...it.run.payload, newTab } : it.run.payload,
        }
      : text.trim()
        ? { type: 'navigate', payload: { input: text, newTab } }
        : null
    if (run) chrome.runtime.sendMessage({ type: 'run', run })
  }
  const query = async () => {
    const n = ++seq
    const asked = input.value
    const r = (await chrome.runtime.sendMessage({ type: 'suggest', text: input.value })) as
      Item[] | null
    if (n === seq && r) {
      items = r
      itemsFor = asked
      sel = 0
      paint()
    }
  }

  input.addEventListener('input', query)
  input.addEventListener('keydown', (e) => {
    e.stopPropagation() // keep page shortcuts from seeing our typing
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      sel = Math.min(sel + 1, items.length - 1)
      paint()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      sel = Math.max(sel - 1, 0)
      paint()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      /* stale suggestions → use what was typed */ void go(
        itemsFor === input.value ? items[sel] : undefined,
        e.metaKey || e.ctrlKey,
      )
    }
  })
  for (const t of ['keyup', 'keypress']) input.addEventListener(t, (e) => e.stopPropagation())
  scrim.addEventListener('mousedown', (e) => {
    if (e.target === scrim) close()
  })
  document.addEventListener('keydown', esc, true)

  document.documentElement.append(host)
  void chrome.runtime
    .sendMessage({ type: 'init' })
    .then((r: { vars: Record<string, string> } | null) => {
      if (r)
        for (const [k, v] of Object.entries(r.vars))
          if (k.startsWith('--')) scrim.style.setProperty(k, v)
    })
  input.focus()
  void query()
})()
