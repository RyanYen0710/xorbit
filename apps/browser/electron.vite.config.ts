import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Workspace packages ship as TS source, so they must be bundled rather than externalized.
const bundle = ['@orbit/types', '@orbit/themes', '@orbit/search', '@orbit/ui']

export default defineConfig({
  main: { build: { externalizeDeps: { exclude: bundle } } },
  preload: { build: { externalizeDeps: { exclude: bundle } } },
  renderer: {
    plugins: [react()],
    // orbit:// pages can't derive the HMR socket from location, so point it at the dev server.
    server: {
      port: 5173,
      strictPort: true,
      hmr: { host: 'localhost', port: 5173, protocol: 'ws' },
    },
  },
})
