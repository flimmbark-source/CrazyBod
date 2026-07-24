const VARIANTS = {
  discomfort: ['steady', 'alternating', 'chase'],
  anxiety: ['scatter', 'ring', 'zigzag', 'corners', 'spiral'],
  brainFog: ['plain', 'rotate90', 'rotate180', 'rotate270', 'mirror'],
  fatigue: ['steady', 'twoStage', 'breathing'],
}

const bags = new Map()
let activeWindow = null
let syntheticPointerRelease = false

function shuffled(values) {
  const next = [...values]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function drawVariant(kind) {
  let bag = bags.get(kind)
  if (!bag || bag.length === 0) {
    bag = shuffled(VARIANTS[kind] ?? ['plain'])
    bags.set(kind, bag)
  }
  return bag.pop()
}

function kindFor(windowElement) {
  if (windowElement.classList.contains('microgame-discomfort')) return 'discomfort'
  if (windowElement.classList.contains('microgame-anxiety')) return 'anxiety'
  if (windowElement.classList.contains('microgame-brainFog')) return 'brainFog'
  if (windowElement.classList.contains('microgame-fatigue')) return 'fatigue'
  return null
}

function setHint(windowElement, hint) {
  const header = windowElement.querySelector('.microgame-header')
  if (header) header.dataset.keyHint = hint
}

function setActive(windowElement) {
  if (activeWindow === windowElement) return
  activeWindow?.__crazyBodBlur?.()
  activeWindow?.classList.remove('keyboard-active')
  activeWindow = windowElement?.isConnected ? windowElement : null
  activeWindow?.classList.add('keyboard-active')
}

function clickButton(button) {
  if (!button || button.disabled) return
  button.click()
}

function setupDiscomfort(windowElement, variant) {
  const button = windowElement.querySelector('.discomfort-game button')
  if (!button) return

  let step = 0
  const chaseSlots = ['left', 'center', 'right', 'center']

  const render = () => {
    if (variant === 'alternating') {
      const side = step % 2 === 0 ? 'left' : 'right'
      windowElement.dataset.side = side
      button.textContent = side === 'left' ? '[A]' : '[D]'
      setHint(windowElement, 'A / D')
      return
    }

    if (variant === 'chase') {
      const slot = chaseSlots[step % chaseSlots.length]
      windowElement.dataset.side = slot
      const labels = { left: '←', center: '↓', right: '→' }
      button.textContent = `${labels[slot]}  ADJUST`
      setHint(windowElement, '←  ↓  →')
      return
    }

    windowElement.dataset.side = 'center'
    button.textContent = 'SPACE'
    setHint(windowElement, 'SPACE')
  }

  button.addEventListener('click', () => {
    step += 1
    queueMicrotask(render)
  })
  render()

  windowElement.__crazyBodKeyDown = (event) => {
    if (variant === 'alternating') {
      const expected = step % 2 === 0 ? 'KeyA' : 'KeyD'
      if (event.code !== expected) return false
      clickButton(button)
      return true
    }

    if (variant === 'chase') {
      const expectedBySlot = { left: 'ArrowLeft', center: 'ArrowDown', right: 'ArrowRight' }
      const slot = chaseSlots[step % chaseSlots.length]
      if (event.code !== expectedBySlot[slot]) return false
      clickButton(button)
      return true
    }

    if (event.code === 'Space' || event.code === 'Enter') {
      clickButton(button)
      return true
    }
    return false
  }
}

function setupAnxiety(windowElement) {
  setHint(windowElement, 'MOUSE')
}

const BRAIN_FOG_LABELS = {
  plain: ['↑', '←', '→', '↓'],
  rotate90: ['→', '↑', '↓', '←'],
  rotate180: ['↓', '→', '←', '↑'],
  rotate270: ['←', '↓', '↑', '→'],
  mirror: ['↑', '→', '←', '↓'],
}

function setupBrainFog(windowElement, variant) {
  const controls = [...windowElement.querySelectorAll('.fog-controls button')]
  const labels = BRAIN_FOG_LABELS[variant] ?? BRAIN_FOG_LABELS.plain
  controls.forEach((button, index) => {
    button.textContent = labels[index]
  })
  setHint(windowElement, 'ARROWS / WASD')

  const visualKeyToArrow = {
    ArrowUp: '↑', KeyW: '↑',
    ArrowLeft: '←', KeyA: '←',
    ArrowRight: '→', KeyD: '→',
    ArrowDown: '↓', KeyS: '↓',
  }

  windowElement.__crazyBodKeyDown = (event) => {
    const arrow = visualKeyToArrow[event.code]
    if (!arrow) return false
    const button = controls.find((candidate) => candidate.textContent === arrow)
    clickButton(button)
    return true
  }
}

function dispatchPointer(button, type) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
  })
  button.dispatchEvent(event)
}

