import test from 'node:test'
import assert from 'node:assert/strict'
import { createLimiter } from './limit'

test('per-minute, per-day and global limits', () => {
  let t = 0
  const l = createLimiter({ perMinute: 2, perDay: 3, globalPerDay: 5 }, () => t)
  assert.equal(l.check('a').ok, true)
  assert.equal(l.check('a').ok, true)
  const r = l.check('a')
  assert.deepEqual(r.ok ? null : r.reason, 'minute') // third in a minute
  t += 61_000
  assert.equal(l.check('a').ok, true) // minute window passed → 3rd of the day
  const d = l.check('a')
  assert.equal(d.ok ? null : d.reason, 'day') // 4th of the day
  assert.equal(l.check('b').ok, true)
  assert.equal(l.check('b').ok, true) // global now 5
  const g = l.check('c')
  assert.equal(g.ok ? null : g.reason, 'global')
  t += 864e5 // next day: everything resets
  assert.equal(l.check('c').ok, true)
})
