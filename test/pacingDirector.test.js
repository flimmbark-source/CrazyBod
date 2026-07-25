import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createPacingDirector,
  initializePacingDirector,
  takeSpawnBatch,
} from '../src/pacingDirector.js'

test('takeSpawnBatch keys pacing off phaseId and spawnElapsed', () => {
  const director = createPacingDirector(1234)
  initializePacingDirector(director, 0)
  assert.ok(director.nextSpawnAt > 0)

  const batch = takeSpawnBatch(director, { spawnElapsed: 5, phaseId: 'gettingReady' })
  assert.equal(batch.phase, 'gettingReady')
  assert.ok(Array.isArray(batch.kinds))
  assert.ok(batch.kinds.length >= 1)
  // Each entry is a {kind, slot} object so pair-aware nodes can stagger.
  for (const entry of batch.kinds) {
    assert.equal(typeof entry.kind, 'string')
    assert.ok(entry.slot === 'first' || entry.slot === 'pair')
  }
  // Next spawn is scheduled relative to the spawn clock we passed in.
  assert.ok(director.nextSpawnAt > 5)
})

test('unknown phaseId falls back to the last phase without throwing', () => {
  const director = createPacingDirector(42)
  const batch = takeSpawnBatch(director, { spawnElapsed: 0, phaseId: 'nonsense' })
  assert.equal(batch.phase, 'sitting')
})
