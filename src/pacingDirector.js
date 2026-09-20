import {
  OPENING_INTERVAL,
  PAIR_CHANCE_PENALTY_PER_UPGRADE,
  SPAWN_DELAY_BONUS_PER_UPGRADE,
  WALKING_RAMP,
  pacingPhaseById,
  rampProgressFor,
} from './pacingConfig.js'

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

// Draw `count` kinds immediately from a phase's pool, without touching the
// spawn schedule. Used by techniques that force extra spawns (e.g. a failed
// rehearsal spawning two Getting Ready minigames).
export function drawSpawnKinds(director, { phaseId, count }) {
  const phase = pacingPhaseById(phaseId)
  const kinds = []
  for (let i = 0; i < count; i += 1) {
    kinds.push(drawKind(director, phase, kinds))
  }
  return kinds
}

export function initializePacingDirector(director, spawnElapsed = 0) {
  director.nextSpawnAt = spawnElapsed + randomBetween(director.random, OPENING_INTERVAL)
}

function lerp(from, to, amount) {
  return from + (to - from) * amount
}

// A ramped phase (today: the long walk) tightens as it runs. `ramp` is 0..1
// through the phase, or null when the phase does not ramp.
function intervalFor(phase, ramp) {
  if (ramp === null) return phase.interval
  const scale = lerp(WALKING_RAMP.intervalScaleStart, WALKING_RAMP.intervalScaleEnd, ramp)
  return [phase.interval[0] * scale, phase.interval[1] * scale]
}

function basePairChanceFor(phase, ramp) {
  if (ramp === null) return phase.pairChance
  return lerp(phase.pairChance, WALKING_RAMP.pairChanceEnd, ramp)
}

function nextDelay(director, phase, purchasedUpgrades, ramp) {
  return randomBetween(director.random, intervalFor(phase, ramp))
    + purchasedUpgrades * SPAWN_DELAY_BONUS_PER_UPGRADE
}

// `spawnElapsed` is the spawn clock (advances only while spawning is enabled);
// `phaseId` is the day phase (derived from dayElapsed) and selects the weights,
// interval and pair chance. Keeping the two inputs separate is what lets
// unscored technique time change pacing without changing the day.
export function takeSpawnBatch(director, {
  spawnElapsed,
  phaseId,
  purchasedUpgrades = 0,
  dayElapsed = null,
}) {
  const phase = pacingPhaseById(phaseId)
  const ramp = dayElapsed === null ? null : rampProgressFor(phase.id, dayElapsed)

  const firstKind = drawKind(director, phase)
  const kinds = [{ kind: firstKind, slot: 'first' }]

  // Every owned upgrade globally reduces the chance of a paired spawn.
  const pairChance = Math.max(
    0,
    basePairChanceFor(phase, ramp) - purchasedUpgrades * PAIR_CHANCE_PENALTY_PER_UPGRADE,
  )
  const pairSpawned = director.random() < pairChance

  if (pairSpawned) {
    kinds.push({ kind: drawKind(director, phase, [firstKind]), slot: 'pair' })
  }

  director.nextSpawnAt = spawnElapsed + nextDelay(director, phase, purchasedUpgrades, ramp)

  return {
    kinds,
    phase: phase.id,
    paired: pairSpawned,
    nextSpawnAt: director.nextSpawnAt,
  }
}
