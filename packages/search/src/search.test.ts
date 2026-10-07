import test from 'node:test'
import assert from 'node:assert/strict'
import { calc, fuzzy, resolveInput } from './index'

const cfg = {
  provider: 'google' as const,
  customUrl: '',
  orbitUrl: 'http://localhost:4400/orbit-search',
}

test('resolveInput', () => {
  assert.equal(resolveInput('google.com', cfg)?.url, 'https://google.com')
  assert.equal(resolveInput('localhost:3000/x', cfg)?.url, 'http://localhost:3000/x')
  assert.equal(resolveInput('http://a.b/c d', cfg)?.kind, 'search')
  assert.equal(
    resolveInput('SpaceX Starship', cfg)?.url,
    'https://www.google.com/search?q=SpaceX%20Starship',
  )
  assert.equal(resolveInput('javascript:alert(1)', cfg)?.kind, 'search')
  assert.equal(resolveInput('orbit://settings', cfg)?.url, 'orbit://settings')
  assert.equal(resolveInput('  ', cfg), null)
  assert.equal(
    resolveInput('hi', { ...cfg, provider: 'orbit' })?.url,
    'http://localhost:4400/orbit-search?q=hi',
  )
})

test('calc', () => {
  assert.equal(calc('2+2*3'), 8)
  assert.equal(calc('(1+2)^2'), 9)
  assert.equal(calc('-4/8'), -0.5)
  assert.equal(calc('1/0'), null)
  assert.equal(calc('2024'), null)
  assert.equal(calc('process.exit()'), null)
})

test('fuzzy', () => {
  assert.ok(fuzzy('nsp', 'New Space')! > 0)
  assert.equal(fuzzy('zzz', 'New Space'), null)
  assert.ok(fuzzy('set', 'Settings')! > fuzzy('set', 'Reset everything')!)
})

test('createProvider prefers serper, honours ORBIT_SEARCH_BACKEND, null without keys', async () => {
  const { createProvider } = await import('./adapters')
  assert.equal(createProvider({}), null)
  assert.equal(createProvider({ SERPER_API_KEY: 'k' })?.id, 'serper')
  assert.equal(createProvider({ SERPER_API_KEY: 'k', BRAVE_SEARCH_API_KEY: 'b' })?.id, 'serper')
  assert.equal(
    createProvider({
      SERPER_API_KEY: 'k',
      BRAVE_SEARCH_API_KEY: 'b',
      ORBIT_SEARCH_BACKEND: 'brave',
    })?.id,
    'brave',
  )
})
