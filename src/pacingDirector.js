import { OPENING_INTERVAL, pacingPhaseFor } from './pacingConfig.js'

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

function adjustedDelay(director, phase, activeGames, overloadLimit) {
  let delay = randomBetween(director.random, phase.interval)
  const [targetMinimum, targetMaximum] = phase.targetLoad

  if (activeGames < targetMinimum) delay *= 0.85
  if (activeGames > targetMaximum) delay *= 1.35
  if (activeGames >= overloadLimit - 1) delay *= 1.15

  return delay
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

export function initializePacingDirector(director, elapsed = 0) {
  director.nextSpawnAt = elapsed + randomBetween(director.random, OPENING_INTERVAL)
}

export function takeSpawnBatch(director, { elapsed, activeGames, overloadLimit }) {
  const phase = pacingPhaseFor(elapsed)
  const [, targetMaximum] = phase.targetLoad
  const pairAllowed = (
    activeGames < targetMaximum
    && activeGames <= overloadLimit - 3
    && director.random() < phase.pairChance
  )

  const firstKind = drawKind(director, phase)
  const kinds = [firstKind]
  if (pairAllowed) kinds.push(drawKind(director, phase, [firstKind]))

  const projectedLoad = activeGames + kinds.length
  director.nextSpawnAt = elapsed + adjustedDelay(
    director,
    phase,
    projectedLoad,
    overloadLimit,
  )

  return {
    kinds,
    phase: phase.id,
    nextSpawnAt: director.nextSpawnAt,
  }
}
