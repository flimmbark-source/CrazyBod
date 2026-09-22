import { useEffect } from 'react'

import { morningLook, resetMorningLook } from './morningStore.js'

// Past this many pixels a press is a look, not a click on whatever is under it.
const DRAG_THRESHOLD = 5

// Click and hold anywhere in the room to look around. The deltas are handed to
// the camera through the store rather than through React, and the moment a
// press travels far enough to count as a drag it stops being a click, so
// looking around never also walks you across the room.
export default function useMorningLook(active) {
  useEffect(() => {
    if (!active) {
      resetMorningLook()
      return undefined
    }

    let pointerId = null
    let lastX = 0
    let lastY = 0
    let travelled = 0

    const isLookTarget = (target) => (
      // Only bare room: anything with its own controls keeps its own drags.
      !(target instanceof Element)
      || !target.closest('button, input, .morning-practice, .pick-picture, .dialogue-box, .settings-menu')
    )

    const down = (event) => {
      if (event.button !== 0 || pointerId !== null) return
      if (!isLookTarget(event.target)) return
      pointerId = event.pointerId
      lastX = event.clientX
      lastY = event.clientY
      travelled = 0
      morningLook.suppressClick = false
    }

    const move = (event) => {
      if (event.pointerId !== pointerId) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
      travelled += Math.abs(dx) + Math.abs(dy)
      if (travelled < DRAG_THRESHOLD) return
      morningLook.suppressClick = true
      if (!morningLook.dragging) {
        morningLook.dragging = true
        document.body.style.cursor = 'grabbing'
      }
      morningLook.dx += dx
      morningLook.dy += dy
    }

    const up = (event) => {
      if (event.pointerId !== pointerId) return
      pointerId = null
      if (morningLook.dragging) {
        morningLook.dragging = false
        document.body.style.cursor = 'grab'
      }
      // The click event lands right after this one; clear the flag after it.
      if (morningLook.suppressClick) {
        window.setTimeout(() => { morningLook.suppressClick = false }, 0)
      }
    }

    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      resetMorningLook()
    }
  }, [active])
}
