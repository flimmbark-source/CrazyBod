// Pure Mandala simulation. No React, no Three.js, no DOM — so the whole travel
// model can be exercised by `node --test`. The hook in useMandalaRun.js drives
// these functions on a frame loop; App owns the overload decision.
//
// Distances are in world units. An encounter is placed at an absolute position
// along the route (`routeZ`); the player's `travelDistance` grows forward. How
// far an encounter still is ahead of the player is therefore:
//     distanceAhead = routeZ - travelDistance
// Dive changes travel speed, which changes how fast that distance closes. It
// never adds encounters — placement is purely a function of distance.

import { MANDALA_CONFIG } from './mandalaConfig.js'

export const MANDALA_PHASES = Object.freeze({
  INACTIVE: 'inactive',
  ENTERING: 'entering',
  TRAVELLING: 'travelling',
  OVERLOADING: 'overloading',
  RETURNING: 'returning',
})

// Lifecycle of a single encounter. Progress is monotonic: an encounter never
// moves backward through these, and `active` latches (an active foe stays
// active and counted until it is resolved, even after it slips behind).
export const ENCOUNTER_STATES = Object.freeze({
  DISTANT: 'distant',
  APPROACHING: 'approaching',
  ARRIVING: 'arriving',
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  PASSED: 'passed',
})

const STATE_ORDER = [
  ENCOUNTER_STATES.DISTANT,
  ENCOUNTER_STATES.APPROACHING,
  ENCOUNTER_STATES.ARRIVING,
  ENCOUNTER_STATES.ACTIVE,
  ENCOUNTER_STATES.RESOLVED,
  ENCOUNTER_STATES.PASSED,
]

function rankOf(state) {
  const rank = STATE_ORDER.indexOf(state)
  return rank < 0 ? 0 : rank
}

// One step of a small deterministic PRNG (mulberry32), threaded as a number so
// the whole simulation stays pure and reproducible.
function stepRng(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0
  let r = Math.imul(t ^ (t >>> 15), t | 1)
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296
  return { value, seed: t }
}

// Classify a distance-ahead into a lifecycle state, moving forward only.
function progressEncounterState(current, distanceAhead, config) {
  // active / resolved / passed are terminal-ish and never regress.
  if (rankOf(current) >= rankOf(ENCOUNTER_STATES.ACTIVE)) return current

  let target
  if (distanceAhead > config.APPROACHING_DISTANCE) target = ENCOUNTER_STATES.DISTANT
  else if (distanceAhead > config.ARRIVING_DISTANCE) target = ENCOUNTER_STATES.APPROACHING
  else if (distanceAhead > config.INTERACTION_DISTANCE) target = ENCOUNTER_STATES.ARRIVING
  else target = ENCOUNTER_STATES.ACTIVE

  return rankOf(target) > rankOf(current) ? target : current
}

// Inject one encounter, flying in ahead of the player. Spawns are driven by the
// director (mandalaDirector.js), not by travel — so who/when/how-many is
// authored, while travel + Dive still govern how fast a spawned foe arrives.
// The lateral offset and a little distance jitter come from the state's PRNG so
// the same seed produces the same run.
export function spawnEncounter(state, { kind, distanceAhead, config = MANDALA_CONFIG }) {
  let rngSeed = state.rngSeed
  const ox = stepRng(rngSeed); rngSeed = ox.seed
  const oy = stepRng(rngSeed); rngSeed = oy.seed
  const oj = stepRng(rngSeed); rngSeed = oj.seed

  const base = distanceAhead ?? config.FIRST_ENCOUNTER_DISTANCE
  const jitter = (oj.value - 0.5) * 8
  const routeZ = state.travelDistance + base + jitter

  const encounter = {
    id: `mandala-encounter-${state.nextId}`,
    kind: 'slash-target',
    routeZ,
    offset: {
      x: (ox.value * 2 - 1) * config.MAX_PATH_OFFSET,
      y: (oy.value * 2 - 1) * config.MAX_PATH_OFFSET,
    },
    state: ENCOUNTER_STATES.DISTANT,
    hitsRemaining: 1,
    sourceMicrogameKind: kind ?? null,
  }

  return {
    ...state,
    encounters: [...state.encounters, encounter],
    rngSeed,
    nextId: state.nextId + 1,
  }
}

