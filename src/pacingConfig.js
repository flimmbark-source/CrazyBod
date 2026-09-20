export const OPENING_INTERVAL = [2, 3]

// Each owned upgrade adds this many seconds to the active phase's spawn delay,
// applied globally across every phase.
export const SPAWN_DELAY_BONUS_PER_UPGRADE = 0.1

// Each owned upgrade shaves this much off the active phase's pair chance,
// applied globally across every phase.
export const PAIR_CHANCE_PENALTY_PER_UPGRADE = 0.02

export const TUTORIAL_SEQUENCE = [
  { role: 'first', at: 2.5, kind: 'fatigue' },
  { role: 'second', at: 6.5, kind: 'brainFog' },
]

export const PACING_PHASES = [
  {
    id: 'headingOut',
    start: 0,
    end: 4,
    interval: [3.2, 4.2],
    pairChance: 0,
    weights: {
      jointSlip: 3,
      weakGrip: 3,
      balance: 3,
      discomfort: 3,
      fatigue: 2,
      muscleLock: 2,
      lightSensitivity: 2,
      workingMemory: 1,
      checking: 1,
    },
  },
  {
    id: 'walking',
    start: 4,
    end: 29,
    // The walk is the long stretch of the day now, so it opens gently and
    // tightens as it goes (see WALKING_RAMP below) instead of running at one
    // flat rate for twenty-five seconds.
    interval: [3.4, 4.6],
    pairChance: 0.08,
    weights: {
      balance: 4,
      tremor: 3,
      dizziness: 3,
      directionLoss: 3,
      pressurePoint: 2,
      muscleLock: 2,
      weakGrip: 2,
      racingHeart: 2,
      anxiety: 2,
      brainFog: 2,
      discomfort: 1,
      spiral: 1,
      interruptedThought: 1,
    },
  },
  {
    id: 'meeting',
    start: 29,
    end: 36,
    interval: [1.8, 2.8],
    pairChance: 0.18,
    weights: {
      anxiety: 4,
      racingHeart: 3,
      interruptedThought: 3,
      workingMemory: 3,
      brainFog: 2,
      lightSensitivity: 2,
      tremor: 2,
      discomfort: 2,
      taskSwitching: 2,
    },
  },
  {
    id: 'ordering',
    start: 36,
    end: 45,
    interval: [1, 2],
    pairChance: 0.20,
    weights: {
      anxiety: 4,
      taskSwitching: 4,
      workingMemory: 3,
      interruptedThought: 3,
      checking: 3,
      racingHeart: 3,
      brainFog: 3,
      lightSensitivity: 2,
      pinsNeedles: 2,
      afterimage: 2,
      directionLoss: 2,
      packingCheck: 2,
      weakGrip: 1,
    },
  },
  {
    id: 'sitting',
    start: 45,
    end: Number.POSITIVE_INFINITY,
    interval: [1, 2],
    pairChance: 0.30,
    weights: {
      fatigue: 3,
      pressurePoint: 3,
      microRest: 3,
      heavyEyes: 3,
      spiral: 3,
      discomfort: 2,
      afterimage: 2,
      workingMemory: 2,
      checking: 2,
      racingHeart: 2,
      lightSensitivity: 1,
      pinsNeedles: 1,
    },
  },
]

// The walk is long on purpose, and a long stretch at one spawn rate reads as a
// flat plateau that then drops off a cliff at the cafe. Instead the walking
// phase ramps: its spawn interval shortens and its pair chance climbs steadily
// from the start of the walk to its end, so the player can *feel* the pressure
// building and see the overload meter creeping up rather than being surprised
// by it. `progress` is 0 at the start of the phase and 1 at its end.
export const WALKING_RAMP = {
  phaseId: 'walking',
  // Multiplier applied to the phase interval: 1.0 at the start of the walk,
  // 0.42 by the end (so spawns roughly double in frequency across the walk).
  intervalScaleStart: 1,
  intervalScaleEnd: 0.42,
  pairChanceEnd: 0.24,
}

// How far through a ramped phase `dayElapsed` is, 0..1. Phases without a ramp
// return null so the director can skip the adjustment entirely.
export function rampProgressFor(phaseId, dayElapsed) {
  if (phaseId !== WALKING_RAMP.phaseId) return null
  const phase = PACING_PHASES_BY_ID[phaseId]
  if (!phase || !Number.isFinite(dayElapsed)) return null
  const span = phase.end - phase.start
  if (!(span > 0)) return null
  return Math.max(0, Math.min(1, (dayElapsed - phase.start) / span))
}

export function pacingPhaseFor(elapsed) {
  return PACING_PHASES.find((phase) => elapsed >= phase.start && elapsed < phase.end)
    ?? PACING_PHASES[PACING_PHASES.length - 1]
}

const PACING_PHASES_BY_ID = Object.fromEntries(
  PACING_PHASES.map((phase) => [phase.id, phase]),
)

export function pacingPhaseById(phaseId) {
  return PACING_PHASES_BY_ID[phaseId] ?? PACING_PHASES[PACING_PHASES.length - 1]
}
