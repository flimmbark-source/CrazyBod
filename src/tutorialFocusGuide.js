import { translate } from './i18n/i18n.js'

// Copy is keyed here and translated at write time (the language is fixed before
// gameplay, so the current value is correct when a callout appears).
function writeCopy(callout, stage, kind) {
  const eyebrow = callout.querySelector(':scope > span')
  const title = callout.querySelector(':scope > strong')
  const body = callout.querySelector(':scope > p')
  const prefix = `focusGuide.${stage}.${kind}`
  if (eyebrow) eyebrow.textContent = translate(`${prefix}.eyebrow`)
  if (title) title.textContent = translate(`${prefix}.title`)
  if (body) body.textContent = translate(`${prefix}.body`)
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
  writeCopy(callout, 'focus', kind)

  const cursor = cursorMarkup()
  target.append(cursor)

  const focusFrame = () => {
    if (!layer.isConnected || layer.dataset.focusGuideStage !== 'focus') return
    layer.dataset.focusGuideStage = 'play'
    target.classList.remove('tutorial-focus-pending')
    cursor.remove()
    writeCopy(callout, 'play', kind)
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
