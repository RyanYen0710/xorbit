import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/bar.ts',
      formats: ['iife'],
      name: 'OrbitBar',
      fileName: () => 'assets/bar.js',
    },
  },
})