function setupFatigue(windowElement, variant) {
  const button = windowElement.querySelector('.fatigue-game button')
  const progress = windowElement.querySelector('.fatigue-game .tiny-progress i')
  if (!button || !progress) return

  const thresholds = variant === 'breathing' ? [30, 64] : variant === 'twoStage' ? [50] : []
  let checkpointIndex = 0
  let waitingForRelease = false

  const showHoldLabel = () => {
    button.textContent = checkpointIndex > 0 ? 'HOLD AGAIN' : 'SPACE'
  }

  const releaseForCheckpoint = () => {
    if (waitingForRelease) return
    waitingForRelease = true
    windowElement.dataset.resting = 'true'
    button.textContent = 'RELEASE'
    syntheticPointerRelease = true
    dispatchPointer(button, 'pointerup')
    syntheticPointerRelease = false
  }

  const clearCheckpoint = () => {
    if (!waitingForRelease) return
    waitingForRelease = false
    windowElement.dataset.resting = 'false'
    showHoldLabel()
  }

  const observer = new MutationObserver(() => {
    if (checkpointIndex >= thresholds.length) return
    const width = Number.parseFloat(progress.style.width)
    if (!Number.isFinite(width) || width < thresholds[checkpointIndex]) return
    checkpointIndex += 1
    releaseForCheckpoint()
  })
  observer.observe(progress, { attributes: true, attributeFilter: ['style'] })

  button.addEventListener('pointerup', () => {
    if (!syntheticPointerRelease) clearCheckpoint()
  })
  button.addEventListener('pointercancel', clearCheckpoint)
  button.addEventListener('pointerleave', (event) => {
    if (event.buttons === 0) clearCheckpoint()
  })

  setHint(windowElement, 'HOLD SPACE')
  showHoldLabel()

  windowElement.__crazyBodKeyDown = (event) => {
    if (event.code !== 'Space' || event.repeat || waitingForRelease) return false
    dispatchPointer(button, 'pointerdown')
    return true
  }
  windowElement.__crazyBodKeyUp = (event) => {
    if (event.code !== 'Space') return false
    dispatchPointer(button, 'pointerup')
    clearCheckpoint()
    return true
  }
  windowElement.__crazyBodBlur = () => {
    dispatchPointer(button, 'pointerup')
    clearCheckpoint()
  }
  windowElement.__crazyBodCleanup = () => observer.disconnect()
}

function setupMicrogame(windowElement) {
  if (windowElement.dataset.enhanced === 'true') return
  const kind = kindFor(windowElement)
  if (!kind) return

  const variant = drawVariant(kind)
  windowElement.dataset.enhanced = 'true'
  windowElement.dataset.variant = variant
  windowElement.addEventListener('pointerdown', () => setActive(windowElement), { capture: true })
  windowElement.addEventListener('focusin', () => setActive(windowElement))

  if (kind === 'discomfort') setupDiscomfort(windowElement, variant)
  if (kind === 'anxiety') setupAnxiety(windowElement, variant)
  if (kind === 'brainFog') setupBrainFog(windowElement, variant)
  if (kind === 'fatigue') setupFatigue(windowElement, variant)
}

function scanForMicrogames(root = document) {
  root.querySelectorAll?.('.microgame').forEach(setupMicrogame)
}

function chooseDialogueOption(event) {
  if (!['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(event.code)) return false
  const dialogue = document.querySelector('.dialogue-box')
  if (!dialogue) return false
  const number = Number.parseInt(event.code.at(-1), 10)
  const option = dialogue.querySelectorAll('.dialogue-options button')[number - 1]
  if (!option) return false
  option.click()
  return true
}

function onKeyDown(event) {
  if (chooseDialogueOption(event)) {
    event.preventDefault()
    return
  }
  if (!activeWindow?.isConnected) setActive(null)
  if (!activeWindow?.__crazyBodKeyDown) return
  if (activeWindow.__crazyBodKeyDown(event)) event.preventDefault()
}

function onKeyUp(event) {
  if (!activeWindow?.isConnected) setActive(null)
  if (!activeWindow?.__crazyBodKeyUp) return
  if (activeWindow.__crazyBodKeyUp(event)) event.preventDefault()
}

const rootObserver = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.removedNodes) {
      if (!(node instanceof Element)) continue
      if (node.matches('.microgame')) node.__crazyBodCleanup?.()
      node.querySelectorAll?.('.microgame').forEach((game) => game.__crazyBodCleanup?.())
    }
    for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue
      if (node.matches('.microgame')) setupMicrogame(node)
      scanForMicrogames(node)
    }
  }

  if (activeWindow && !activeWindow.isConnected) {
    activeWindow.__crazyBodCleanup?.()
    setActive(null)
  }
})

function startEnhancements() {
  scanForMicrogames()
  rootObserver.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startEnhancements, { once: true })
} else {
  startEnhancements()
}
