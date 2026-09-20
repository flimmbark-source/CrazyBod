// The single authoritative game configuration.
//
// Capacity and score constants were previously duplicated between the main
// game (App.jsx) and the external result script (endScreens.js). That
// duplication must not return: every subsystem imports from here.

// The scored day now begins at the front door. Everything that used to happen
// on the clock inside the house (waking, washing, getting ready) moved into the
// untimed Morning, so the whole scored day is the journey itself — which is why
// it is longer than the old 50s day even though fewer events happen in it.
export const DAY_LENGTH = 56
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
  { id: 'headingOut', label: 'LEAVING THE HOUSE', start: 0, end: 4 },
  { id: 'walking', label: 'WALKING TO THE CAFÉ', start: 4, end: 29 },
  { id: 'meeting', label: 'MEETING MARA', start: 29, end: 36 },
  { id: 'ordering', label: 'ORDERING', start: 36, end: 45 },
  { id: 'sitting', label: 'SITTING DOWN', start: 45, end: 56 },
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
