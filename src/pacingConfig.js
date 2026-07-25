export const OPENING_INTERVAL = [2, 3]

export const TUTORIAL_SEQUENCE = [
  { role: 'first', at: 2.5, kind: 'fatigue' },
  { role: 'second', at: 8.5, kind: 'brainFog' },
]

export const PACING_PHASES = [
  {
    id: 'waking',
    start: 0,
    end: 5,
    interval: [3, 4],
    pairChance: 0,
    weights: {
      fatigue: 4,
      heavyEyes: 4,
      microRest: 3,
      jointSlip: 2,
      weakGrip: 2,
      balance: 2,
      discomfort: 2,
      workingMemory: 1,
      lightSensitivity: 1,
      afterimage: 1,
    },
  },
  {
    id: 'gettingReady',
    start: 5,
    end: 15,
    interval: [5, 6],
    pairChance: 0.00,
    weights: {
      packingCheck: 4,
      checking: 3,
      taskSwitching: 2,
      jointSlip: 2,
      muscleLock: 2,
      pinsNeedles: 2,
      workingMemory: 2,
      fatigue: 2,
      discomfort: 2,
      brainFog: 2,
      lightSensitivity: 1,
      interruptedThought: 1,
    },
  },
  {
    id: 'walking',
    start: 15,
    end: 30,
    interval: [2, 3],
    pairChance: 0.00,
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
    },
  },
  {
    id: 'ordering',
    start: 30,
    end: 42,
    interval: [2, 3],
    pairChance: 0.10,
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
    start: 42,
    end: Number.POSITIVE_INFINITY,
    interval: [2, 3],
    pairChance: 0.15,
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
