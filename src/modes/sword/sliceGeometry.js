// Pure geometry for slicing a rectangular panel along an arbitrary cut line.
// Used to split a cut enemy into two halves along the sword's actual swing
// angle. No DOM, so it can be unit-tested.
//
// The cut line passes through the rectangle's centre at `angle` (radians, screen
// space). `side` (+1 / -1) selects which half-plane. Returns the polygon of the
// rectangle [0,w] x [0,h] intersected with that half-plane, as an ordered list
// of {x, y} points.

export function cutPolygonPoints(w, h, angle, side) {
  const cx = w / 2
  const cy = h / 2
  // Normal to the cut line; `side` picks the half we keep.
  const nx = -Math.sin(angle) * side
  const ny = Math.cos(angle) * side
  const inside = (p) => (p.x - cx) * nx + (p.y - cy) * ny >= 0

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
      const t = denom !== 0 ? ((cx - a.x) * nx + (cy - a.y) * ny) / denom : 0
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
    }
  }
  return out
}

// The same polygon as a CSS `clip-path: polygon(...)` string in px.
export function cutPolygonCss(w, h, angle, side) {
  const points = cutPolygonPoints(w, h, angle, side)
  if (points.length < 3) return 'polygon(0 0, 0 0, 0 0)'
  return `polygon(${points.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`
}

// The unit normal to the cut line (the direction the two halves fly apart).
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
