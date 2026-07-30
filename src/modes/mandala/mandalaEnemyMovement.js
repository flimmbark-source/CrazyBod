// Per-minigame movement for encounters travelling through the Mandala.
//
// Each profile returns a small LOCAL offset from the encounter's normal tube
// path. x/y are fractions of the tube radius; z is world-distance along the
// pipe. Keep the functions pure and deterministic so movement is stable across
// frame rates and easy to preview or test.
//
// Tuning rule of thumb:
//   x/y around 0.1 = subtle drift, 0.4 = pronounced movement
//   z around 1-2 = visible speed variation, 4+ = a strong dash/surge

const TAU = Math.PI * 2

const MOVEMENT = Object.freeze({
  // Repeated checking: advances around four fixed points, then loops.
  checking: { period: 3.2, reach: 0.18, hold: 0.68 },

  // Micro-rest: almost still, with a long soft breathing rise and fall.
  microRest: { period: 5.8, lift: 0.12, sway: 0.055 },

  // Remember the keys: three quick directional steps with a pause between sets.
  workingMemory: { period: 3.4, dash: 0.22, stepSeconds: 0.34 },

  // Racing heart: forward velocity accelerates, peaks, then decelerates in a
  // repeating parabola. zOffset is the integrated-looking visual displacement.
  racingHeart: { period: 0.82, surge: 2.8, sidePulse: 0.055 },

  // Light sensitivity: sharp avoidance zig-zags, as though recoiling from glare.
  lightSensitivity: { period: 2.25, reach: 0.3, snap: 5 },

  // Direction loss: decisive cardinal dashes. Direction changes per cycle.
  directionLoss: { period: 2.4, dash: 0.34, dashFraction: 0.3 },

  // Heavy eyes: gradually sinks, then briefly lifts before sinking again.
  heavyEyes: { period: 4.8, drop: 0.25, drift: 0.07 },

  // Level the horizon: holds a random tilt for a while, drifting in the tilt's
  // direction, then chooses another tilt at a deterministic random interval.
  dizziness: { intervalMin: 0.75, intervalMax: 1.65, drift: 0.28 },

  // Spiral: circles the route while slowly tightening and expanding.
  spiral: { period: 2.7, radius: 0.3, breathe: 0.1 },

  // Afterimage: follows an offset echo of its own motion, creating a delayed
  // double-lobed weave rather than a clean orbit.
  afterimage: { period: 3.1, reach: 0.2, echoDelay: 0.17 },

  // Packing check: hops rapidly between six inventory-like slots.
  packingCheck: { period: 3.3, reach: 0.23, hopSeconds: 0.38 },

  // Tremor: small, fast, irregular vibration without meaningful travel.
  tremor: { frequency: 15, amount: 0.055 },
})

