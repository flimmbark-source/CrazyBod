import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cutPolygonPoints,
  cutPolygonCss,
  cutNormal,
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

test('cutPolygonCss emits a valid polygon() with px points', () => {
  const css = cutPolygonCss(W, H, Math.PI / 5, 1)
  assert.match(css, /^polygon\(/)
  assert.match(css, /px/)
  assert.ok((css.match(/px/g) || []).length >= 6) // at least 3 points -> 6 px values
})
