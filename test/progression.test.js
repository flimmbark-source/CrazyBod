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
  PROGRESSION_VERSION,
} from '../src/progression/progressionStore.js'
import { BASE_OVERLOAD_LIMIT } from '../src/config/gameConfig.js'
import { STARTING_NODE_ID, getNode, prerequisitesOf } from '../src/progression/skillTreeConfig.js'

const COST = {
  swordCursor: getNode('swordCursor').cost,
  mandalaDive: getNode('mandalaDive').cost,
  thisIsNormal: getNode('thisIsNormal').cost,
  rehearse: getNode('rehearse').cost,
  autotarget: getNode('autotarget').cost,
  plan: getNode('plan').cost,
  adrenaline: getNode('adrenaline').cost,
  suppress: getNode('suppress').cost,
}

// The Mandala re-centres the tree on the Sword; it is the revealed-by-default
// root now, and the rest of the tree grows from it.
test('the Sword is the starting node and the tree centre', () => {
  assert.equal(STARTING_NODE_ID, 'swordCursor')
  assert.deepEqual(defaultProgression().revealedNodeIds, ['swordCursor'])
})

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
  assert.equal(state.version, PROGRESSION_VERSION)
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

test('migrate reveals children of already-owned nodes (new nodes appear on old saves)', () => {
  // A v1 save from before the stretch ritual existed: rehearse is owned, but its
  // revealed list predates the new child.
  const state = migrateProgression({
    version: 1,
    purchasedNodeIds: ['thisIsNormal', 'rehearse'],
    revealedNodeIds: ['thisIsNormal', 'rehearse', 'autotarget', 'plan'],
    enabledNodeIds: ['thisIsNormal', 'rehearse'],
  })
  assert.ok(state.revealedNodeIds.includes('stretch'))
})

