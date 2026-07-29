import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SWORD_PHYSICS,
  createSwordState,
  stepSword,
  isSwinging,
} from '../src/modes/sword/swordPhysics.js'

const L = SWORD_PHYSICS.BLADE_LENGTH

function lengthFromHand(state, hand) {
  return Math.hypot(state.tip.x - hand.x, state.tip.y - hand.y)
}

test('the blade starts one blade-length from the hand', () => {
  const hand = { x: 100, y: 100 }
  const state = createSwordState(hand)
  assert.ok(Math.abs(lengthFromHand(state, hand) - L) < 0.5)
})

test('the rigid-length constraint holds after stepping', () => {
  const hand = { x: 200, y: 200 }
  let state = createSwordState(hand)
  for (let i = 0; i < 30; i += 1) state = stepSword(state, { hand, dt: 1 / 60 })
  assert.ok(Math.abs(lengthFromHand(state, hand) - L) < 1.5)
})

test('the blade lags the hand: a sudden hand jump does not teleport the tip', () => {
  const start = { x: 300, y: 300 }
  let state = createSwordState(start)
  // settle a moment
  for (let i = 0; i < 20; i += 1) state = stepSword(state, { hand: start, dt: 1 / 60 })
  const tipBefore = { ...state.tip }
  // jump the hand far to the right in one step
  const moved = { x: 460, y: 300 }
  state = stepSword(state, { hand: moved, dt: 1 / 60 })
  // the tip moves, but far less than the 160px the hand jumped (it trails)
  const tipTravel = Math.hypot(state.tip.x - tipBefore.x, state.tip.y - tipBefore.y)
  assert.ok(tipTravel < 160, `tip travelled ${tipTravel}, should trail the hand`)
  assert.ok(tipTravel > 0.5, 'tip should still be dragged along somewhat')
  // and it stays attached at blade length
  assert.ok(Math.abs(lengthFromHand(state, moved) - L) < 2)
})

test('a fast hand sweep drives a high tip speed; a still hand does not', () => {
  let fast = createSwordState({ x: 0, y: 200 })
  let x = 0
  let fastPeak = 0
  for (let i = 0; i < 12; i += 1) {
    x += 40 // 40px/frame ~ 2400px/s
    fast = stepSword(fast, { hand: { x, y: 200 }, dt: 1 / 60 })
    fastPeak = Math.max(fastPeak, fast.tipSpeed)
  }
  assert.ok(isSwinging(fast) || fastPeak >= SWORD_PHYSICS.MIN_TIP_SPEED, `fast peak ${fastPeak}`)

  let still = createSwordState({ x: 500, y: 200 })
  for (let i = 0; i < 40; i += 1) still = stepSword(still, { hand: { x: 500, y: 200 }, dt: 1 / 60 })
  assert.equal(isSwinging(still), false)
})

test('with gravity the blade settles hanging below a still hand', () => {
  const hand = { x: 400, y: 100 }
  let state = createSwordState({ x: 400, y: 40 }) // start it raised
  for (let i = 0; i < 240; i += 1) state = stepSword(state, { hand, dt: 1 / 60 })
  // tip ends up below the hand (positive y offset) and nearly still
  assert.ok(state.tip.y > hand.y + L * 0.6, 'blade should hang below the hand')
  assert.ok(state.tipSpeed < 40, `blade should be nearly at rest, was ${state.tipSpeed}`)
  // angle points roughly downward (~ +PI/2)
  assert.ok(Math.abs(state.angle - Math.PI / 2) < 0.35)
})

test('damping bleeds energy: an initial swing decays over time', () => {
  const hand = { x: 300, y: 300 }
  // give it a sideways shove by starting the tip off-axis
  let state = { tip: { x: 300 + L, y: 300 }, prev: { x: 300 + L, y: 280 }, angle: 0, tipSpeed: 0 }
  let early = 0
  let late = 0
  for (let i = 0; i < 200; i += 1) {
    state = stepSword(state, { hand, dt: 1 / 60 })
    if (i < 20) early = Math.max(early, state.tipSpeed)
    if (i > 160) late = Math.max(late, state.tipSpeed)
  }
  assert.ok(late < early, `swing should decay: early ${early} -> late ${late}`)
})
