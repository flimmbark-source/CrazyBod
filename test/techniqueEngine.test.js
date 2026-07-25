import test from 'node:test'
import assert from 'node:assert/strict'

import {
  REHEARSAL_SEQUENCE,
  scoredPromptCount,
  rehearsalSucceeded,
} from '../src/techniques/techniqueEngine.js'

test('rehearsal sequence mixes free-response and scored prompts', () => {
  const scored = scoredPromptCount(REHEARSAL_SEQUENCE.prompts)
  const free = REHEARSAL_SEQUENCE.prompts.length - scored
  assert.equal(free, 1) // one free-response prompt
  assert.equal(scored, 2) // two anticipated-answer prompts
})

test('rehearsal succeeds only when finished with no wrong scored answers', () => {
  assert.equal(rehearsalSucceeded({ finished: true, wrongScoredAnswers: 0 }), true)
  assert.equal(rehearsalSucceeded({ finished: true, wrongScoredAnswers: 1 }), false)
  assert.equal(rehearsalSucceeded({ finished: false, wrongScoredAnswers: 0 }), false) // timeout
})
