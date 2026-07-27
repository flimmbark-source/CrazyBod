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

function ensurePresentationElements() {
  let pickup = document.querySelector('.trusty-cane-pickup')
  if (!pickup) {
    pickup = document.createElement('div')
    pickup.className = 'trusty-cane-pickup'
    pickup.setAttribute('aria-hidden', 'true')
    pickup.innerHTML = `
      <div class="trusty-cane-object">
        <span class="trusty-cane-hook"></span>
        <span class="trusty-cane-shaft"></span>
        <span class="trusty-cane-tip"></span>
      </div>
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

function applyPresentation(dayElapsed) {
  const node = getNode(TRUSTY_CANE_NODE_ID)
  const pickupStartsAt = node?.effect?.pickupStartsAt ?? 13.6
  const activatesAt = node?.effect?.activatesAt ?? 15
  const enabled = isTrustyCaneEnabled()
  const { pickup, badge } = ensurePresentationElements()

  let state = 'hidden'
  if (enabled && dayElapsed >= pickupStartsAt && dayElapsed < activatesAt) state = 'picking'
  if (enabled && dayElapsed >= activatesAt) state = 'active'

  if (pickup.dataset.state !== state) pickup.dataset.state = state
  badge.classList.toggle('is-active', state === 'active')
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
