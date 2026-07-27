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

function caneMarkup(className) {
  return `
    <div class="${className}">
      <span class="trusty-cane-facet trusty-cane-handle-a"></span>
      <span class="trusty-cane-facet trusty-cane-handle-b"></span>
      <span class="trusty-cane-facet trusty-cane-neck"></span>
      <span class="trusty-cane-facet trusty-cane-shaft-a"></span>
      <span class="trusty-cane-facet trusty-cane-shaft-b"></span>
      <span class="trusty-cane-facet trusty-cane-tip"></span>
    </div>
  `
}

function ensurePresentationElements() {
  let pickup = document.querySelector('.trusty-cane-pickup')
  if (!pickup) {
    pickup = document.createElement('div')
    pickup.className = 'trusty-cane-pickup'
    pickup.setAttribute('aria-hidden', 'true')
    pickup.innerHTML = `
      ${caneMarkup('trusty-cane-resting')}
      <div class="trusty-cane-hand"><span></span></div>
      ${caneMarkup('trusty-cane-object')}
      <strong class="trusty-cane-popup">2x</strong>
    `
    document.body.appendChild(pickup)
  }

  let badge = document.querySelector('.trusty-cane-badge')
  if (!badge) {
    badge = document.createElement('span')
    badge.className = 'trusty-cane-badge'
    badge.textContent = '2x'
    badge.setAttribute('aria-label', 'Double score active')
    document.body.appendChild(badge)
  }

  return { pickup, badge }
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
  const node = getNode(TRUSTY_CANE_NODE_ID)
  const pickupStartsAt = node?.effect?.pickupStartsAt ?? 13.6
  const activatesAt = node?.effect?.activatesAt ?? 15
  const enabled = isTrustyCaneEnabled()
  const { pickup, badge } = ensurePresentationElements()

  let state = 'hidden'
  if (enabled && dayElapsed >= 8 && dayElapsed < pickupStartsAt) state = 'resting'
  if (enabled && dayElapsed >= pickupStartsAt && dayElapsed < activatesAt) state = 'picking'
  if (enabled && dayElapsed >= activatesAt) state = 'active'

  if (pickup.dataset.state !== state) pickup.dataset.state = state
  badge.classList.toggle('is-active', state === 'active')
  positionBadge(badge)
  bindBadgePositioning(badge)
  document.body.classList.toggle('trusty-cane-enabled', enabled)
  document.body.classList.toggle('trusty-cane-active', state === 'active')
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
