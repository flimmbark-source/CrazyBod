export const OPENING_INTERVAL = [4.5, 6]

export const TUTORIAL_SEQUENCE = [
  { role: 'first', at: 2.5, kind: 'fatigue' },
  { role: 'second', at: 8.5, kind: 'brainFog' },
]

export const PACING_PHASES = [
  {
    id: 'waking',
    start: 0,
    end: 8,
    interval: [6.5, 8],
    pairChance: 0,
    targetLoad: [1, 2],
    weights: {
      fatigue: 6,
      discomfort: 3,
      brainFog: 1,
      anxiety: 1,
    },
  },
  {
    id: 'gettingReady',
    start: 8,
    end: 16,
    interval: [5.5, 7],
    pairChance: 0.05,
    targetLoad: [1, 2],
    weights: {
      fatigue: 4,
      discomfort: 4,
      brainFog: 2,
      anxiety: 1,
    },
  },
  {
    id: 'walking',
    start: 16,
    end: 25,
    interval: [4.5, 6],
    pairChance: 0.08,
    targetLoad: [2, 3],
    weights: {
      fatigue: 2,
      discomfort: 3,
      brainFog: 3,
      anxiety: 2,
    },
  },
  {
    id: 'ordering',
    start: 25,
    end: 42,
    interval: [3.8, 5.2],
    pairChance: 0.14,
    targetLoad: [2, 4],
    weights: {
      fatigue: 2,
      discomfort: 2,
      brainFog: 4,
      anxiety: 5,
    },
  },
  {
    id: 'sitting',
    start: 42,
    end: Number.POSITIVE_INFINITY,
    interval: [3.2, 4.6],
    pairChance: 0.18,
    targetLoad: [3, 5],
    weights: {
      fatigue: 3,
      discomfort: 2,
      brainFog: 4,
      anxiety: 4,
    },
  },
]

export function pacingPhaseFor(elapsed) {
  return PACING_PHASES.find((phase) => elapsed >= phase.start && elapsed < phase.end)
    ?? PACING_PHASES[PACING_PHASES.length - 1]
}
