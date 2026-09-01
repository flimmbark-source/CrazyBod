import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cutPolygonPoints,
  cutPolygonPointsByLine,
  cutPolygonCss,
  cutNormal,
  lineNormal,
  polygonArea,
} from '../src/modes/sword/sliceGeometry.js'

const W = 200
const H = 120

test('a cut through the centre splits the panel into two equal halves', () => {
  for (const angle of [0, Math.PI / 4, Math.PI / 3, 1.1]) {
    const top = polygonArea(cutPolygonPoints(W, H, angle, 1))
    const bottom = polygonArea(cutPolygonPoints(W, H, angle, -1))
    assert.ok(Math.abs(top - bottom) < 1e-6, `halves unequal at angle ${angle}`)
    assert.ok(Math.abs(top + bottom - W * H) < 1e-6, 'halves should tile the panel')
  }
})

test('a horizontal cut yields top and bottom rectangles', () => {
  const plus = cutPolygonPoints(W, H, 0, 1)
  const minus = cutPolygonPoints(W, H, 0, -1)
  // Each half is the full width and half the height.
  assert.ok(Math.abs(polygonArea(plus) - W * (H / 2)) < 1e-6)
  const ysPlus = plus.map((p) => p.y)
  const ysMinus = minus.map((p) => p.y)
  // One half sits in [0, H/2], the other in [H/2, H].
  const spanPlus = [Math.min(...ysPlus), Math.max(...ysPlus)]
  const spanMinus = [Math.min(...ysMinus), Math.max(...ysMinus)]
  assert.notDeepEqual(spanPlus, spanMinus)
  assert.ok(spanPlus[0] === 0 || spanMinus[0] === 0)
  assert.ok(spanPlus[1] === H || spanMinus[1] === H)
})

test('the cut normal is perpendicular to the swing direction', () => {
  const angle = 0.7
  const dir = { x: Math.cos(angle), y: Math.sin(angle) }
  const n = cutNormal(angle)
  const dot = dir.x * n.x + dir.y * n.y
  assert.ok(Math.abs(dot) < 1e-9, 'normal should be perpendicular to the cut')
  assert.ok(Math.abs(Math.hypot(n.x, n.y) - 1) < 1e-9, 'normal should be unit length')
})

test('an off-centre cut line yields unequal halves that still tile the panel', () => {
  // A horizontal-ish line well above centre: the two halves are unequal but sum
  // to the whole panel — the split follows the actual line, not the centre.
  const p1 = { x: 0, y: 30 }
  const p2 = { x: W, y: 30 }
  const top = polygonArea(cutPolygonPointsByLine(W, H, p1, p2, 1))
  const bottom = polygonArea(cutPolygonPointsByLine(W, H, p1, p2, -1))
  assert.ok(Math.abs(top + bottom - W * H) < 1e-6, 'halves should tile the panel')
  assert.ok(Math.abs(top - bottom) > 1000, 'off-centre halves should be clearly unequal')
  // The smaller half is the W x 30 strip.
  assert.ok(Math.abs(Math.min(top, bottom) - W * 30) < 1e-6)
})

test('a line through the centre matches the angle-based split', () => {
  const angle = 0.6
  const c = { x: W / 2, y: H / 2 }
  const d = { x: c.x + Math.cos(angle), y: c.y + Math.sin(angle) }
  const byLine = polygonArea(cutPolygonPointsByLine(W, H, c, d, 1))
  const byAngle = polygonArea(cutPolygonPoints(W, H, angle, 1))
  assert.ok(Math.abs(byLine - byAngle) < 1e-6)
})

test('lineNormal is unit length and perpendicular to the line', () => {
  const p1 = { x: 10, y: 5 }
  const p2 = { x: 40, y: 25 }
  const n = lineNormal(p1, p2)
  assert.ok(Math.abs(Math.hypot(n.x, n.y) - 1) < 1e-9)
  const dot = (p2.x - p1.x) * n.x + (p2.y - p1.y) * n.y
  assert.ok(Math.abs(dot) < 1e-9)
})

test('cutPolygonCss emits a valid polygon() with px points', () => {
  const css = cutPolygonCss(W, H, Math.PI / 5, 1)
  assert.match(css, /^polygon\(/)
  assert.match(css, /px/)
  assert.ok((css.match(/px/g) || []).length >= 6) // at least 3 points -> 6 px values
})
