// Physical sword. The cursor is the hand/pommel; this module owns the weighted
// blade hanging from that pivot. The tip remains a Verlet point constrained to
// a fixed blade length, so gravity, lag, momentum and follow-through remain
// physical even when the player's hands support a preferred guard angle.

const TAU = Math.PI * 2

function shortestAngleDelta(from, to) {
  let delta = (to - from) % TAU
  if (delta > Math.PI) delta -= TAU
  if (delta < -Math.PI) delta += TAU
  return delta
}

export const SWORD_PHYSICS = Object.freeze({
  BLADE_LENGTH: 158,
  DAMPING: 0.958,
  GRAVITY: 14200,
  CONSTRAINT_ITERATIONS: 5,
  MAX_DT: 1 / 40,

  // --- Held attack cycle ---------------------------------------------------
  // Screen-space angles: -PI/2 points straight up; decreasing angles rotate
  // counter-clockwise. Both held poses are rotated 90 degrees left from their
  // previous orientation while preserving the same wind-up distance.
  READY_ANGLE: -1.08 - Math.PI / 2,
  WINDUP_ANGLE: -2.42 - Math.PI / 2,

  // Master multiplier for how firmly the player's hands hold the target pose.
  // Raise this for a stiffer, more controlled blade; lower it for more sag,
  // sway and overshoot. The phase-specific values retain their relative feel.
  HOLD_STIFFNESS: 1.65,
  READY_SUPPORT: 12,
  WINDUP_SUPPORT: 18,
  RECOVERY_SUPPORT: 8,

  MAX_CHARGE_MS: 460,
  MIN_RELEASE_ANGULAR_SPEED: 8.8,
  MAX_RELEASE_ANGULAR_SPEED: 14.2,
  MIN_FORWARD_ANGULAR_SPEED: 2.5,
  MIN_SWING_MS: 120,
  MAX_SWING_MS: 620,
  RECOVERY_MS: 340,

  // --- Cut tuning ----------------------------------------------------------
  // Whip and damage are based only on physical tip speed, in every attack
  // phase. The click cycle changes how the sword moves; it does not gate damage.
  MIN_TIP_SPEED: 720,
  CUT_MIN_CHORD_FRACTION: 0.76,
  CUT_COOLDOWN_MS: 360,

  // --- Microgame death -----------------------------------------------------
  DEATH_MS: 620,
  DEATH_SEPARATION: 72,
})

export function createSwordState(hand, config = SWORD_PHYSICS) {
  const angle = config.READY_ANGLE
  const tip = {
    x: hand.x + Math.cos(angle) * config.BLADE_LENGTH,
    y: hand.y + Math.sin(angle) * config.BLADE_LENGTH,
  }
  return {
    tip: { ...tip },
    prev: { ...tip },
    angle,
    angularVelocity: 0,
    tipSpeed: 0,
  }
}

// Inject clockwise angular speed into the existing physical blade. Changing the
// Verlet previous point creates tangential velocity without teleporting the tip
// or replacing the subsequent arc with a canned animation.
export function applySwordReleaseImpulse(
  state,
  { angularSpeed, dt = 1 / 60, config = SWORD_PHYSICS },
) {
  const safeDt = Math.min(Math.max(dt, 1 / 240), config.MAX_DT)
  const speed = Math.max(0, angularSpeed)
  const tangentialSpeed = speed * config.BLADE_LENGTH
  const vx = -Math.sin(state.angle) * tangentialSpeed
  const vy = Math.cos(state.angle) * tangentialSpeed

  return {
    ...state,
    prev: {
      x: state.tip.x - vx * safeDt,
      y: state.tip.y - vy * safeDt,
    },
    angularVelocity: speed,
  }
}

export function stepSword(
  state,
  {
    hand,
    dt,
    config = SWORD_PHYSICS,
    targetAngle = null,
    support = 0,
  },
) {
  const step = Math.min(Math.max(dt, 0), config.MAX_DT)

  const vx = (state.tip.x - state.prev.x) * config.DAMPING
  const vy = (state.tip.y - state.prev.y) * config.DAMPING
  const beforeIntegration = { x: state.tip.x, y: state.tip.y }

  let tipX = state.tip.x + vx
  let tipY = state.tip.y + vy + config.GRAVITY * step * step

  // The player's hands support, rather than lock, the blade. Pulling toward a
  // target point on the blade-length circle preserves sway and overshoot while
  // preventing endless free flailing in ready and wind-up states.
  if (Number.isFinite(targetAngle) && support > 0 && step > 0) {
    const currentAngle = Math.atan2(tipY - hand.y, tipX - hand.x)
    const angleError = shortestAngleDelta(currentAngle, targetAngle)
    const supportedAngle = currentAngle + angleError * Math.min(1, support * step)
    const targetX = hand.x + Math.cos(supportedAngle) * config.BLADE_LENGTH
    const targetY = hand.y + Math.sin(supportedAngle) * config.BLADE_LENGTH
    const pull = Math.min(1, support * step * 0.72)
    tipX += (targetX - tipX) * pull
    tipY += (targetY - tipY) * pull
  }

  for (let i = 0; i < config.CONSTRAINT_ITERATIONS; i += 1) {
    const dx = tipX - hand.x
    const dy = tipY - hand.y
    const distance = Math.hypot(dx, dy) || 1e-6
    const difference = (distance - config.BLADE_LENGTH) / distance
    tipX -= dx * difference
    tipY -= dy * difference
  }

  const angle = Math.atan2(tipY - hand.y, tipX - hand.x)
  const tipSpeed = step > 0
    ? Math.hypot(tipX - beforeIntegration.x, tipY - beforeIntegration.y) / step
    : 0
  const angularVelocity = step > 0
    ? shortestAngleDelta(state.angle, angle) / step
    : 0

  return {
    tip: { x: tipX, y: tipY },
    prev: beforeIntegration,
    angle,
    angularVelocity,
    tipSpeed,
  }
}

export function isSwinging(state, config = SWORD_PHYSICS) {
  return state.tipSpeed >= config.MIN_TIP_SPEED
}

export function isSwingingForward(state, config = SWORD_PHYSICS) {
  return isSwinging(state, config)
    && state.angularVelocity >= config.MIN_FORWARD_ANGULAR_SPEED
}
