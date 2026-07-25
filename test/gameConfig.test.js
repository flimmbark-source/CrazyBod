import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DAY_LENGTH,
  MAX_SCORE,
  PHASES,
  phaseFor,
  phaseLabel,
  scoreForElapsed,
} from '../src/config/gameConfig.js'

test('phases cover the full scored day contiguously', () => {
  assert.equal(PHASES[0].start, 0)
  assert.equal(PHASES[PHASES.length - 1].end, DAY_LENGTH)
  for (let i = 1; i < PHASES.length; i += 1) {
    assert.equal(PHASES[i].start, PHASES[i - 1].end)
  }
})

test('phaseFor maps day time to the right phase', () => {
  assert.equal(phaseFor(0).id, 'waking')
  assert.equal(phaseFor(4.9).id, 'waking')
  assert.equal(phaseFor(5).id, 'gettingReady')
  assert.equal(phaseFor(7.35).id, 'gettingReady') // rehearsal trigger
  assert.equal(phaseFor(13.1).id, 'gettingReady') // plan trigger
  assert.equal(phaseFor(29).id, 'walking')
  assert.equal(phaseFor(41).id, 'ordering')
  assert.equal(phaseFor(49).id, 'sitting')
  assert.equal(phaseLabel(0), 'WAKING UP')
})

test('score is clamped to the day ceiling regardless of extra time', () => {
  assert.equal(scoreForElapsed(0), 0)
  assert.equal(scoreForElapsed(25), 250)
  assert.equal(scoreForElapsed(DAY_LENGTH), MAX_SCORE)
  assert.equal(scoreForElapsed(DAY_LENGTH + 20), MAX_SCORE) // unscored technique time cannot exceed max
  assert.equal(MAX_SCORE, 500)
})
