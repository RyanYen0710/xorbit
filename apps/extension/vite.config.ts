import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pages + service worker. The injected Orbit Bar is built separately (vite.bar.config.ts) because
// content scripts injected with executeScript({files}) cannot import shared chunks.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        newtab: 'newtab.html',
        sidepanel: 'sidepanel.html',
        options: 'options.html',
        background: 'src/background.ts',
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
