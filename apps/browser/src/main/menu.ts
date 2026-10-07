import { app, Menu, type MenuItemConstructorOptions as Item } from 'electron'
import { COMMANDS, runCommand } from './commands'
import { focusedWindow } from './registry'

const kbd = (id: string) => COMMANDS.find((c) => c.id === id)?.kbd?.replace('Mod', 'CmdOrCtrl')
const cmd = (id: string, label?: string): Item => ({
  label: label ?? COMMANDS.find((c) => c.id === id)?.title,
  accelerator: kbd(id),
  click: () => runCommand(id),
})

export function buildMenu() {
  const mac = process.platform === 'darwin'
  const tabs: Item[] = Array.from({ length: 9 }, (_, i) => ({
    label: i === 8 ? 'Last Tab' : `Tab ${i + 1}`,
    accelerator: `CmdOrCtrl+${i + 1}`,
    visible: false,
    click: () => focusedWindow()?.tabAt(i + 1),
  }))
  const template: Item[] = [
    ...(mac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              cmd('checkUpdates'),
              { type: 'separator' },
              cmd('settings', 'Settings…'),
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } as Item,
        ]
      : []),
    {
      label: 'File',
      submenu: [
        cmd('newTab'),
        cmd('newWindow'),
        cmd('newPrivate'),
        { type: 'separator' },
        cmd('closeTab'),
        cmd('reopenTab'),
        cmd('pinPage'),
        cmd('bookmarkPage'),
        ...(mac ? [] : [{ type: 'separator' } as Item, cmd('settings'), { role: 'quit' } as Item]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        cmd('find'),
      ],
    },
    {
      label: 'View',
      submenu: [
        cmd('focusBar'),
        cmd('palette'),
        { type: 'separator' },
        cmd('reload'),
        cmd('hardReload'),
        { type: 'separator' },
        cmd('toggleRail'),
        cmd('focusMode'),
        cmd('splitView'),
        { type: 'separator' },
        cmd('zoomIn'),
        cmd('zoomOut'),
        cmd('zoomReset'),
        { type: 'separator' },
        { role: 'togglefullscreen' },
        cmd('devTools'),
      ],
    },
    {
      label: 'Spaces',
      submenu: [
        cmd('newSpace', 'New Space…'),
        cmd('nextSpace'),
        cmd('prevSpace'),
        { type: 'separator' },
        cmd('nextTab'),
        cmd('prevTab'),
        {
          label: 'Next Tab (alt)',
          accelerator: 'CmdOrCtrl+Shift+]',
          visible: false,
          click: () => runCommand('nextTab'),
        },
        {
          label: 'Previous Tab (alt)',
          accelerator: 'CmdOrCtrl+Shift+[',
          visible: false,
          click: () => runCommand('prevTab'),
        },
        ...tabs,
      ],
    },
    {
      label: 'History',
      submenu: [
        cmd('back'),
        cmd('forward'),
        {
          label: 'Back (alt)',
          accelerator: 'Alt+Left',
          visible: !mac && false,
          click: () => runCommand('back'),
        },
        { type: 'separator' },
        cmd('history'),
        cmd('downloads'),
        cmd('pins'),
        cmd('themes'),
        cmd('clearData', 'Clear Browsing Data…'),
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
