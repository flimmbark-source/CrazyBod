import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveProgressionEffects,
  defaultProgressionEffects,
} from '../src/progression/deriveProgressionEffects.js'
import { computeCapacity } from '../src/progression/progressionStore.js'

test('no Sword node means Sword and Mandala effects are disabled', () => {
  const effects = deriveProgressionEffects([])
  assert.deepEqual(effects, defaultProgressionEffects())
  assert.equal(effects.swordEnabled, false)
  assert.equal(effects.mandalaEnabled, false)
  assert.equal(effects.diveEnabled, false)
})

test('enabled Sword enables both the Sword and the Mandala capability', () => {
  const effects = deriveProgressionEffects(['swordCursor'])
  assert.equal(effects.swordEnabled, true)
  assert.equal(effects.mandalaEnabled, true)
  assert.equal(effects.diveEnabled, false)
})

test('enabled Dive enables the Dive capability', () => {
  const effects = deriveProgressionEffects(['swordCursor', 'mandalaDive'])
  assert.equal(effects.diveEnabled, true)
})

test('Dive does not alter capacity', () => {
  assert.equal(computeCapacity(['swordCursor', 'mandalaDive']), computeCapacity([]))
})

test('unrelated existing nodes do not switch on Mandala capabilities', () => {
  const effects = deriveProgressionEffects(['thisIsNormal', 'autotarget', 'adrenaline'])
  assert.equal(effects.swordEnabled, false)
  assert.equal(effects.mandalaEnabled, false)
  assert.equal(effects.diveEnabled, false)
})
