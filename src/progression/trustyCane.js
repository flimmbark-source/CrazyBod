import { getNode } from './skillTreeConfig.js'

export const TRUSTY_CANE_NODE_ID = 'trustyCane'
const PROGRESSION_STORAGE_KEY = 'crazybod:progression'

function readEnabledNodeIds() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PROGRESSION_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.enabledNodeIds) ? parsed.enabledNodeIds : []
  } catch {
    return []
  }
}

export function isTrustyCaneEnabled() {
  return readEnabledNodeIds().includes(TRUSTY_CANE_NODE_ID)
}

export function getTrustyCaneState(dayElapsed, enabled = isTrustyCaneEnabled()) {
  if (!enabled) return 'hidden'
  const node = getNode(TRUSTY_CANE_NODE_ID)
  const pickupStartsAt = node?.effect?.pickupStartsAt ?? 13.6
  const activatesAt = node?.effect?.activatesAt ?? 15
  if (dayElapsed < 8) return 'hidden'
  if (dayElapsed < pickupStartsAt) return 'resting'
  if (dayElapsed < activatesAt) return 'picking'
  return 'active'
}

export function scoreWithTrustyCane(dayElapsed, scorePerSecond, enabled = isTrustyCaneEnabled()) {
  const node = getNode(TRUSTY_CANE_NODE_ID)
  const activatesAt = node?.effect?.activatesAt ?? 15
  const multiplier = node?.effect?.multiplier ?? 2
  const elapsed = Math.max(0, dayElapsed)

  if (!enabled || elapsed <= activatesAt) {
    return Math.floor(elapsed * scorePerSecond)
  }

  const normalScore = activatesAt * scorePerSecond
  const multipliedScore = (elapsed - activatesAt) * scorePerSecond * multiplier
  return Math.floor(normalScore + multipliedScore)
}

function removeLegacyCaneElements() {
  document.querySelectorAll(
    '.trusty-cane-pickup, .trusty-cane-model, .trusty-cane-resting, .trusty-cane-object, .trusty-cane-hand',
  ).forEach((element) => element.remove())
}

function ensureUiElements() {
  removeLegacyCaneElements()

  let popup = document.querySelector('.trusty-cane-popup')
  if (!popup) {
    popup = document.createElement('strong')
    popup.className = 'trusty-cane-popup'
    popup.textContent = '2x'
    popup.setAttribute('aria-hidden', 'true')
    document.body.appendChild(popup)
  }

  let badge = document.querySelector('.trusty-cane-badge')
  if (!badge) {
    badge = document.createElement('span')
    badge.className = 'trusty-cane-badge'
    badge.textContent = '2x'
    badge.setAttribute('aria-label', 'Double score active')
    document.body.appendChild(badge)
  }

  return { popup, badge }
}

function positionBadge(badge) {
  const scorePanel = document.querySelector('.score-panel')
  if (!scorePanel || !badge) return
  const rect = scorePanel.getBoundingClientRect()
  badge.style.left = `${Math.round(rect.left + 8)}px`
  badge.style.top = `${Math.round(rect.top + 7)}px`
}

let resizeBound = false
function bindBadgePositioning(badge) {
  if (resizeBound) return
  resizeBound = true
  window.addEventListener('resize', () => positionBadge(badge), { passive: true })
}

function applyPresentation(dayElapsed) {
  const state = getTrustyCaneState(dayElapsed)
  const { popup, badge } = ensureUiElements()

  if (popup.dataset.state !== state) {
    popup.dataset.state = state
    popup.classList.remove('is-animating')
    if (state === 'picking') {
      void popup.offsetWidth
      popup.classList.add('is-animating')
    }
  }

  badge.classList.toggle('is-active', state === 'active')
  positionBadge(badge)
  bindBadgePositioning(badge)
}

let queuedElapsed = null
let presentationQueued = false

export function syncTrustyCanePresentation(dayElapsed) {
  if (typeof document === 'undefined') return

  queuedElapsed = dayElapsed
  if (presentationQueued) return
  presentationQueued = true

  queueMicrotask(() => {
    presentationQueued = false
    const elapsed = queuedElapsed
    queuedElapsed = null
    applyPresentation(elapsed)
  })
}
