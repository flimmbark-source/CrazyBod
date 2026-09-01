// Pure geometry for the Sword's cut test. No DOM here so it can be unit-tested
// directly. SwordCursor feeds it the live blade segment (hand -> physics tip);
// the Mandala registers slashable targets as screen-space circles.

export const SLASH_DEFAULTS = Object.freeze({
  // A gesture must be at least this long (screen px) to be a slash, not a tap.
  MIN_LENGTH: 46,
  // ...and reach at least this peak speed (px per second) somewhere along it.
  MIN_SPEED: 900,
  // Points older than this (ms) are dropped from the active gesture window.
  HISTORY_MS: 140,
})

// Total path length of an ordered list of {x, y} points.
export function pathLength(points) {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

// Peak instantaneous speed (px/s) across a list of {x, y, t} samples (t in ms).
export function peakSpeed(points) {
  let peak = 0
  for (let i = 1; i < points.length; i += 1) {
    const dt = points[i].t - points[i - 1].t
    if (dt <= 0) continue
    const dist = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    peak = Math.max(peak, (dist / dt) * 1000)
  }
  return peak
}

// Is this pointer sample window a valid slash? Requires both enough length and
// enough speed, so slow drags and taps are ignored.
export function isValidSlash(points, options = {}) {
  const { minLength = SLASH_DEFAULTS.MIN_LENGTH, minSpeed = SLASH_DEFAULTS.MIN_SPEED } = options
  if (!points || points.length < 2) return false
  return pathLength(points) >= minLength && peakSpeed(points) >= minSpeed
}

// The straight slash segment approximated from a gesture window: first to last
// sample. Good enough for intersection against target circles.
export function slashSegment(points) {
  if (!points || points.length < 2) return null
  return { a: { x: points[0].x, y: points[0].y }, b: { x: points[points.length - 1].x, y: points[points.length - 1].y } }
}

// Shortest distance from point p to segment ab.
export function pointSegmentDistance(p, a, b) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lengthSq = abx * abx + aby * aby
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq
  t = Math.max(0, Math.min(1, t))
  const cx = a.x + t * abx
  const cy = a.y + t * aby
  return Math.hypot(p.x - cx, p.y - cy)
}

// Does segment ab intersect (or graze) the circle at `center` with `radius`?
export function segmentIntersectsCircle(a, b, center, radius) {
  return pointSegmentDistance(center, a, b) <= radius
}

// A point a fraction t along the segment p0 -> p1.
export function pointAlong(p0, p1, t) {
  return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t }
}

// Parameters t in [0, 1] where the segment p0 -> p1 crosses the circle boundary
// (centre c, radius r), sorted ascending. Empty if it misses; one value if it
// starts or ends inside; two if it passes clean through. Used to find exactly
// where the whip entered and left a game.
export function segmentCircleIntersections(p0, p1, c, r) {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const a = dx * dx + dy * dy
  if (a === 0) return []
  const fx = p0.x - c.x
  const fy = p0.y - c.y
  const b = 2 * (fx * dx + fy * dy)
  const cc = fx * fx + fy * fy - r * r
  const disc = b * b - 4 * a * cc
  if (disc < 0) return []
  const sq = Math.sqrt(disc)
  const t1 = (-b - sq) / (2 * a)
  const t2 = (-b + sq) / (2 * a)
  const out = []
  if (t1 >= 0 && t1 <= 1) out.push(t1)
  if (t2 >= 0 && t2 <= 1 && t2 !== t1) out.push(t2)
  return out
}

// Given a slash segment and a list of active targets ({id, x, y, radius}),
// return the ids the slash cuts. Each target appears at most once. `resolvedIds`
// (a Set) lets the caller guarantee one-resolution-per-target across a gesture.
export function targetsHitBySlash(segment, targets, resolvedIds = new Set()) {
  if (!segment) return []
  const hits = []
  for (const target of targets) {
    if (target.active === false) continue
    if (resolvedIds.has(target.id)) continue
    if (segmentIntersectsCircle(segment.a, segment.b, { x: target.x, y: target.y }, target.radius)) {
      hits.push(target.id)
    }
  }
  return hits
}
