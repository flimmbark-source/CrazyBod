// The single authoritative game configuration.
//
// Capacity and score constants were previously duplicated between the main
// game (App.jsx) and the external result script (endScreens.js). That
// duplication must not return: every subsystem imports from here.

export const DAY_LENGTH = 50
export const SCORE_PER_SECOND = 10
export const BASE_OVERLOAD_LIMIT = 5
export const DAY_ELAPSED_EVENT = 'crazybod:day-elapsed'

// The maximum score is a function of the scored day length only. Unscored
// technique time must never let the score exceed this ceiling.
export const MAX_SCORE = DAY_LENGTH * SCORE_PER_SECOND

// The fraction of the raw score that survives an overload.
export const OVERLOAD_SCORE_MULTIPLIER = 0.25

// Day phases. `start`/`end` are measured in dayElapsed seconds (scored time),
// never runElapsed. The pacing director derives its weights/interval/pair
// chance from the matching phase id.
export const PHASES = [
  { id: 'waking', label: 'WAKING UP', start: 0, end: 5 },
  { id: 'gettingReady', label: 'GETTING READY', start: 5, end: 15 },
  { id: 'walking', label: 'WALKING TO THE CAFÉ', start: 15, end: 30 },
  { id: 'ordering', label: 'ORDERING', start: 30, end: 42 },
  { id: 'sitting', label: 'SITTING DOWN', start: 42, end: 50 },
]

export function phaseFor(dayElapsed) {
  return (
    PHASES.find((phase) => dayElapsed >= phase.start && dayElapsed < phase.end)
    ?? PHASES[PHASES.length - 1]
  )
}

export function phaseLabel(dayElapsed) {
  return phaseFor(dayElapsed).label
}

export function scoreForElapsed(dayElapsed) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DAY_ELAPSED_EVENT, { detail: dayElapsed }))
  }
  return Math.min(MAX_SCORE, Math.floor(dayElapsed * SCORE_PER_SECOND))
}
