import { build } from 'esbuild'
import fs from 'node:fs'

await build({
  entryPoints: ['vendor-entry.js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  outfile: '../vendor/firebase.js',
  logLevel: 'info',
})
console.log(
  'vendor/firebase.js',
  Math.round(fs.statSync('../vendor/firebase.js').size / 1024) + ' KB',
)
