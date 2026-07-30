// Utilities for authored sword paths. The pointer records a sparse polyline;
// execution then advances over it by physical distance, independent of frame rate.

export const SLASH_PATH_CONFIG = Object.freeze({
  MIN_POINT_DISTANCE: 8,
  MIN_PATH_LENGTH: 48,
  EXECUTION_SPEED: 1180, // px/s along the recorded light trail
  AIM_DURATION_MS: 260,
  RECOVERY_DURATION_MS: 300,
})

export function appendPathPoint(points, point, minimumDistance = SLASH_PATH_CONFIG.MIN_POINT_DISTANCE) {
  const last = points[points.length - 1]
  if (!last) return [{ ...point }]
  if (Math.hypot(point.x - last.x, point.y - last.y) < minimumDistance) return points
  return [...points, { ...point }]
}

export function pathLength(points) {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y)
  }
  return total
}

export function buildPathMetrics(points) {
  const cumulative = [0]
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(
      cumulative[index - 1]
      + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y),
    )
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] ?? 0 }
}

export function pointAtDistance(metrics, distance) {
  const { points, cumulative, length } = metrics
  if (!points.length) return { point: { x: 0, y: 0 }, index: 0 }
  if (points.length === 1 || distance <= 0) return { point: { ...points[0] }, index: 0 }
  if (distance >= length) return { point: { ...points[points.length - 1] }, index: points.length - 1 }

  let index = 1
  while (index < cumulative.length && cumulative[index] < distance) index += 1
  const start = points[index - 1]
  const end = points[index]
  const span = cumulative[index] - cumulative[index - 1] || 1
  const t = (distance - cumulative[index - 1]) / span
  return {
    point: {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    },
    index,
  }
}

export function remainingPathPoints(metrics, distance) {
  if (!metrics.points.length) return []
  const sample = pointAtDistance(metrics, distance)
  return [sample.point, ...metrics.points.slice(Math.max(1, sample.index))]
}
