// Spaces are Chrome tab groups: a tab belongs to the Space whose name matches its group's title;
// ungrouped tabs belong to the first Space. Switching a Space collapses every other group.
import { GROUP_COLORS, asChromeColor, getSpaces, setSpaces, uid, type Space } from './shared'

const active = async (windowId: number) =>
  ((await chrome.storage.session.get('active'))['active'] ?? {}) as Record<number, string>
export async function getActiveSpace(windowId: number): Promise<Space> {
  const spaces = await getSpaces()
  const id = (await active(windowId))[windowId]
  return spaces.find((s) => s.id === id) ?? spaces[0]
}
async function setActive(windowId: number, id: string) {
  await chrome.storage.session.set({ active: { ...(await active(windowId)), [windowId]: id } })
}

export function spaceOf(
  tab: chrome.tabs.Tab,
  spaces: Space[],
  groups: chrome.tabGroups.TabGroup[],
): Space {
  const g = groups.find((x) => x.id === tab.groupId)
  return (g && spaces.find((s) => s.name === g.title)) || spaces[0]
}

export async function moveTabToSpace(tabId: number, spaceId: string) {
  const spaces = await getSpaces()
  const space = spaces.find((s) => s.id === spaceId)
  const tab = await chrome.tabs.get(tabId)
  if (!space) return
  if (
    space === spaces[0] &&
    !(await chrome.tabGroups.query({ windowId: tab.windowId, title: space.name })).length
  ) {
    if (tab.groupId !== -1) await chrome.tabs.ungroup(tabId)
    return
  }
  const [group] = await chrome.tabGroups.query({ windowId: tab.windowId, title: space.name })
  const groupId = await chrome.tabs.group(
    group
      ? { tabIds: tabId, groupId: group.id }
      : { tabIds: tabId, createProperties: { windowId: tab.windowId } },
  )
  await chrome.tabGroups.update(groupId, { title: space.name, color: asChromeColor(space.color) })
}

export async function switchSpace(windowId: number, spaceId: string) {
  const spaces = await getSpaces()
  const space = spaces.find((s) => s.id === spaceId)
  if (!space) return
  await setActive(windowId, space.id)
  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId }),
  ])
  const mine = tabs.filter((t) => spaceOf(t, spaces, groups).id === space.id)
  for (const g of groups)
    if (spaces.some((s) => s.name === g.title))
      await chrome.tabGroups.update(g.id, { collapsed: g.title !== space.name })
  const target = mine.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0]
  if (target) await chrome.tabs.update(target.id!, { active: true })
  else {
    const t = await chrome.tabs.create({ windowId })
    await moveTabToSpace(t.id!, space.id)
  }
}

export async function cycleSpace(windowId: number, dir: 1 | -1) {
  const spaces = await getSpaces()
  const cur = await getActiveSpace(windowId)
  await switchSpace(
    windowId,
    spaces[
      (spaces.indexOf(spaces.find((s) => s.id === cur.id)!) + dir + spaces.length) % spaces.length
    ].id,
  )
}

export async function createSpace(windowId: number, name: string, color?: Space['color']) {
  const spaces = await getSpaces()
  const n = name.trim().toUpperCase().slice(0, 24)
  if (!n || spaces.some((s) => s.name === n)) return
  const sp: Space = {
    id: uid(),
    name: n,
    color: color ?? GROUP_COLORS[spaces.length % GROUP_COLORS.length],
  }
  await setSpaces([...spaces, sp])
  await switchSpace(windowId, sp.id)
}
