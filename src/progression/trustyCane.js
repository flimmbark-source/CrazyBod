import { getNode } from './skillTreeConfig.js'

export const TRUSTY_CANE_NODE_ID = 'trustyCane'
const PROGRESSION_STORAGE_KEY = 'crazybod:progression'
const PRESENTATION_VERSION = '3'

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

function removeLegacyPresentation() {
  document.querySelectorAll('.trusty-cane-pickup, .trusty-cane-badge').forEach((element) => {
    if (element.dataset.trustyCaneVersion !== PRESENTATION_VERSION) element.remove()
  })
}

function ensurePresentationElements() {
  removeLegacyPresentation()

  let pickup = document.querySelector(`.trusty-cane-pickup[data-trusty-cane-version="${PRESENTATION_VERSION}"]`)
  if (!pickup) {
    pickup = document.createElement('div')
    pickup.className = 'trusty-cane-pickup'
    pickup.dataset.trustyCaneVersion = PRESENTATION_VERSION
    pickup.setAttribute('aria-hidden', 'true')
    pickup.innerHTML = `
      <div class="trusty-cane-model">
        <span class="trusty-cane-facet trusty-cane-handle-a"></span>
        <span class="trusty-cane-facet trusty-cane-handle-b"></span>
        <span class="trusty-cane-facet trusty-cane-neck"></span>
        <span class="trusty-cane-facet trusty-cane-shaft-a"></span>
        <span class="trusty-cane-facet trusty-cane-shaft-b"></span>
        <span class="trusty-cane-facet trusty-cane-tip"></span>
      </div>
      <div class="trusty-cane-hand"><span></span></div>
      <strong class="trusty-cane-popup">2x</strong>
    `
    document.body.appendChild(pickup)
  }

  let badge = document.querySelector(`.trusty-cane-badge[data-trusty-cane-version="${PRESENTATION_VERSION}"]`)
  if (!badge) {
    badge = document.createElement('span')
    badge.className = 'trusty-cane-badge'
    badge.dataset.trustyCaneVersion = PRESENTATION_VERSION
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

  if (pickup.dataset.state !== state) {
    pickup.dataset.state = state
    // Restart the pickup animation only when entering the pickup state.
    if (state === 'picking') {
      pickup.classList.remove('is-animating')
      void pickup.offsetWidth
      pickup.classList.add('is-animating')
    } else {
      pickup.classList.remove('is-animating')
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
