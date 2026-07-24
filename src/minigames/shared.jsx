import { useCallback, useEffect, useRef } from 'react'

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function shuffled(values) {
  const next = [...values]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

export function Progress({ value }) {
  return (
    <div className="mini-progress" aria-hidden="true">
      <i style={{ width: `${clamp(value, 0, 100)}%` }} />
    </div>
  )
}

export function useOnceResolve(onResolve) {
  const resolvedRef = useRef(false)
  return useCallback(() => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    onResolve()
  }, [onResolve])
}

export function useAnimationFrame(callback, active = true, framesPerSecond = 30) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!active) return undefined
    let frame = 0
    let previous = performance.now()
    let accumulated = 0
    const frameInterval = 1000 / Math.max(1, framesPerSecond)

    const tick = (now) => {
      const rawDelta = Math.min(now - previous, 80)
      previous = now
      accumulated += rawDelta

      if (accumulated >= frameInterval) {
        const delta = Math.min(accumulated, 80)
        accumulated %= frameInterval
        callbackRef.current(now, delta)
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, framesPerSecond])
}

export function useMicrogameKeys(rootRef, { onKeyDown, onKeyUp, hint }) {
  const downRef = useRef(onKeyDown)
  const upRef = useRef(onKeyUp)
  downRef.current = onKeyDown
  upRef.current = onKeyUp

  useEffect(() => {
    const windowElement = rootRef.current?.closest('.microgame')
    if (!windowElement) return undefined

    const keyDown = (event) => downRef.current?.(event) ?? false
    const keyUp = (event) => upRef.current?.(event) ?? false
    const previousDown = windowElement.__crazyBodKeyDown
    const previousUp = windowElement.__crazyBodKeyUp
    const header = windowElement.querySelector('.microgame-header')
    const previousHint = header?.dataset.keyHint

    windowElement.__crazyBodKeyDown = keyDown
    windowElement.__crazyBodKeyUp = keyUp
    if (header && hint) header.dataset.keyHint = hint

    return () => {
      if (windowElement.__crazyBodKeyDown === keyDown) {
        if (previousDown) windowElement.__crazyBodKeyDown = previousDown
        else delete windowElement.__crazyBodKeyDown
      }
      if (windowElement.__crazyBodKeyUp === keyUp) {
        if (previousUp) windowElement.__crazyBodKeyUp = previousUp
        else delete windowElement.__crazyBodKeyUp
      }
      if (header) {
        if (previousHint) header.dataset.keyHint = previousHint
        else delete header.dataset.keyHint
      }
    }
  }, [rootRef, hint])
}

export function keyDirection(code) {
  if (code === 'ArrowLeft' || code === 'KeyA') return -1
  if (code === 'ArrowRight' || code === 'KeyD') return 1
  return 0
}
