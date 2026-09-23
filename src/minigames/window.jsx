import { memo, useCallback, useMemo } from 'react'

import { MicrogameContent } from './core.jsx'
import { useT } from '../i18n/i18n.js'

// The real minigame window, and the geometry that places one on screen. The
// day spawns these; so does the Morning's practice, which is the point -- a
// practice is the same windows the day will throw, not a lookalike.

export function seededFraction(seed, value) {
  let next = (seed ^ Math.imul(value + 1, 0x9e3779b9)) >>> 0
  next ^= next >>> 16
  next = Math.imul(next, 0x7feb352d)
  next ^= next >>> 15
  next = Math.imul(next, 0x846ca68b)
  next ^= next >>> 16
  return (next >>> 0) / 4294967296
}

export function microgameViewportSize() {
  const viewportWidth = Math.max(window.innerWidth || 0, 320)
  const viewportHeight = Math.max(window.innerHeight || 0, 480)
  const compact = viewportWidth <= 820
  const width = compact
    ? Math.min(220, viewportWidth * 0.72)
    : Math.min(252, Math.max(232, viewportWidth * 0.24))
  const height = compact
    ? 178
    : Math.min(202, Math.max(184, viewportHeight * 0.24))

  return { viewportWidth, viewportHeight, width, height, compact }
}

export function positionFor(seed, index, existingGames) {
  const { viewportWidth, viewportHeight, width, height, compact } = microgameViewportSize()
  const minimumLeft = compact ? 2.5 : 3
  const maximumLeft = Math.max(
    minimumLeft,
    ((viewportWidth - width - 10) / viewportWidth) * 100,
  )
  // Keep windows clear of the top bar: the overload meter now lives up there
  // with the phase label under it, and a window landing on either hid the one
  // reading the player most needs.
  const minimumTop = compact ? 22 : 21
  const maximumTop = Math.max(
    minimumTop,
    ((viewportHeight - height - 14) / viewportHeight) * 100,
  )
  const goHomeRect = document.querySelector('.go-home')?.getBoundingClientRect()
  const reserved = goHomeRect && goHomeRect.width > 0 && goHomeRect.height > 0
    ? {
        left: goHomeRect.left - 18,
        right: goHomeRect.right + 18,
        top: goHomeRect.top - 18,
        bottom: goHomeRect.bottom + 18,
      }
    : null
  let fallback = { left: minimumLeft, top: minimumTop }
  let hasSafeFallback = false

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const left = minimumLeft
      + seededFraction(seed, index * 31 + attempt * 2) * (maximumLeft - minimumLeft)
    const top = minimumTop
      + seededFraction(seed, index * 31 + attempt * 2 + 1) * (maximumTop - minimumTop)
    const candidateLeft = (left / 100) * viewportWidth
    const candidateTop = (top / 100) * viewportHeight
    const candidateRight = candidateLeft + width
    const candidateBottom = candidateTop + height
    const clearOfGoHome = !reserved || (
      candidateRight <= reserved.left
      || candidateLeft >= reserved.right
      || candidateBottom <= reserved.top
      || candidateTop >= reserved.bottom
    )

    if (!clearOfGoHome) continue
    const candidate = { left, top }
    if (!hasSafeFallback) {
      fallback = candidate
      hasSafeFallback = true
    }

    const separated = existingGames.every((game) => {
      const previousLeft = Number.parseFloat(game.position.left)
      const previousTop = Number.parseFloat(game.position.top)
      const horizontalDistance = ((left - previousLeft) / 100) * viewportWidth
      const verticalDistance = ((top - previousTop) / 100) * viewportHeight
      return Math.hypot(horizontalDistance, verticalDistance) >= Math.min(width, height) * 0.78
    })

    if (separated) {
      return {
        left: `${left.toFixed(1)}%`,
        top: `${top.toFixed(1)}%`,
      }
    }
  }

  return {
    left: `${fallback.left.toFixed(1)}%`,
    top: `${fallback.top.toFixed(1)}%`,
  }
}

export function edgeOffsetFor(position) {
  const { viewportWidth, viewportHeight, width, height } = microgameViewportSize()
  const left = (Number.parseFloat(position.left) / 100) * viewportWidth
  const top = (Number.parseFloat(position.top) / 100) * viewportHeight
  const centerX = left + width / 2
  const centerY = top + height / 2
  const horizontal = centerX - viewportWidth / 2
  const vertical = centerY - viewportHeight / 2
  const edge = 12

  if (Math.abs(horizontal) >= Math.abs(vertical)) {
    return {
      x: horizontal < 0 ? edge - left : viewportWidth - width - edge - left,
      y: 0,
    }
  }

  return {
    x: 0,
    y: vertical < 0 ? edge - top : viewportHeight - height - edge - top,
  }
}

export const MicrogameWindow = memo(function MicrogameWindow({ game, index, load, tutorialTarget, onResolve, frozen = false }) {
  const t = useT()
  const resolve = useCallback(() => {
    if (!frozen) onResolve(game.id)
  }, [frozen, game.id, onResolve])
  const beatOffset = useMemo(() => edgeOffsetFor(game.position), [game.position])

  return (
    <article
      className={`microgame microgame-${game.kind}${tutorialTarget ? ' tutorial-target' : ''}`}
      data-game-id={game.id}
      data-game-kind={game.kind}
      data-tutorial-role={game.tutorialRole || undefined}
      style={{
        ...game.position,
        '--window-index': index,
        '--load': load,
        '--jitter': `${Math.max(0, load - 3)}px`,
        '--jitter-duration': `${Math.max(0.2, 0.5 - Math.min(load, 4) * 0.06)}s`,
        '--beat-x': `${beatOffset.x}px`,
        '--beat-y': `${beatOffset.y}px`,
      }}
    >
      <div className="microgame-header">
        <span>{t(`microgame.${game.kind}`)}</span>
        <i />
      </div>
      <div className="microgame-body">
        <MicrogameContent kind={game.kind} onResolve={resolve} paused={frozen} />
      </div>
    </article>
  )
})
