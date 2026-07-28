// Central, pure derivation of gameplay capabilities from the enabled skill
// nodes. Systems ask this layer "can the player use the Sword / Mandala / Dive?"
// instead of scattering `enabledNodeIds.includes('mandalaDive')` string checks
// through unrelated components. Node config *declares* capabilities via flags on
// its `effect`; this function merges those declarations.
//
// It is additive: existing effects (capacity, techniques) are still consumed by
// computeCapacity and App's technique logic. This only surfaces the new
// Mandala/Sword capabilities.

import { getNode } from './skillTreeConfig.js'

// Capability flags a node's `effect` may declare, mapped to the derived field
// they turn on. Add a row here (plus the flag on a node) to introduce a new
// capability without touching consuming systems.
const CAPABILITY_FLAGS = {
  enablesSword: 'swordEnabled',
  enablesMandala: 'mandalaEnabled',
  enablesDive: 'diveEnabled',
}

export function defaultProgressionEffects() {
  return {
    swordEnabled: false,
    mandalaEnabled: false,
    diveEnabled: false,
  }
}

export function deriveProgressionEffects(enabledNodeIds = []) {
  const effects = defaultProgressionEffects()
  for (const nodeId of enabledNodeIds) {
    const node = getNode(nodeId)
    if (!node?.effect) continue
    for (const [flag, field] of Object.entries(CAPABILITY_FLAGS)) {
      if (node.effect[flag]) effects[field] = true
    }
  }
  return effects
}
