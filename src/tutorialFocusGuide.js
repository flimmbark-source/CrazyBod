const FOCUS_COPY = {
  first: {
    eyebrow: 'FOCUS THE MINIGAME',
    title: 'Click the frame.',
    body: 'Click a minigame to FOCUS on it.',
  },
  second: {
    eyebrow: 'FOCUS IT FIRST',
    title: 'Click the frame.',
    body: 'Click to FOCUS.',
  },
}

const PLAY_COPY = {
  first: {
    eyebrow: 'FIRST MINIGAME',
    title: 'Hold to clear it.',
    body: 'Hold and Release the button or Space until it clears.',
  },
  second: {
    eyebrow: 'A DIFFERENT MINIGAME',
    title: 'This one uses movement.',
    body: 'Use the Arrow keys or WASD to reach the exit.',
  },
}

function writeCopy(callout, copy) {
  const eyebrow = callout.querySelector(':scope > span')
  const title = callout.querySelector(':scope > strong')
  const body = callout.querySelector(':scope > p')
  if (eyebrow) eyebrow.textContent = copy.eyebrow
  if (title) title.textContent = copy.title
  if (body) body.textContent = copy.body
}

function cursorMarkup() {
  const cursor = document.createElement('span')
  cursor.className = 'tutorial-demo-cursor'
  cursor.setAttribute('aria-hidden', 'true')
  cursor.innerHTML = `
    <svg viewBox="0 0 36 46" focusable="false" aria-hidden="true">
      <path d="M4 3v32l8.2-7.1 6.2 14.5 7.1-3-6.2-14.3H31z" />
    </svg>
    <i></i>
  `
  return cursor
}

function prepareLayer(layer) {
  if (layer.dataset.focusGuideReady === 'true') return

  const kind = layer.classList.contains('tutorial-layer-first')
    ? 'first'
    : layer.classList.contains('tutorial-layer-second')
      ? 'second'
      : null
  if (!kind) return

  const callout = layer.querySelector('.tutorial-callout')
  const target = document.querySelector('.microgame.tutorial-target')
  if (!callout || !target) return

  layer.dataset.focusGuideReady = 'true'
  layer.dataset.focusGuideStage = 'focus'
  target.classList.add('tutorial-focus-pending')
  writeCopy(callout, FOCUS_COPY[kind])

  const cursor = cursorMarkup()
  target.append(cursor)

  const focusFrame = () => {
    if (!layer.isConnected || layer.dataset.focusGuideStage !== 'focus') return
    layer.dataset.focusGuideStage = 'play'
    target.classList.remove('tutorial-focus-pending')
    cursor.remove()
    writeCopy(callout, PLAY_COPY[kind])
  }

  target.addEventListener('pointerdown', focusFrame, { capture: true, once: true })
}

function scanTutorial() {
  document
    .querySelectorAll('.tutorial-layer-first, .tutorial-layer-second')
    .forEach(prepareLayer)
}

const observer = new MutationObserver(() => window.queueMicrotask(scanTutorial))

function startTutorialFocusGuide() {
  observer.observe(document.body, { childList: true, subtree: true })
  scanTutorial()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startTutorialFocusGuide, { once: true })
} else {
  startTutorialFocusGuide()
}
