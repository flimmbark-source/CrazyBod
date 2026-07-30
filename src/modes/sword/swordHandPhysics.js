// Physical hand movement for the Mandala sword.
//
// The pointer is only a TARGET. The rendered hand/pivot has its own velocity,
// acceleration and drag, so the player must lead the weapon instead of
// teleporting it around the screen. Kept pure and deterministic for testing.

export const HEAVY_HAND_PHYSICS = Object.freeze({
  ACCELERATION: 5450, // px/s^2 toward the pointer target
  MAX_SPEED: 1760, // px/s hard cap on hand travel
  DRAG: 0.95, // velocity retained each 60 Hz frame
  ARRIVAL_RADIUS: 5, // begin braking this close to the target
  STOP_SPEED: 8, // snap tiny residual velocity to zero
  REVERSAL_RESISTANCE: 0.56, // acceleration retained when reversing direction
  MAX_DT: 1 / 30,
})

export function createHandState(position) {
  return {
    position: { ...position },
    velocity: { x: 0, y: 0 },
  }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y
}

function length(vector) {
  return Math.hypot(vector.x, vector.y)
}

export function stepHand(state, { target, dt, config = HEAVY_HAND_PHYSICS }) {
  const step = Math.min(Math.max(dt, 0), config.MAX_DT)
  const toTarget = {
    x: target.x - state.position.x,
    y: target.y - state.position.y,
  }
  const distance = length(toTarget)
  const direction = distance > 1e-6
    ? { x: toTarget.x / distance, y: toTarget.y / distance }
    : { x: 0, y: 0 }

  let acceleration = config.ACCELERATION
  const velocityLength = length(state.velocity)
  if (velocityLength > 1e-6 && dot(state.velocity, direction) < 0) {
    acceleration *= config.REVERSAL_RESISTANCE
  }

  // Brake progressively inside the arrival radius so the hand has weight but
  // does not orbit forever around a stationary pointer.
  const arrivalScale = Math.min(1, distance / Math.max(1, config.ARRIVAL_RADIUS))
  let vx = state.velocity.x * Math.pow(config.DRAG, step * 60)
  let vy = state.velocity.y * Math.pow(config.DRAG, step * 60)
  vx += direction.x * acceleration * arrivalScale * step
  vy += direction.y * acceleration * arrivalScale * step

  const speed = Math.hypot(vx, vy)
  if (speed > config.MAX_SPEED) {
    const scale = config.MAX_SPEED / speed
    vx *= scale
    vy *= scale
  }

  let x = state.position.x + vx * step
  let y = state.position.y + vy * step

  // Avoid overshooting a very close target on a long frame.
  const travelled = Math.hypot(x - state.position.x, y - state.position.y)
  if (distance > 0 && travelled >= distance && dot({ x: x - state.position.x, y: y - state.position.y }, toTarget) > 0) {
    x = target.x
    y = target.y
    vx = 0
    vy = 0
  } else if (distance < 1 && Math.hypot(vx, vy) < config.STOP_SPEED) {
    x = target.x
    y = target.y
    vx = 0
    vy = 0
  }

  return {
    position: { x, y },
    velocity: { x: vx, y: vy },
  }
}
