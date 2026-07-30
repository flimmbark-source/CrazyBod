// Physical sword. The hand/pommel is itself simulated by swordHandPhysics; this
// module owns the blade hanging from that moving pivot.
//
// Model: a single Verlet point (the blade tip) integrated with damping and
// gravity, then pulled back to a fixed length from the hand each step. The high
// momentum retention creates long follow-through, while explicit cut tuning
// rewards a sustained sweep rather than a twitch-speed flick.

export const SWORD_PHYSICS = Object.freeze({
  BLADE_LENGTH: 158, // long reach makes broad deliberate arcs
  DAMPING: 0.958, // high retained momentum; slow to reverse
  GRAVITY: 1200, // strong downward weight
  CONSTRAINT_ITERATIONS: 5,
  MAX_DT: 1 / 40,

  // --- Committed sweep -----------------------------------------------------
  // A cut still requires a full entry -> exit traversal through the target, but
  // power now comes from sustained directional motion rather than a single very
  // fast frame.
  MIN_TIP_SPEED: 720, // minimum useful movement during the traversal
  MIN_COMMITMENT_MS: 150, // traversal must remain committed for this long
  MIN_COMMITTED_DISTANCE: 84, // total tip travel accumulated while crossing
  MAX_DIRECTION_CHANGE_DEGREES: 38, // too much reversal cancels commitment
  CUT_MIN_CHORD_FRACTION: 0.76,
  CUT_COOLDOWN_MS: 360,
  RECOVERY_MS: 260, // no new cut immediately after a powerful follow-through

  // --- Microgame death -----------------------------------------------------
  DEATH_MS: 620,
  DEATH_SEPARATION: 72,
})

export function createSwordState(hand, config = SWORD_PHYSICS) {
  const tip = { x: hand.x, y: hand.y + config.BLADE_LENGTH }
  return { tip: { ...tip }, prev: { ...tip }, angle: Math.PI / 2, tipSpeed: 0 }
}

export function stepSword(state, { hand, dt, config = SWORD_PHYSICS }) {
  const step = Math.min(Math.max(dt, 0), config.MAX_DT)

  const vx = (state.tip.x - state.prev.x) * config.DAMPING
  const vy = (state.tip.y - state.prev.y) * config.DAMPING
  const beforeIntegration = { x: state.tip.x, y: state.tip.y }

  let tipX = state.tip.x + vx
  let tipY = state.tip.y + vy + config.GRAVITY * step * step

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

export function isSwinging(state, config = SWORD_PHYSICS) {
  return state.tipSpeed >= config.MIN_TIP_SPEED
}
