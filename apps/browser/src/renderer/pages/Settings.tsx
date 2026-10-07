import { useState } from 'react'
import { PROVIDERS } from '@orbit/search'
import { PRESETS } from '@orbit/themes'
import type { PermissionKey, PermissionValue, Settings as S, SearchProviderId } from '@orbit/types'
import { act, kbdLabel, useOrbit } from '../state'
import { Page, Row, Toggle } from './shared'

const SECTIONS = [
  'General',
  'Appearance',
  'Themes',
  'Spaces',
  'Search',
  'Tabs',
  'Privacy',
  'Site Permissions',
  'Downloads',
  'Keyboard',
  'Profiles',
  'Extensions',
  'About X Orbit',
] as const
type Sec = (typeof SECTIONS)[number]
const SLUG: Record<string, Sec> = {
  privacy: 'Privacy',
  search: 'Search',
  about: 'About X Orbit',
  spaces: 'Spaces',
  appearance: 'Appearance',
}

const SHORTCUTS: [string, string][] = [
  ['New tab', 'Mod+T'],
  ['Close tab', 'Mod+W'],
  ['Reopen closed tab', 'Mod+Shift+T'],
  ['Orbit Bar', 'Mod+L'],
  ['Orbit Command', 'Mod+K'],
  ['Find in page', 'Mod+F'],
  ['Reload', 'Mod+R'],
  ['Back / Forward', 'Mod+[ / Mod+]'],
  ['Pin page', 'Mod+D'],
  ['Toggle sidebar', 'Mod+B'],
  ['Focus Mode', 'Mod+Shift+F'],
  ['Split view', 'Mod+\\'],
  ['Next / previous tab', 'Ctrl+Tab / Ctrl+Shift+Tab'],
  ['Next / previous Space', 'Mod+Alt+Right / Left'],
  ['Tab 1–8, last tab', 'Mod+1…8, Mod+9'],
  ['History', 'Mod+Y'],
  ['Downloads', 'Mod+Shift+J'],
  ['Settings', 'Mod+,'],
  ['New window / private', 'Mod+N / Mod+Shift+N'],
  ['Developer tools', 'Mod+Alt+I'],
]
const PERMS: [PermissionKey, string][] = [
  ['camera', 'Camera'],
  ['microphone', 'Microphone'],
  ['geolocation', 'Location'],
  ['notifications', 'Notifications'],
]

