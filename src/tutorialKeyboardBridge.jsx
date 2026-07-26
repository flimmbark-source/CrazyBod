import { useEffect } from 'react'

const SCORE_CALLOUT_CLASS = 'tutorial-score-callout'
const SCORE_TARGET_CLASS = 'tutorial-score-target'

function isEditableTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target.matches('input, textarea, select')
  )
}

function positionScoreCallout(callout, scorePanel) {
  const rect = scorePanel.getBoundingClientRect()
  const edge = 12
  const gap = 28
  const width = callout.offsetWidth
  const height = callout.offsetHeight
  const left = Math.max(edge, Math.min(
    rect.left + rect.width / 2 - width / 2,
    window.innerWidth - width - edge,
  ))
  const top = Math.max(edge, Math.min(
    rect.bottom + gap,
    window.innerHeight - height - edge,
  ))

  callout.style.left = `${left}px`
  callout.style.top = `${top}px`
}

function syncTutorialUi() {
  const goHomeButton = document.querySelector('.go-home')
  const goHomeHint = goHomeButton?.querySelector('small')
  if (goHomeHint && goHomeHint.textContent !== 'Press ESC') {
    goHomeHint.textContent = 'Press ESC'
  }

  const homeLayer = document.querySelector('.tutorial-layer-home')
  const homeTitle = homeLayer?.querySelector('.tutorial-callout-home strong')
  if (homeTitle && homeTitle.textContent !== 'Press ESC to go home if you feel overwhelmed.') {
    homeTitle.textContent = 'Press ESC to go home if you feel overwhelmed.'
  }

  const scorePanel = document.querySelector('.score-panel')
  let scoreCallout = document.querySelector(`.${SCORE_CALLOUT_CLASS}`)

  if (!homeLayer || !scorePanel) {
    scoreCallout?.remove()
    document.querySelector(`.${SCORE_TARGET_CLASS}`)?.classList.remove(SCORE_TARGET_CLASS, 'tutorial-target')
    return
  }

  scorePanel.classList.add(SCORE_TARGET_CLASS, 'tutorial-target')

  if (!scoreCallout) {
    scoreCallout = document.createElement('aside')
    scoreCallout.className = `tutorial-callout tutorial-callout-score placement-below ${SCORE_CALLOUT_CLASS}`
    scoreCallout.setAttribute('role', 'note')
    scoreCallout.innerHTML = `
      <i class="tutorial-pointer" aria-hidden="true"></i>
      <span>IF YOU BECOME OVERWHELMED</span>
      <strong>If you bust, you will lose some of your score.</strong>
    `
    homeLayer.append(scoreCallout)
  }

  positionScoreCallout(scoreCallout, scorePanel)
}

export default function TutorialKeyboardBridge() {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat || isEditableTarget(event.target)) return

      if (event.key === 'Escape') {
        const shell = document.querySelector('.game-shell.status-playing')
        const goHomeButton = shell?.querySelector('.go-home:not(:disabled)')
        if (!goHomeButton) return
        event.preventDefault()
        goHomeButton.click()
        return
      }

      if (event.code !== 'Space') return
      const tutorialButton = document.querySelector(
        '.tutorial-layer-summary button, .tutorial-layer-home .tutorial-next',
      )
      if (!tutorialButton) return
      event.preventDefault()
      tutorialButton.click()
    }

    const observer = new MutationObserver(syncTutorialUi)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', syncTutorialUi)
    syncTutorialUi()

    return () => {
      observer.disconnect()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', syncTutorialUi)
      document.querySelector(`.${SCORE_CALLOUT_CLASS}`)?.remove()
      document.querySelector(`.${SCORE_TARGET_CLASS}`)?.classList.remove(SCORE_TARGET_CLASS, 'tutorial-target')
    }
  }, [])

  return null
}
