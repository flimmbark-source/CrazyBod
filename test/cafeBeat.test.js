import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CAFE_BEAT_PHASES,
  CAFE_BEAT_START_AT,
  CAFE_BEAT_TIMINGS,
  CAFE_DIALOGUE,
  advanceCafeConversation,
  isCafeBeatFrozen,
} from '../src/narrative/cafeBeat.js'
import { DAY_LENGTH } from '../src/config/gameConfig.js'

test('the café conversation always contains three compromised options', () => {
  assert.equal(CAFE_DIALOGUE.length, 3)
  for (const exchange of CAFE_DIALOGUE) {
    assert.equal(exchange.speaker, 'Mara')
    assert.equal(exchange.options.length, 3)
  }
})

test('every answer follows the same fixed conversation sequence', () => {
  assert.deepEqual(advanceCafeConversation(0), {
    phase: CAFE_BEAT_PHASES.INTERLUDE,
    dialogueIndex: 1,
  })
  assert.deepEqual(advanceCafeConversation(1), {
    phase: CAFE_BEAT_PHASES.INTERLUDE,
    dialogueIndex: 2,
  })
  assert.deepEqual(advanceCafeConversation(2), {
    phase: CAFE_BEAT_PHASES.RUPTURE,
    dialogueIndex: 2,
  })
})

test('the café conversation begins exactly as the day timer runs out', () => {
  // The finale is tied to the day length so the on-screen countdown reaches
  // zero as Mara speaks, instead of freezing partway through the conversation.
  assert.equal(CAFE_BEAT_START_AT, DAY_LENGTH)
})

test('dialogue interludes give each exchange five seconds of space', () => {
  assert.equal(CAFE_BEAT_TIMINGS.interludeMs, 5000)
})

test('the celebration appears before results', () => {
  assert.equal(CAFE_BEAT_TIMINGS.celebrationMs, 1800)
})

test('microgames freeze only after the rupture begins', () => {
  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.INACTIVE), false)
  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.CONVERSATION), false)
  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.INTERLUDE), false)
  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.RUPTURE), true)
  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.DEPARTURE), true)
  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.AFTERMATH), true)
  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.CELEBRATION), true)
})