function hash(value) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function random01(seed) {
  let x = seed >>> 0
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  return (x >>> 0) / 4294967296
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function pulse01(phase) {
  return 1 - Math.abs(phase * 2 - 1)
}

function cardinal(index) {
  return [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ][index % 4]
}

function steppedSlot(seed, elapsed, seconds, slots) {
  const step = Math.floor(elapsed / seconds)
  return Math.floor(random01(seed + step * 2654435761) * slots)
}

const ZERO = Object.freeze({ x: 0, y: 0, z: 0, rotation: 0 })

export function movementForEncounter(encounter, elapsedSeconds) {
  const kind = encounter.sourceMicrogameKind
  const tune = MOVEMENT[kind]
  if (!tune) return ZERO

  const seed = hash(encounter.id)
  const phaseOffset = random01(seed) * 10
  const time = Math.max(0, elapsedSeconds + phaseOffset)

  switch (kind) {
    case 'checking': {
      const phase = (time % tune.period) / tune.period
      const corner = Math.floor(phase * 4) % 4
      const next = (corner + 1) % 4
      const local = (phase * 4) % 1
      const blend = local < tune.hold ? 0 : smoothstep((local - tune.hold) / (1 - tune.hold))
      const points = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }]
      return {
        x: (points[corner].x + (points[next].x - points[corner].x) * blend) * tune.reach,
        y: (points[corner].y + (points[next].y - points[corner].y) * blend) * tune.reach,
        z: 0,
        rotation: 0,
      }
    }

    case 'microRest': {
      const phase = (time % tune.period) / tune.period
      return {
        x: Math.sin(phase * TAU) * tune.sway,
        y: -Math.sin(phase * Math.PI) * tune.lift,
        z: Math.sin(phase * TAU) * 0.3,
        rotation: Math.sin(phase * TAU) * 1.5,
      }
    }

    case 'workingMemory': {
      const sequence = [0, 1, 2].map((index) => Math.floor(random01(seed + index * 1013) * 4))
      const step = Math.floor((time % tune.period) / tune.stepSeconds)
      if (step >= sequence.length) return ZERO
      const direction = cardinal(sequence[step])
      const local = ((time % tune.period) % tune.stepSeconds) / tune.stepSeconds
      const amount = Math.sin(local * Math.PI) * tune.dash
      return { x: direction.x * amount, y: direction.y * amount, z: amount * 2, rotation: 0 }
    }

    case 'racingHeart': {
      const phase = (time % tune.period) / tune.period
      // A parabola: slow at both ends, fastest around the centre.
      const surge = 4 * phase * (1 - phase)
      return {
        x: Math.sin(phase * TAU) * tune.sidePulse,
        y: Math.cos(phase * TAU) * tune.sidePulse,
        z: surge * tune.surge,
        rotation: 0,
      }
    }

    case 'lightSensitivity': {
      const phase = (time % tune.period) / tune.period
      const zig = Math.tanh(Math.sin(phase * TAU) * tune.snap)
      return { x: zig * tune.reach, y: Math.sin(phase * TAU * 2) * 0.06, z: 0.4 * Math.abs(zig), rotation: zig * 4 }
    }

    case 'directionLoss': {
      const cycle = Math.floor(time / tune.period)
      const direction = cardinal(Math.floor(random01(seed + cycle * 7919) * 4))
      const phase = (time % tune.period) / tune.period
      const dashPhase = Math.min(1, phase / tune.dashFraction)
      const amount = Math.sin(dashPhase * Math.PI) * tune.dash
      return { x: direction.x * amount, y: direction.y * amount, z: amount * 4, rotation: 0 }
    }

    case 'heavyEyes': {
      const phase = (time % tune.period) / tune.period
      const sink = phase < 0.82 ? smoothstep(phase / 0.82) : 1 - smoothstep((phase - 0.82) / 0.18)
      return { x: Math.sin(phase * TAU) * tune.drift, y: sink * tune.drop, z: -sink * 0.7, rotation: sink * 3 }
    }

    case 'dizziness': {
      const average = (tune.intervalMin + tune.intervalMax) / 2
      const segment = Math.floor(time / average)
      const tilt = random01(seed + segment * 3571) * 2 - 1
      const strength = 0.45 + random01(seed + segment * 3571 + 1) * 0.55
      const local = (time % average) / average
      const drift = Math.sin(local * Math.PI) * tune.drift * strength
      return { x: tilt * drift, y: Math.abs(tilt) * drift * 0.18, z: 0, rotation: tilt * 12 }
    }

    case 'spiral': {
      const phase = (time % tune.period) / tune.period
      const radius = tune.radius + Math.sin(phase * TAU) * tune.breathe
      return { x: Math.cos(phase * TAU) * radius, y: Math.sin(phase * TAU) * radius, z: Math.sin(phase * TAU * 2) * 0.5, rotation: phase * 18 }
    }

    case 'afterimage': {
      const phase = (time % tune.period) / tune.period
      const echo = ((phase - tune.echoDelay + 1) % 1) * TAU
      const now = phase * TAU
      return {
        x: (Math.sin(now) + Math.sin(echo) * 0.55) * tune.reach,
        y: (Math.cos(now * 2) + Math.cos(echo * 2) * 0.45) * tune.reach * 0.55,
        z: Math.sin(echo) * 0.55,
        rotation: Math.sin(echo) * 5,
      }
    }

    case 'packingCheck': {
      const slots = [
        { x: -1, y: -0.65 }, { x: 0, y: -0.65 }, { x: 1, y: -0.65 },
        { x: -1, y: 0.65 }, { x: 0, y: 0.65 }, { x: 1, y: 0.65 },
      ]
      const index = steppedSlot(seed, time, tune.hopSeconds, slots.length)
      const local = (time % tune.hopSeconds) / tune.hopSeconds
      const hop = Math.sin(local * Math.PI)
      return { x: slots[index].x * tune.reach, y: slots[index].y * tune.reach - hop * 0.07, z: hop * 0.65, rotation: 0 }
    }

    case 'tremor': {
      const a = Math.sin(time * tune.frequency * TAU + seed)
      const b = Math.sin(time * tune.frequency * 1.73 * TAU + seed * 0.01)
      return { x: a * tune.amount, y: b * tune.amount, z: (a + b) * 0.08, rotation: a * 2 }
    }

    default:
      return ZERO
  }
}

export { MOVEMENT as MANDALA_ENEMY_MOVEMENT }
