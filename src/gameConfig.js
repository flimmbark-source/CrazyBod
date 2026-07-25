export const DAY_LENGTH = 50
export const SCORE_PER_SECOND = 10
export const BASE_OVERLOAD_LIMIT = 5

export const PHASES = [
  { id: 'waking', label: 'WAKING UP', start: 0, end: 5 },
  { id: 'gettingReady', label: 'GETTING READY', start: 5, end: 15 },
  { id: 'walking', label: 'WALKING TO THE CAFÉ', start: 15, end: 30 },
  { id: 'ordering', label: 'ORDERING', start: 30, end: 42 },
  { id: 'sitting', label: 'SITTING DOWN', start: 42, end: DAY_LENGTH },
]

export function phaseForElapsed(elapsed) {
  return PHASES.find((phase) => elapsed >= phase.start && elapsed < phase.end)
    ?? PHASES[PHASES.length - 1]
}
