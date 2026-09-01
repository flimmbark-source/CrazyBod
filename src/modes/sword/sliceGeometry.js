// Pure geometry for slicing a rectangular panel along an arbitrary cut line.
// Used to split a cut enemy into two halves along the sword's *actual* cut
// path, wherever the blade crossed the panel. No DOM, so it can be unit-tested.

// Clip the rectangle [0,w] x [0,h] by the half-plane on one side of the line
// through points p1 and p2. `side` (+1 / -1) selects the half. Returns the
// clipped polygon as an ordered list of {x, y} points. This is the general
// form: the line need NOT pass through the centre, so the split follows exactly
// where the sword crossed.
export function cutPolygonPointsByLine(w, h, p1, p2, side) {
  // Normal to the cut line; `side` picks the half we keep.
  const nx = -(p2.y - p1.y) * side
  const ny = (p2.x - p1.x) * side
  const inside = (p) => (p.x - p1.x) * nx + (p.y - p1.y) * ny >= 0

  const rect = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]

  // Sutherland–Hodgman clip of the rectangle by the single half-plane.
  const out = []
  for (let i = 0; i < rect.length; i += 1) {
    const a = rect[i]
    const b = rect[(i + 1) % rect.length]
    const aIn = inside(a)
    const bIn = inside(b)
    if (aIn) out.push(a)
    if (aIn !== bIn) {
      const denom = (b.x - a.x) * nx + (b.y - a.y) * ny
      const t = denom !== 0 ? ((p1.x - a.x) * nx + (p1.y - a.y) * ny) / denom : 0
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
    }
  }
  return out
}

export function cutPolygonCssByLine(w, h, p1, p2, side) {
  const points = cutPolygonPointsByLine(w, h, p1, p2, side)
  if (points.length < 3) return 'polygon(0 0, 0 0, 0 0)'
  return `polygon(${points.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`
}

// Unit normal to the line p1->p2 (the direction the two halves fly apart).
export function lineNormal(p1, p2) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const length = Math.hypot(dx, dy) || 1
  return { x: -dy / length, y: dx / length }
}

// Convenience: a centred cut at `angle` (the previous behaviour), expressed via
// the general line form. Kept for callers/tests that only have an angle.
export function cutPolygonPoints(w, h, angle, side) {
  const c = { x: w / 2, y: h / 2 }
  const d = { x: c.x + Math.cos(angle), y: c.y + Math.sin(angle) }
  return cutPolygonPointsByLine(w, h, c, d, side)
}

export function cutPolygonCss(w, h, angle, side) {
  const points = cutPolygonPoints(w, h, angle, side)
  if (points.length < 3) return 'polygon(0 0, 0 0, 0 0)'
  return `polygon(${points.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`
}

// The unit normal to a centred cut at `angle`.
export function cutNormal(angle) {
  return { x: -Math.sin(angle), y: Math.cos(angle) }
}

// Shoelace area of a polygon — handy for tests.
export function polygonArea(points) {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2
}
