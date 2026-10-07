import { contextBridge, ipcRenderer } from 'electron'

// The bridge only exists on orbit:// pages. The main process re-checks the sender on every call,
// so a remote page that somehow reached these channels would still be rejected.
if (location.protocol === 'orbit:') {
  contextBridge.exposeInMainWorld('orbit', {
    getState: () => ipcRenderer.invoke('state'),
    onState: (cb: (s: unknown) => void) => {
      const h = (_e: unknown, s: unknown) => cb(s)
      ipcRenderer.on('state', h)
      return () => ipcRenderer.removeListener('state', h)
    },
    act: (type: string, payload?: Record<string, unknown>) =>
      ipcRenderer.invoke('act', type, payload),
    query: (type: string, payload?: Record<string, unknown>) =>
      ipcRenderer.invoke('query', type, payload),
  })
}
