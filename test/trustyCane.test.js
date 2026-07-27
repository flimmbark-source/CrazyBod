import test from 'node:test'
import assert from 'node:assert/strict'

import { getNode } from '../src/progression/skillTreeConfig.js'
import { scoreWithTrustyCane } from '../src/progression/trustyCane.js'

test('Trusty Cane branches from Auto Target', () => {
  const cane = getNode('trustyCane')
  assert.equal(cane.parent, 'autotarget')
  assert.equal(cane.effect.multiplier, 2)
  assert.equal(cane.effect.activatesAt, 15)
})

test('Trusty Cane does not retroactively multiply score earned before pickup', () => {
  assert.equal(scoreWithTrustyCane(10, 10, true), 100)
  assert.equal(scoreWithTrustyCane(15, 10, true), 150)
  assert.equal(scoreWithTrustyCane(16, 10, true), 170)
  assert.equal(scoreWithTrustyCane(20, 10, true), 250)
  assert.equal(scoreWithTrustyCane(50, 10, true), 850)
})

test('disabled Trusty Cane preserves the base score', () => {
  assert.equal(scoreWithTrustyCane(50, 10, false), 500)
})
