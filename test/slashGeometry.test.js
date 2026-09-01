import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isValidSlash,
  slashSegment,
  segmentIntersectsCircle,
  segmentCircleIntersections,
  pointAlong,
  targetsHitBySlash,
  SLASH_DEFAULTS,
} from '../src/modes/sword/slashGeometry.js'

// A fast, long horizontal gesture sampled ~every 8ms.
function fastGesture(y = 100) {
  return [
    { x: 0, y, t: 0 },
    { x: 60, y, t: 8 },
    { x: 130, y, t: 16 },
    { x: 200, y, t: 24 },
  ]
}

test('fast, long movement is a valid slash', () => {
  assert.equal(isValidSlash(fastGesture()), true)
})

test('slow movement of the same length is not a slash', () => {
  const slow = [
    { x: 0, y: 100, t: 0 },
    { x: 100, y: 100, t: 600 },
    { x: 200, y: 100, t: 1200 },
  ]
  assert.equal(isValidSlash(slow), false)
})

test('a short tap is not a slash', () => {
  const tap = [
    { x: 100, y: 100, t: 0 },
    { x: 104, y: 101, t: 8 },
  ]
  assert.equal(isValidSlash(tap), false)
})

test('a fast gesture that intersects a target hits it', () => {
  const segment = slashSegment(fastGesture(100))
  const targets = [{ id: 'a', x: 120, y: 100, radius: 20, active: true }]
  assert.deepEqual(targetsHitBySlash(segment, targets), ['a'])
})

test('a fast gesture that misses the target does not hit it', () => {
  const segment = slashSegment(fastGesture(100))
  const targets = [{ id: 'a', x: 120, y: 400, radius: 20, active: true }]
  assert.deepEqual(targetsHitBySlash(segment, targets), [])
})

test('inactive targets cannot be hit', () => {
  const segment = slashSegment(fastGesture(100))
  const targets = [{ id: 'a', x: 120, y: 100, radius: 20, active: false }]
  assert.deepEqual(targetsHitBySlash(segment, targets), [])
})

test('one gesture resolves a target at most once', () => {
  const segment = slashSegment(fastGesture(100))
  const targets = [{ id: 'a', x: 120, y: 100, radius: 20, active: true }]
  const resolved = new Set()
  const first = targetsHitBySlash(segment, targets, resolved)
  first.forEach((id) => resolved.add(id))
  const second = targetsHitBySlash(segment, targets, resolved)
  assert.deepEqual(first, ['a'])
  assert.deepEqual(second, [])
})

test('segment/circle intersection is exact at the radius boundary', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 100, y: 0 }
  assert.equal(segmentIntersectsCircle(a, b, { x: 50, y: 10 }, 10), true)
  assert.equal(segmentIntersectsCircle(a, b, { x: 50, y: 11 }, 10), false)
})

test('defaults are sane', () => {
  assert.ok(SLASH_DEFAULTS.MIN_LENGTH > 0)
  assert.ok(SLASH_DEFAULTS.MIN_SPEED > 0)
})

// --- whip traversal (segment vs circle) ---------------------------------

const C = { x: 100, y: 100 }
const R = 20

test('a segment passing clean through a circle has two boundary crossings', () => {
  const ts = segmentCircleIntersections({ x: 0, y: 100 }, { x: 200, y: 100 }, C, R)
  assert.equal(ts.length, 2)
  // entry at x=80, exit at x=120
  assert.ok(Math.abs(pointAlong({ x: 0, y: 100 }, { x: 200, y: 100 }, ts[0]).x - 80) < 1e-6)
  assert.ok(Math.abs(pointAlong({ x: 0, y: 100 }, { x: 200, y: 100 }, ts[1]).x - 120) < 1e-6)
})

test('a segment that starts inside and ends outside has one crossing (an exit)', () => {
  const ts = segmentCircleIntersections({ x: 100, y: 100 }, { x: 300, y: 100 }, C, R)
  assert.equal(ts.length, 1)
  assert.ok(Math.abs(pointAlong({ x: 100, y: 100 }, { x: 300, y: 100 }, ts[0]).x - 120) < 1e-6)
})

test('a segment that misses the circle has no crossings', () => {
  const ts = segmentCircleIntersections({ x: 0, y: 200 }, { x: 200, y: 200 }, C, R)
  assert.equal(ts.length, 0)
})

test('a segment ending short of the circle has no crossings', () => {
  const ts = segmentCircleIntersections({ x: 0, y: 100 }, { x: 50, y: 100 }, C, R)
  assert.equal(ts.length, 0)
})
