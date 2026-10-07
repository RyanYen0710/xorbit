import type { OrbitWindow } from './window'

export const windows = new Set<OrbitWindow>()
/** webContents id → owning window, for the shell views and every tab. Used to authorise IPC senders. */
export const byContents = new Map<number, OrbitWindow>()
export const broadcast = () => windows.forEach((w) => w.changed())
export const focusedWindow = (): OrbitWindow | undefined =>
  [...windows].find((w) => w.win.isFocused()) ?? [...windows].pop()
