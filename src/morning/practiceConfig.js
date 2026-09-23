// What each practice is, as a shape rather than as content.
//
// Every practice is built from the day's own minigames -- the same components
// the run will throw at the player -- so nothing learned here has to be
// unlearned. What differs between them is the pressure: how many arrive, how
// fast, whether two land at once, and whether letting them pile up can end it.
//
//   count    how many minigames the practice is made of
//   interval seconds between arrivals
//   pairs    two at a time instead of one
//   capacity how many may sit unanswered before the practice is lost;
//            null means it cannot be lost, which is most of them
//   kinds    the pool to draw from, in order; null means the whole catalog,
//            shuffled, which is what the day itself does

export const PRACTICE_SCRIPTS = {
  // One thing at a time, slowly. The first practice a player is likely to open.
  keys: {
    count: 3,
    interval: 5,
    pairs: false,
    capacity: null,
    kinds: ['workingMemory', 'packingCheck', 'checking'],
  },
  // The same gentle shape, but the body's symptoms rather than the mind's.
  clothes: {
    count: 3,
    interval: 4.5,
    pairs: false,
    capacity: null,
    kinds: ['jointSlip', 'weakGrip', 'muscleLock'],
  },
  // And the senses.
  window: {
    count: 3,
    interval: 4.5,
    pairs: false,
    capacity: null,
    kinds: ['lightSensitivity', 'afterimage', 'heavyEyes'],
  },
  // Two at once: the first time the player has to choose what to answer first.
  coffee: {
    count: 4,
    interval: 5.5,
    pairs: true,
    capacity: null,
    kinds: ['fatigue', 'microRest', 'brainFog', 'taskSwitching'],
  },
  // The day, in miniature: random, quick, and losable.
  water: {
    count: 5,
    interval: 3.2,
    pairs: false,
    capacity: 3,
    kinds: null,
  },
}

export function practiceScript(id) {
  return PRACTICE_SCRIPTS[id] ?? null
}