test('migration keeps old bank, runs and purchases, and only reveals the Sword (never grants it)', () => {
  const state = migrateProgression({
    version: 1,
    bank: 640,
    completedRuns: 5,
    highScore: 900,
    lastBankedRunId: 'run-9',
    purchasedNodeIds: ['thisIsNormal', 'autotarget'],
    revealedNodeIds: ['thisIsNormal', 'autotarget'],
    enabledNodeIds: ['thisIsNormal', 'autotarget'],
  })
  // Preserved.
  assert.equal(state.bank, 640)
  assert.equal(state.completedRuns, 5)
  assert.equal(state.highScore, 900)
  assert.equal(state.lastBankedRunId, 'run-9')
  assert.deepEqual(state.purchasedNodeIds, ['thisIsNormal', 'autotarget'])
  assert.deepEqual(state.enabledNodeIds, ['thisIsNormal', 'autotarget'])
  // The Sword is revealed (buyable) but NOT owned or enabled: old saves must buy it.
  assert.ok(state.revealedNodeIds.includes('swordCursor'))
  assert.equal(isPurchased(state, 'swordCursor'), false)
  assert.equal(isEnabled(state, 'swordCursor'), false)
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

test('Sword and Dive do not change capacity', () => {
  assert.equal(computeCapacity(['swordCursor']), 5)
  assert.equal(computeCapacity(['swordCursor', 'mandalaDive']), 5)
  assert.equal(computeCapacity(['swordCursor', 'mandalaDive', 'thisIsNormal']), 6)
})

test('purchase requires reveal, prerequisites, affordability, and not-already-owned', () => {
  let state = defaultProgression()
  // Hidden until the Sword is bought.
  assert.equal(canPurchase(state, 'thisIsNormal').ok, false)
  assert.equal(canPurchase(state, 'thisIsNormal').reason, 'hidden')
  // The Sword itself is revealed but unaffordable at bank 0.
  assert.equal(canPurchase(state, 'swordCursor').ok, false)
  assert.equal(canPurchase(state, 'swordCursor').reason, 'unaffordable')
  state = { ...state, bank: 100 }
  assert.equal(canPurchase(state, 'swordCursor').ok, true)
})

test('purchase subtracts exact cost, auto-enables, reveals children', () => {
  let state = { ...defaultProgression(), bank: 2000 }
  state = purchaseNode(state, 'swordCursor')
  assert.ok(isPurchased(state, 'swordCursor'))
  assert.ok(isEnabled(state, 'swordCursor'))
  assert.ok(isRevealed(state, 'thisIsNormal')) // child revealed
  assert.ok(isRevealed(state, 'mandalaDive')) // child revealed
  state = purchaseNode(state, 'thisIsNormal')
  assert.equal(state.bank, 2000 - COST.swordCursor - COST.thisIsNormal)
  assert.ok(isPurchased(state, 'thisIsNormal'))
  assert.ok(isEnabled(state, 'thisIsNormal'))
  assert.ok(isRevealed(state, 'rehearse'))
  assert.ok(isRevealed(state, 'autotarget'))
  assert.equal(isRevealed(state, 'plan'), false) // grandchild not yet revealed
})

test('Dive is revealed by purchasing the Sword (configured prerequisite, not a descent event)', () => {
  let state = { ...defaultProgression(), bank: 2000 }
  assert.equal(isRevealed(state, 'mandalaDive'), false)
  // Cannot buy Dive before the Sword even if revealed by hand.
  assert.equal(canPurchase({ ...state, revealedNodeIds: [...state.revealedNodeIds, 'mandalaDive'] }, 'mandalaDive').reason, 'locked')
  state = purchaseNode(state, 'swordCursor')
  assert.ok(isRevealed(state, 'mandalaDive'))
  assert.equal(canPurchase(state, 'mandalaDive').ok, true)
})

test('Sword and Dive ownership and enable state persist through a save round-trip', () => {
  let state = { ...defaultProgression(), bank: 2000 }
  state = purchaseNode(state, 'swordCursor')
  state = purchaseNode(state, 'mandalaDive')
  const reloaded = migrateProgression(JSON.parse(JSON.stringify(state)))
  assert.ok(isPurchased(reloaded, 'swordCursor'))
  assert.ok(isEnabled(reloaded, 'swordCursor'))
  assert.ok(isPurchased(reloaded, 'mandalaDive'))
  assert.ok(isEnabled(reloaded, 'mandalaDive'))
})

test('Sword and Dive can be disabled without losing ownership', () => {
  let state = { ...defaultProgression(), bank: 2000 }
  state = purchaseNode(state, 'swordCursor')
  state = purchaseNode(state, 'mandalaDive')
  state = toggleNode(state, 'mandalaDive', false)
  assert.equal(isEnabled(state, 'mandalaDive'), false)
  assert.ok(isPurchased(state, 'mandalaDive')) // still owned
  assert.ok(isEnabled(state, 'swordCursor'))
})

test('undiscovered nodes stay absent from a fresh save', () => {
  const state = defaultProgression()
  assert.equal(isRevealed(state, 'mandalaDive'), false)
  assert.equal(isRevealed(state, 'thisIsNormal'), false)
})

test('buying the rehearsal reveals the stretch ritual beside the plan', () => {
  let state = { ...defaultProgression(), bank: 2000 }
  state = purchaseNode(state, 'swordCursor')
  state = purchaseNode(state, 'thisIsNormal')
  assert.equal(isRevealed(state, 'stretch'), false) // hidden until rehearse
  state = purchaseNode(state, 'rehearse')
  assert.ok(isRevealed(state, 'stretch'))
  assert.deepEqual(prerequisitesOf(getNode('stretch')), ['rehearse'])
})

test('purchase is rejected when invalid (no state change)', () => {
  const state = { ...defaultProgression(), bank: 10 }
  const after = purchaseNode(state, 'swordCursor') // 10 < 50
  assert.equal(after, state)
})

test('toggle does not alter ownership or descendants', () => {
  let state = { ...defaultProgression(), bank: 2000 }
  state = purchaseNode(state, 'swordCursor')
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
  let state = { ...defaultProgression(), bank: 2000 }
  state = purchaseNode(state, 'swordCursor')
  state = purchaseNode(state, 'thisIsNormal')
  const bankAfterSpend = state.bank
  state = resetTree(state)
  assert.deepEqual(state.purchasedNodeIds, [])
  assert.deepEqual(state.enabledNodeIds, [])
  assert.deepEqual(state.revealedNodeIds, [STARTING_NODE_ID])
  assert.equal(state.bank, bankAfterSpend) // no refund
})

test('full reset returns to first-run state', () => {
  assert.deepEqual(resetFullState(), defaultProgression())
})