export default function Settings() {
  const s = useOrbit()!
  const set = s.settings
  const initial = SLUG[new URLSearchParams(location.search).get('s') ?? ''] ?? 'General'
  const [sec, setSec] = useState<Sec>(initial)
  const [msg, setMsg] = useState('')
  const put = <K extends keyof S>(key: K | string, value: unknown) =>
    act('setSetting', { key, value })
  const mac = s.platform === 'darwin'

  const body = {
    General: (
      <>
        <Row
          label="Default browser"
          hint="Register X Orbit as your handler for http and https links (works in installed builds)."
        >
          <button className="btn ghost" onClick={() => act('setDefaultBrowser')}>
            Make default
          </button>
        </Row>
        <Row
          label="Restore previous session"
          hint="Reopen your tabs and Spaces when X Orbit starts."
        >
          <Toggle
            on={set.restoreSession}
            onChange={(v) => put('restoreSession', v)}
            label="Restore previous session"
          />
        </Row>
        <Row label="Homepage" hint="Opens in new tabs. Leave empty for the Orbit New Tab page.">
          <input
            className="field"
            defaultValue={set.homepage}
            placeholder="https://…"
            aria-label="Homepage"
            onBlur={(e) =>
              e.target.value !== set.homepage && put('homepage', e.target.value.trim())
            }
          />
        </Row>
      </>
    ),
    Appearance: (
      <>
        <Row
          label="Appearance"
          hint="‘Follow theme’ uses the selected theme as designed. Dark / Light / System switch to ZERO or LUNAR when the theme doesn’t match."
        >
          <select
            className="field"
            value={set.appearance}
            onChange={(e) => put('appearance', e.target.value)}
            aria-label="Appearance"
          >
            <option value="theme">Follow theme</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </Row>
        <Row label="Sidebar position">
          <select
            className="field"
            value={set.railPosition}
            onChange={(e) => put('railPosition', e.target.value)}
            aria-label="Sidebar position"
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </Row>
        <Row label="Sidebar width" hint="Width of the expanded Mission Control.">
          <input
            type="range"
            min={200}
            max={420}
            step={4}
            value={set.railWidth}
            onChange={(e) => put('railWidth', Number(e.target.value))}
            aria-label="Sidebar width"
          />
        </Row>
        <Row label="Animations" hint="Also respects your system’s reduced-motion setting.">
          <Toggle on={set.animations} onChange={(v) => put('animations', v)} label="Animations" />
        </Row>
        <Row label="Compact mode" hint="Tighter tab rows.">
          <Toggle on={set.compact} onChange={(v) => put('compact', v)} label="Compact mode" />
        </Row>
        <Row
          label="Show bottom Orbit Bar"
          hint={`When off, open it with ${kbdLabel('Mod+L', mac)}.`}
        >
          <Toggle
            on={set.orbitBar}
            onChange={(v) => put('orbitBar', v)}
            label="Show bottom Orbit Bar"
          />
        </Row>
      </>
    ),
    Themes: (
      <>
        <div className="theme-grid">
          {[...PRESETS, ...s.customThemes].map((t) => (
            <button
              key={t.id}
              className="theme-card"
              data-on={set.themeId === t.id}
              onClick={() => act('setTheme', { id: t.id })}
              aria-pressed={set.themeId === t.id}
              style={{
                background: t.background,
                color: t.text,
                borderColor: set.themeId === t.id ? t.accent : t.border,
              }}
            >
              <i style={{ background: t.accent }} />
              <span>{t.name.replace('ORBIT / ', '')}</span>
            </button>
          ))}
        </div>
        <p>
          <button className="btn" onClick={() => act('openInternal', { page: 'themes' })}>
            Open Theme Studio
          </button>
        </p>
      </>
    ),
    Spaces: (
      <>
        {s.spaces.map((sp) => (
          <div className="space-edit" key={sp.id}>
            <input
              className="field icon-in"
              maxLength={2}
              defaultValue={sp.icon}
              aria-label={`${sp.name} icon`}
              onBlur={(e) => act('updateSpace', { id: sp.id, icon: e.target.value })}
            />
            <input
              className="field grow"
              defaultValue={sp.name}
              aria-label="Space name"
              onBlur={(e) =>
                e.target.value !== sp.name &&
                act('updateSpace', { id: sp.id, name: e.target.value })
              }
            />
            <input
              type="color"
              value={sp.color}
              aria-label={`${sp.name} accent colour`}
              onChange={(e) => act('updateSpace', { id: sp.id, color: e.target.value })}
            />
            <label className="check">
              <Toggle
                on={sp.container}
                onChange={(v) => act('updateSpace', { id: sp.id, container: v })}
                label={`${sp.name} separate session`}
              />{' '}
              Separate session
            </label>
            <button
              className="btn ghost"
              disabled={s.spaces.length < 2}
              onClick={() =>
                confirm(`Delete ${sp.name} and close its tabs?`) &&
                act('deleteSpace', { id: sp.id })
              }
            >
              Delete
            </button>
          </div>
        ))}
        <p className="srow-hint">
          A separate session keeps a Space’s cookies and logins isolated from the others. It applies
          to tabs opened after you change it.
        </p>
        <p>
          <button
            className="btn"
            onClick={() => act('overlay', { mode: 'bar', text: '/newspace ' })}
          >
            New Space
          </button>
        </p>
      </>
    ),
    Search: (
      <>
        <Row label="Default search provider" hint="Used by the Orbit Bar and the New Tab page.">
          <select
            className="field"
            value={set.searchProvider}
            onChange={(e) => put('searchProvider', e.target.value as SearchProviderId)}
            aria-label="Default search provider"
          >
            {(['google', 'orbit', 'duckduckgo', 'bing', 'brave', 'custom'] as const).map((p) => (
              <option key={p} value={p}>
                {PROVIDERS[p].label}
              </option>
            ))}
          </select>
        </Row>
        <Row
          label="Orbit Search URL"
          hint="Where Orbit Search is served. Run it locally with pnpm dev:search. Orbit Search shows results only when a search API is configured, otherwise it forwards to Google."
        >
          <input
            className="field"
            defaultValue={set.orbitSearchUrl}
            aria-label="Orbit Search URL"
            onBlur={(e) => put('orbitSearchUrl', e.target.value.trim())}
          />
        </Row>
        <Row
          label="Custom search URL"
          hint="Use %s where the query goes, e.g. https://example.com/search?q=%s"
        >
          <input
            className="field"
            defaultValue={set.customSearchUrl}
            placeholder="https://…%s"
            aria-label="Custom search URL"
            onBlur={(e) => put('customSearchUrl', e.target.value.trim())}
          />
        </Row>
      </>
    ),
    Tabs: (
      <Row
        label="Archive tabs after"
        hint="Inactive tabs move to OLDER TABS and release their memory. Reopen them with a click."
      >
        <select
          className="field"
          value={set.archiveAfterHours}
          onChange={(e) => put('archiveAfterHours', Number(e.target.value))}
          aria-label="Archive tabs after"
        >
          <option value={0}>Never</option>
          <option value={12}>12 hours</option>
          <option value={24}>24 hours</option>
          <option value={72}>3 days</option>
          <option value={168}>7 days</option>
        </select>
      </Row>
    ),
    Privacy: (
      <>
        <p className="lede">
          These controls are what X Orbit actually does today. It does not include a tracker or ad
          blocker, and private windows do not make you anonymous.
        </p>
        <Row
          label="Block third-party cookies"
          hint="Strips cookies from requests to, and responses from, sites other than the one you’re visiting. Does not cover cookies set by scripts in embedded frames."
        >
          <Toggle
            on={set.blockThirdPartyCookies}
            onChange={(v) => put('blockThirdPartyCookies', v)}
            label="Block third-party cookies"
          />
        </Row>
        <Row
          label="JavaScript"
          hint="Turning it off blocks scripts on web pages through a content-security header. X Orbit’s own pages are unaffected."
        >
          <Toggle on={set.javascript} onChange={(v) => put('javascript', v)} label="JavaScript" />
        </Row>
        <Row label="Popups" hint="Allowed popups open as real windows so sign-in flows work.">
          <select
            className="field"
            value={set.popups}
            onChange={(e) => put('popups', e.target.value)}
            aria-label="Popups"
          >
            <option value="allow">Allow</option>
            <option value="block">Block</option>
          </select>
        </Row>
        <Row
          label="Autoplay"
          hint="Allow media to play without a click. Applies to tabs opened afterwards."
        >
          <Toggle on={set.autoplay} onChange={(v) => put('autoplay', v)} label="Autoplay" />
        </Row>
        <div className="orbit-label sub">CLEAR BROWSING DATA</div>
        <div className="toolbar">
          <button
            className="btn ghost"
            onClick={() =>
              act('clearData', { kind: 'history' }).then(() => setMsg('History cleared'))
            }
          >
            Clear history
          </button>
          <button
            className="btn ghost"
            onClick={() => act('clearData', { kind: 'cache' }).then(() => setMsg('Cache cleared'))}
          >
            Clear cache
          </button>
          <button
            className="btn ghost"
            onClick={() =>
              confirm('Clear cookies and site data? You will be signed out of sites.') &&
              act('clearData', { kind: 'cookies' }).then(() =>
                setMsg('Cookies and site data cleared'),
              )
            }
          >
            Clear cookies
          </button>
          <button
            className="btn ghost"
            onClick={() =>
              confirm('Clear history, cache, cookies and site permissions?') &&
              act('clearData', { kind: 'all' }).then(() => setMsg('Everything cleared'))
            }
          >
            Clear everything
          </button>
          {msg && (
            <span className="orbit-label" role="status">
              {msg}
            </span>
          )}
        </div>
      </>
    ),
    'Site Permissions': (
      <>
        <p className="lede">
          Default for every site. Change a single site from its lock button in the top bar.
        </p>
        {PERMS.map(([k, label]) => (
          <Row key={k} label={label}>
            <select
              className="field"
              value={set.permissionDefaults[k]}
              onChange={(e) => put(`permissionDefaults.${k}`, e.target.value as PermissionValue)}
              aria-label={label}
            >
              <option value="ask">Ask</option>
              <option value="allow">Allow</option>
              <option value="block">Block</option>
            </select>
          </Row>
        ))}
      </>
    ),
    Downloads: (
      <>
        <Row
          label="Ask where to save each file"
          hint="Off: files go straight to your Downloads folder."
        >
          <Toggle
            on={set.askDownload}
            onChange={(v) => put('askDownload', v)}
            label="Ask where to save"
          />
        </Row>
        <p>
          <button className="btn ghost" onClick={() => act('openInternal', { page: 'downloads' })}>
            Open downloads
          </button>
        </p>
      </>
    ),
    Keyboard: (
      <table className="kbd-table">
        <tbody>
          {SHORTCUTS.map(([l, k]) => (
            <tr key={l}>
              <td>{l}</td>
              <td className="mono">
                {k
                  .split(' / ')
                  .map((x) => kbdLabel(x, mac))
                  .join('  /  ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    Profiles: (
      <p className="lede">
        Multiple profiles aren’t available yet. For now, give a Space its own session (Settings →
        Spaces) to keep logins separate.
      </p>
    ),
    Extensions: <p className="lede">Extensions aren’t supported in this version.</p>,
    'About X Orbit': (
      <>
        <div className="about">
          <div className="orbit-display">X ORBIT</div>
          <div className="mono">
            Version {s.version} · {set.channel.toUpperCase()} channel
          </div>
        </div>
        <Row label="Update status">
          <span className="mono">{s.update}</span>
        </Row>
        <Row label="Check for updates">
          <button className="btn" onClick={() => act('updateCheck')}>
            CHECK FOR UPDATES
          </button>
          {s.update.includes('restart') && (
            <button className="btn" onClick={() => act('updateInstall')}>
              RESTART
            </button>
          )}
        </Row>
        <Row
          label="Automatically install updates"
          hint="Off: you’ll be notified and can restart when ready."
        >
          <Toggle
            on={set.autoUpdate}
            onChange={(v) => put('autoUpdate', v)}
            label="Automatically install updates"
          />
        </Row>
        <Row label="Release channel">
          <select
            className="field"
            value={set.channel}
            onChange={(e) => put('channel', e.target.value)}
            aria-label="Release channel"
          >
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
            <option value="developer">Developer</option>
          </select>
        </Row>
        <p className="srow-hint">Channel and auto-update changes apply on the next launch.</p>
      </>
    ),
  }[sec]

  return (
    <Page index="06" label="SETTINGS" title="Settings" wide>
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings sections">
          <div className="orbit-label">GENERAL</div>
          {SECTIONS.map((x) => (
            <button
              key={x}
              data-on={x === sec}
              aria-current={x === sec}
              onClick={() => {
                setSec(x)
                setMsg('')
              }}
            >
              {x}
            </button>
          ))}
        </nav>
        <section className="settings-body" aria-label={sec}>
          <h2 className="sec-title">{sec}</h2>
          {body}
        </section>
      </div>
    </Page>
  )
}
