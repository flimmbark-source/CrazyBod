import { OPENING_INTERVAL, pacingPhaseById } from './pacingConfig.js'

function mulberry32(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function randomBetween(random, [minimum, maximum]) {
  return minimum + (maximum - minimum) * random()
}

function shuffle(values, random) {
  const next = [...values]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function weightedBag(weights, random) {
  const entries = Object.entries(weights).flatMap(([kind, weight]) => (
    Array.from({ length: Math.max(1, Math.round(weight)) }, () => kind)
  ))
  return shuffle(entries, random)
}

function drawKind(director, phase, excludedKinds = []) {
  let bag = director.bags.get(phase.id)
  if (!bag || bag.length === 0) {
    bag = weightedBag(phase.weights, director.random)
    director.bags.set(phase.id, bag)
  }

  const excluded = new Set(excludedKinds)
  const alternativeIndex = bag.findIndex((kind) => (
    !excluded.has(kind) && kind !== director.lastKind
  ))
  const allowedIndex = bag.findIndex((kind) => !excluded.has(kind))
  const index = alternativeIndex >= 0 ? alternativeIndex : allowedIndex >= 0 ? allowedIndex : 0
  const [kind] = bag.splice(index, 1)
  director.lastKind = kind
  return kind
}

export function createPacingDirector(seed = Date.now()) {
  return {
    seed,
    random: mulberry32(seed),
    nextSpawnAt: null,
    bags: new Map(),
    lastKind: null,
  }
}

export function initializePacingDirector(director, spawnElapsed = 0) {
  director.nextSpawnAt = spawnElapsed + randomBetween(director.random, OPENING_INTERVAL)
}

function nextDelay(director, phase) {
  return randomBetween(director.random, phase.interval)
}

// `spawnElapsed` is the spawn clock (advances only while spawning is enabled);
// `phaseId` is the day phase (derived from dayElapsed) and selects the weights,
// interval and pair chance. Keeping the two inputs separate is what lets
// unscored technique time change pacing without changing the day.
export function takeSpawnBatch(director, { spawnElapsed, phaseId }) {
  const phase = pacingPhaseById(phaseId)

  const firstKind = drawKind(director, phase)
  const kinds = [{ kind: firstKind, slot: 'first' }]

  const pairSpawned = director.random() < phase.pairChance

  if (pairSpawned) {
    kinds.push({ kind: drawKind(director, phase, [firstKind]), slot: 'pair' })
  }

  director.nextSpawnAt = spawnElapsed + nextDelay(director, phase)

  return {
    kinds,
    phase: phase.id,
    paired: pairSpawned,
    nextSpawnAt: director.nextSpawnAt,
  }
}