export function createMandalaRun(config = MANDALA_CONFIG, seed = 1) {
  return {
    phase: MANDALA_PHASES.ENTERING,
    travelDistance: 0,
    encounters: [],
    rngSeed: seed >>> 0,
    nextId: 0,
    resolvedCount: 0,
    maxDepth: 0,
  }
}

export function toTravelling(state) {
  return { ...state, phase: MANDALA_PHASES.TRAVELLING }
}

export function toOverloading(state) {
  return { ...state, phase: MANDALA_PHASES.OVERLOADING }
}

export function toReturning(state) {
  return { ...state, phase: MANDALA_PHASES.RETURNING }
}

// Resulting travel speed: base at rest, faster only while Dive is held. Diving
// is never persisted — it is derived every frame from capability + live input.
export function travelSpeedFor({ diving, config = MANDALA_CONFIG }) {
  return diving ? config.BASE_TRAVEL_SPEED * config.DIVE_SPEED_MULTIPLIER : config.BASE_TRAVEL_SPEED
}

// Advance the simulation by one step. `travelSpeed` is supplied by the caller
// (already accounting for Dive) so this function stays agnostic about input.
export function advanceMandala(state, { deltaSeconds, travelSpeed, config = MANDALA_CONFIG }) {
  const travelDelta = Math.max(0, travelSpeed) * Math.max(0, deltaSeconds)
  const travelDistance = state.travelDistance + travelDelta

  let encounters = state.encounters.map((encounter) => {
    const distanceAhead = encounter.routeZ - travelDistance
    const nextState = progressEncounterState(encounter.state, distanceAhead, config)
    return nextState === encounter.state ? encounter : { ...encounter, state: nextState }
  })

  // Drop only fully-finished encounters that have slipped well behind. Active
  // (unresolved) encounters are never pruned — they remain part of the load.
  encounters = encounters.filter((encounter) => {
    if (encounter.state !== ENCOUNTER_STATES.RESOLVED && encounter.state !== ENCOUNTER_STATES.PASSED) {
      return true
    }
    return encounter.routeZ - travelDistance > config.SLASH_REAR_LIMIT - 12
  })

  return { ...state, travelDistance, encounters, maxDepth: Math.max(state.maxDepth, travelDistance) }
}

// Resolve an encounter that is currently interactable (active, or arriving for a
// generous early cut). Returns the same state if the id is unknown or already
// resolved — resolving is therefore idempotent per encounter.
export function resolveEncounter(state, id) {
  const index = state.encounters.findIndex((encounter) => encounter.id === id)
  if (index < 0) return state
  const encounter = state.encounters[index]
  const interactable =
    encounter.state === ENCOUNTER_STATES.ACTIVE || encounter.state === ENCOUNTER_STATES.ARRIVING
  if (!interactable) return state

  const hitsRemaining = encounter.hitsRemaining - 1
  const nextEncounter =
    hitsRemaining > 0
      ? { ...encounter, hitsRemaining }
      : { ...encounter, hitsRemaining: 0, state: ENCOUNTER_STATES.RESOLVED }

  const encounters = [...state.encounters]
  encounters[index] = nextEncounter

  return {
    ...state,
    encounters,
    resolvedCount: hitsRemaining > 0 ? state.resolvedCount : state.resolvedCount + 1,
  }
}

// The authoritative load contribution of the Mandala: only active (arrived,
// unresolved) encounters. Distant / approaching / arriving foes never count.
export function activeLoad(state) {
  let count = 0
  for (const encounter of state.encounters) {
    if (encounter.state === ENCOUNTER_STATES.ACTIVE) count += 1
  }
  return count
}

// Encounters currently eligible for slashing: active and still in front of (or
// near) the interaction plane. Used to build the screen-space slash registry.
export function slashableEncounters(state, config = MANDALA_CONFIG) {
  return state.encounters.filter((encounter) => {
    if (encounter.state !== ENCOUNTER_STATES.ACTIVE && encounter.state !== ENCOUNTER_STATES.ARRIVING) {
      return false
    }
    const distanceAhead = encounter.routeZ - state.travelDistance
    return distanceAhead > config.SLASH_REAR_LIMIT
  })
}
