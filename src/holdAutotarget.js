const PROGRESSION_STORAGE_KEY = 'crazybod:progression'
const AUTOTARGET_NODE_IDS = new Set(['autotarget', 'hold'])

let lastActiveIndex = 0
let targetScheduled = false

function autotargetEnabled() {
  try {
    const raw = window.localStorage.getItem(PROGRESSION_STORAGE_KEY)
    if (!raw) return false
    const progression = JSON.parse(raw)
    return Array.isArray(progression.enabledNodeIds)
      && progression.enabledNodeIds.some((id) => AUTOTARGET_NODE_IDS.has(id))
  } catch {
    return false
  }
}

function rememberTarget(event) {
  const game = event.target instanceof Element
    ? event.target.closest('.microgame')
    : null
  if (!game) return

  const games = [...document.querySelectorAll('.microgame')]
  const index = games.indexOf(game)
  if (index >= 0) lastActiveIndex = index
}

function activateWindow(windowElement) {
  const EventConstructor = window.PointerEvent ?? window.MouseEvent
  windowElement.dispatchEvent(new EventConstructor('pointerdown', {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
  }))
}

function scheduleAutotarget() {
  if (targetScheduled || !autotargetEnabled()) return
  targetScheduled = true

  window.requestAnimationFrame(() => {
    targetScheduled = false
    if (!autotargetEnabled()) return

    // Do not override a new target the player chose during the clear effect.
    if (document.querySelector('.microgame.keyboard-active')) return

    const games = [...document.querySelectorAll('.microgame')]
    if (games.length === 0) return

    // After the cleared window is removed, the following window occupies its
    // previous array position. Clearing the final window falls back to the new last one.
    const nextIndex = Math.min(lastActiveIndex, games.length - 1)
    activateWindow(games[nextIndex])
  })
}

function containsCompletionBurst(node) {
  if (!(node instanceof Element)) return false
  return node.matches('.completion-burst') || Boolean(node.querySelector('.completion-burst'))
}

const completionObserver = new MutationObserver((records) => {
  const clearCompleted = records.some((record) => (
    [...record.addedNodes].some(containsCompletionBurst)
  ))
  if (clearCompleted) scheduleAutotarget()
})

function startAutotarget() {
  document.addEventListener('pointerdown', rememberTarget, true)
  document.addEventListener('focusin', rememberTarget, true)
  completionObserver.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAutotarget, { once: true })
} else {
  startAutotarget()
}
