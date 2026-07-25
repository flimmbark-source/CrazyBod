// Persistent progression state.
//
// The core is a set of pure functions that transform a plain state object, so
// they can be exercised directly by `node --test` without a DOM. A thin
// localStorage wrapper at the bottom is the only part that touches the browser.

import { BASE_OVERLOAD_LIMIT } from '../config/gameConfig.js'
import {
  STARTING_NODE_ID,
  getNode,
  childrenOf,
} from './skillTreeConfig.js'

export const PROGRESSION_STORAGE_KEY = 'crazybod:progression'
export const TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'
export const PROGRESSION_VERSION = 1

const LEGACY_NODE_IDS = {
  hold: 'autotarget',
}

export function defaultProgression() {
  return {
    version: PROGRESSION_VERSION,
    bank: 0,
    treeUnlocked: false,
    purchasedNodeIds: [],
    revealedNodeIds: [STARTING_NODE_ID],
    enabledNodeIds: [],
    completedRuns: 0,
    highScore: 0,
    lastBankedRunId: null,
  }
}

// Normalise anything read from storage (old versions, partial objects, junk)
// into a complete, well-formed state.
export function migrateProgression(raw) {
  const base = defaultProgression()
  if (!raw || typeof raw !== 'object') return base

  const asArray = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])
  const asNodeIds = (value) => [
    ...new Set(asArray(value).map((id) => LEGACY_NODE_IDS[id] ?? id)),
  ]
  const asNumber = (value, fallback) => (Number.isFinite(value) ? value : fallback)

  const revealed = new Set(asNodeIds(raw.revealedNodeIds))
  revealed.add(STARTING_NODE_ID)

  return {
    version: PROGRESSION_VERSION,
    bank: Math.max(0, asNumber(raw.bank, 0)),
    treeUnlocked: Boolean(raw.treeUnlocked),
    purchasedNodeIds: asNodeIds(raw.purchasedNodeIds).filter(getNode),
    revealedNodeIds: [...revealed].filter(getNode),
    enabledNodeIds: asNodeIds(raw.enabledNodeIds).filter(getNode),
    completedRuns: Math.max(0, Math.floor(asNumber(raw.completedRuns, 0))),
    highScore: Math.max(0, asNumber(raw.highScore, 0)),
    lastBankedRunId: typeof raw.lastBankedRunId === 'string' ? raw.lastBankedRunId : null,
  }
}

// Capacity is derived from enabled nodes. Prerequisites concern ownership, not
// activation, so only the enabled set matters here. `runBonuses` carries
// temporary per-run grants (e.g. a successful rehearsal).
export function computeCapacity(enabledNodeIds, runBonuses = 0) {
  const enabled = new Set(enabledNodeIds)
  let capacity = BASE_OVERLOAD_LIMIT
  for (const nodeId of enabled) {
    const node = getNode(nodeId)
    if (node?.hook === 'capacity') capacity += node.effect?.capacityBonus ?? 0
  }
  return capacity + runBonuses
}

export function isPurchased(state, nodeId) {
  return state.purchasedNodeIds.includes(nodeId)
}

export function isRevealed(state, nodeId) {
  return state.revealedNodeIds.includes(nodeId)
}

export function isEnabled(state, nodeId) {
  return state.enabledNodeIds.includes(nodeId)
}

export function canPurchase(state, nodeId) {
  const node = getNode(nodeId)
  if (!node) return { ok: false, reason: 'unknown' }
  if (!isRevealed(state, nodeId)) return { ok: false, reason: 'hidden' }
  if (isPurchased(state, nodeId)) return { ok: false, reason: 'owned' }
  if (state.bank < node.cost) return { ok: false, reason: 'unaffordable' }
  return { ok: true }
}

// Purchase a node: validate, subtract cost, own it, enable it, reveal its
// children. Returns a new state; returns the same state if the purchase is
// invalid.
export function purchaseNode(state, nodeId) {
  const check = canPurchase(state, nodeId)
  if (!check.ok) return state
  const node = getNode(nodeId)

  const revealed = new Set(state.revealedNodeIds)
  for (const childId of childrenOf(nodeId)) revealed.add(childId)

  return {
    ...state,
    bank: state.bank - node.cost,
    purchasedNodeIds: [...state.purchasedNodeIds, nodeId],
    enabledNodeIds: [...state.enabledNodeIds, nodeId],
    revealedNodeIds: [...revealed],
  }
}

// Toggle a purchased node's activation. Toggling never touches ownership or
// descendants: disabling a parent leaves its purchased children owned and
// independently toggleable.
export function toggleNode(state, nodeId, enabled) {
  if (!isPurchased(state, nodeId)) return state
  const currentlyEnabled = isEnabled(state, nodeId)
  const next = enabled ?? !currentlyEnabled
  if (next === currentlyEnabled) return state
  return {
    ...state,
    enabledNodeIds: next
      ? [...state.enabledNodeIds, nodeId]
      : state.enabledNodeIds.filter((id) => id !== nodeId),
  }
}

// Deposit a finished run's final score. Idempotent: a run whose id already
// matches lastBankedRunId is not deposited again.
export function depositRun(state, { runId, finalScore, unlockTree = true }) {
  if (runId && state.lastBankedRunId === runId) return state
  const score = Math.max(0, Math.floor(finalScore ?? 0))
  return {
    ...state,
    bank: state.bank + score,
    completedRuns: state.completedRuns + 1,
    highScore: Math.max(state.highScore, score),
    treeUnlocked: state.treeUnlocked || unlockTree,
    lastBankedRunId: runId ?? state.lastBankedRunId,
  }
}

// Reset the tree: clear purchases, enabled and revealed (back to the starting
// node) but keep the bank and unlock state. No refunds.
export function resetTree(state) {
  return {
    ...state,
    purchasedNodeIds: [],
    enabledNodeIds: [],
    revealedNodeIds: [STARTING_NODE_ID],
  }
}

// Full reset: back to the original first-run condition, including tutorial
// completion (otherwise it is not truly a full save reset).
export function resetFullState() {
  return defaultProgression()
}

// --- Persistence wrapper (browser only) ---------------------------------

function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage is best-effort; the in-memory state still drives the session.
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function loadProgression() {
  const raw = readStorage(PROGRESSION_STORAGE_KEY)
  if (!raw) return defaultProgression()
  try {
    return migrateProgression(JSON.parse(raw))
  } catch {
    return defaultProgression()
  }
}

export function saveProgression(state) {
  writeStorage(PROGRESSION_STORAGE_KEY, JSON.stringify(state))
}

export function clearTutorialFlag() {
  removeStorage(TUTORIAL_STORAGE_KEY)
}
