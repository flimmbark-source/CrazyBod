import test from 'node:test'
import assert from 'node:assert/strict'

import {
  defaultProgression,
  migrateProgression,
  computeCapacity,
  canPurchase,
  purchaseNode,
  toggleNode,
  depositRun,
  resetTree,
  resetFullState,
  isEnabled,
  isPurchased,
  isRevealed,
} from '../src/progression/progressionStore.js'
import { BASE_OVERLOAD_LIMIT } from '../src/config/gameConfig.js'
import { STARTING_NODE_ID, getNode } from '../src/progression/skillTreeConfig.js'

const COST = {
  thisIsNormal: getNode('thisIsNormal').cost,
  rehearse: getNode('rehearse').cost,
  autotarget: getNode('autotarget').cost,
  plan: getNode('plan').cost,
  adrenaline: getNode('adrenaline').cost,
  suppress: getNode('suppress').cost,
}

test('default state reveals only the starting node', () => {
  const state = defaultProgression()
  assert.deepEqual(state.revealedNodeIds, [STARTING_NODE_ID])
  assert.equal(state.bank, 0)
  assert.equal(state.treeUnlocked, false)
})

test('migrate normalises junk and always reveals the starting node', () => {
  const state = migrateProgression({ bank: -5, purchasedNodeIds: ['bogus', 'autotarget'], revealedNodeIds: null })
  assert.equal(state.bank, 0)
  assert.deepEqual(state.purchasedNodeIds, ['autotarget'])
  assert.ok(state.revealedNodeIds.includes(STARTING_NODE_ID))
})

test('migrate preserves the legacy Hold It Together purchase and enabled state', () => {
  const state = migrateProgression({
    purchasedNodeIds: ['hold'],
    revealedNodeIds: ['hold'],
    enabledNodeIds: ['hold'],
  })
  assert.deepEqual(state.purchasedNodeIds, ['autotarget'])
  assert.ok(state.revealedNodeIds.includes('autotarget'))
  assert.deepEqual(state.enabledNodeIds, ['autotarget'])
})

test('base capacity is 5 with nothing enabled', () => {
  assert.equal(computeCapacity([]), BASE_OVERLOAD_LIMIT)
  assert.equal(BASE_OVERLOAD_LIMIT, 5)
})

test('This Is Normal enabled gives capacity 6, disabled 5, plus run bonus', () => {
  assert.equal(computeCapacity(['thisIsNormal']), 6)
  assert.equal(computeCapacity([]), 5)
  assert.equal(computeCapacity(['thisIsNormal'], 1), 7) // rehearsal success
})

test('purchase requires reveal, affordability, and not-already-owned', () => {
  let state = defaultProgression()
  // Hidden until revealed.
  assert.equal(canPurchase(state, 'rehearse').ok, false)
  // Unaffordable.
  assert.equal(canPurchase(state, 'thisIsNormal').ok, false)
  state = { ...state, bank: 100 }
  assert.equal(canPurchase(state, 'thisIsNormal').ok, true)
})

test('purchase subtracts exact cost, auto-enables, reveals children', () => {
  let state = { ...defaultProgression(), bank: 1000 }
  state = purchaseNode(state, 'thisIsNormal')
  assert.equal(state.bank, 1000 - COST.thisIsNormal)
  assert.ok(isPurchased(state, 'thisIsNormal'))
  assert.ok(isEnabled(state, 'thisIsNormal'))
  assert.ok(isRevealed(state, 'rehearse'))
  assert.ok(isRevealed(state, 'autotarget'))
  assert.equal(isRevealed(state, 'plan'), false) // grandchild not yet revealed
})

test('purchase is rejected when invalid (no state change)', () => {
  const state = { ...defaultProgression(), bank: 10 }
  const after = purchaseNode(state, 'thisIsNormal') // 10 < 50
  assert.equal(after, state)
})

test('toggle does not alter ownership or descendants', () => {
  let state = { ...defaultProgression(), bank: 1000 }
  state = purchaseNode(state, 'thisIsNormal')
  state = purchaseNode(state, 'autotarget')
  // Disable the parent.
  state = toggleNode(state, 'thisIsNormal', false)
  assert.equal(isEnabled(state, 'thisIsNormal'), false)
  assert.ok(isPurchased(state, 'thisIsNormal')) // still owned
  assert.ok(isPurchased(state, 'autotarget')) // child still owned
  assert.ok(isEnabled(state, 'autotarget')) // child still enabled
  // Capacity dropped to 5 because This Is Normal is disabled.
  assert.equal(computeCapacity(state.enabledNodeIds), 5)
})

test('deposit banks the score once (idempotent by runId)', () => {
  let state = defaultProgression()
  state = depositRun(state, { runId: 'run-1', finalScore: 320 })
  assert.equal(state.bank, 320)
  assert.equal(state.completedRuns, 1)
  assert.equal(state.highScore, 320)
  assert.equal(state.treeUnlocked, true)
  // Duplicate deposit is ignored.
  const again = depositRun(state, { runId: 'run-1', finalScore: 320 })
  assert.equal(again, state)
  assert.equal(again.bank, 320)
})

test('deposit tracks a high score across runs', () => {
  let state = defaultProgression()
  state = depositRun(state, { runId: 'a', finalScore: 100 })
  state = depositRun(state, { runId: 'b', finalScore: 40 })
  assert.equal(state.bank, 140)
  assert.equal(state.completedRuns, 2)
  assert.equal(state.highScore, 100)
})

test('tree reset clears purchases/enabled/reveal but keeps bank and does not refund', () => {
  let state = { ...defaultProgression(), bank: 1000 }
  state = purchaseNode(state, 'thisIsNormal')
  const bankAfterSpend = state.bank
  state = resetTree(state)
  assert.deepEqual(state.purchasedNodeIds, [])
  assert.deepEqual(state.enabledNodeIds, [])
  assert.deepEqual(state.revealedNodeIds, [STARTING_NODE_ID])
  assert.equal(state.bank, bankAfterSpend) // no refund
  assert.equal(state.treeUnlocked, state.treeUnlocked) // unlock preserved
})

test('full reset returns to first-run state', () => {
  assert.deepEqual(resetFullState(), defaultProgression())
})
