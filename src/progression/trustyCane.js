// Trusty Cane scoring rules.
//
// The cane is a physical prop in the 3D world (see JourneyScene): the player
// stops at the apartment door, spends a few seconds picking it up, then carries
// on. This module owns only the *scoring* side of the upgrade so it can be
// exercised by `node --test` without a DOM. All presentation lives in the 3D
// scene, never in the HUD.

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

// Score for the given scored-day time. Time earned at or before `activatesAt`
// (the leave-home boundary) always scores at the base rate; only the time after
// the cane is collected is multiplied. Disabled cane preserves the base score.
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
