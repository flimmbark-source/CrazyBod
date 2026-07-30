// Physical sword. The hand (pommel) is the cursor; the blade is a weighted
// pendulum anchored at the hand. Moving the hand drags the blade, which lags,
// whips past, overshoots and settles — real angular momentum, not a rigid icon
// pinned to the pointer. Pure and deterministic so it can be unit-tested.
//
// Model: a single Verlet point (the blade tip) integrated with damping and a
// little gravity (the blade's weight), then pulled back to a fixed length from
// the hand each step. Because the hand is infinitely heavy (it *is* the
// cursor), only the tip moves — a pendulum on a moving pivot.

// Tuned as a long, tip-heavy katana: a long blade with lots of follow-through
// (high damping) and real weight (gravity), so the swing is ponderous — the tip
// carries momentum and takes its time to change direction.
export const SWORD_PHYSICS = Object.freeze({
  BLADE_LENGTH: 132, // px from hand pivot to blade tip (long katana)
  DAMPING: 0.945, // velocity retained per step — high = heavy follow-through
  GRAVITY: 1750, // px/s^2 — the blade's weight; it hangs and swings hard
  CONSTRAINT_ITERATIONS: 4, // stiffness of the rigid-blade length constraint
  MAX_DT: 1 / 40, // clamp so a long frame can't explode the sim

  // --- Whip cut ----------------------------------------------------------
  // A game is cut only when the blade TIP traces across it: it must enter the
  // game's hitbox and exit again (a full traversal), while whipping at least
  // this fast at some point during the pass.
  MIN_TIP_SPEED: 820, // px/s the tip must exceed for the pass to count as a whip
  // ...and the entry->exit trace must span at least this fraction of the
  // target's radius, so a glancing nick at the edge doesn't cut.
  CUT_MIN_CHORD_FRACTION: 0.7,
  // Ignore a fresh cut on the same game within this window (belt-and-braces;
  // a cut game leaves the board anyway).
  CUT_COOLDOWN_MS: 240,

  // --- Microgame death ---------------------------------------------------
  DEATH_MS: 540, // how long the sliced halves take to fly apart and fade
  DEATH_SEPARATION: 58, // px each half travels apart along the cut normal
})

export function createSwordState(hand, config = SWORD_PHYSICS) {
  // Start the blade hanging straight down from the hand.
  const tip = { x: hand.x, y: hand.y + config.BLADE_LENGTH }
  return { tip: { ...tip }, prev: { ...tip }, angle: Math.PI / 2, tipSpeed: 0 }
}

// Advance the blade one step given the current hand (cursor) position.
export function stepSword(state, { hand, dt, config = SWORD_PHYSICS }) {
  const step = Math.min(Math.max(dt, 0), config.MAX_DT)

  // Verlet velocity (implicit position - prevPosition), kept partly each step.
  const vx = (state.tip.x - state.prev.x) * config.DAMPING
  const vy = (state.tip.y - state.prev.y) * config.DAMPING
  const beforeIntegration = { x: state.tip.x, y: state.tip.y }

  let tipX = state.tip.x + vx
  let tipY = state.tip.y + vy + config.GRAVITY * step * step

  // Rigid-length constraint back to the (anchored) hand.
  for (let i = 0; i < config.CONSTRAINT_ITERATIONS; i += 1) {
    const dx = tipX - hand.x
    const dy = tipY - hand.y
    const distance = Math.hypot(dx, dy) || 1e-6
    const difference = (distance - config.BLADE_LENGTH) / distance
    tipX -= dx * difference
    tipY -= dy * difference
  }

  const angle = Math.atan2(tipY - hand.y, tipX - hand.x)
  const tipSpeed = step > 0 ? Math.hypot(tipX - beforeIntegration.x, tipY - beforeIntegration.y) / step : 0

  return {
    tip: { x: tipX, y: tipY },
    prev: beforeIntegration,
    angle,
    tipSpeed,
  }
}

// Is the blade moving fast enough this frame to cut?
export function isSwinging(state, config = SWORD_PHYSICS) {
  return state.tipSpeed >= config.MIN_TIP_SPEED
}
