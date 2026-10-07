# Architecture notes

See the README for the overview. Details worth knowing before changing things:

**Why three view layers?** Electron paints `WebContentsView`s above the window's own contents, so UI that must float over a page (the Orbit Bar, palette, site panel, find bar) can't live in the same view as the Rail. The chrome view sits underneath the page views; the overlay view sits on top and is resized per mode (`OrbitWindow.layoutOverlay`). Re-adding the overlay after any page change keeps it topmost.

**Why `orbit://<page>` as hostnames?** One renderer bundle serves every internal page; `location.hostname` picks the route (`apps/browser/src/renderer/main.tsx`). Because they're real origins, the preload's `location.protocol === 'orbit:'` check and the main process's sender check are meaningful security boundaries.

**IPC shape.** `state` (get snapshot), `act(type, payload)` (commands, returns primitives only), `query(type, payload)` (reads like history search and suggestions). Add a command by adding a handler to `ACT`/`QUERY` in `ipc.ts`; validate payload fields there.

**Commands.** `commands.ts` is the single registry used by the menu bar (accelerators), the palette, slash commands in the Bar and IPC. Adding a command there exposes it everywhere.

**Known ceilings** (marked `ponytail:` in code): JSON storage; registrable-domain match for the third-party cookie rule is last-two-labels; the right Rail and Focus peek rely on mouse-leave events between views.
