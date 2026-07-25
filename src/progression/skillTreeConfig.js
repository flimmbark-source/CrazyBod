// Skill tree definition. Everything the progression system and the effect
// engine need is data here, so tuning a cost, a trigger time or a press
// requirement never means touching component logic.
//
// Coordinates are authored on a 0-100 grid (percent of the tree canvas, y
// increasing downward). Six nodes do not justify a layout library, and fixed
// coordinates keep responsive behaviour under our control.

export const STARTING_NODE_ID = 'thisIsNormal'

const PALETTES = {
  passive: { accent: '#657c8f', dark: '#29333d', light: '#dbe5ec' },
  preparation: { accent: '#efcf69', dark: '#8a6a27', light: '#fff4d8' },
  automatic: { accent: '#625d82', dark: '#302b38', light: '#e6e1f0' },
  emergency: { accent: '#a45f62', dark: '#6d2830', light: '#f4d6d8' },
}

export const SKILL_TREE_NODES = [
  {
    id: 'thisIsNormal',
    name: 'THIS IS NORMAL',
    tagline: 'Passive',
    category: 'passive',
    palette: PALETTES.passive,
    cost: 50,
    parent: null,
    x: 46,
    y: 50,
    icon: 'plus',
    hook: 'capacity',
    description: 'Increase the Overload limit by 1.',
    detail: '',
    effect: { capacityBonus: 1 },
  },
  {
    id: 'rehearse',
    name: 'REHEARSE THE CONVERSATION',
    tagline: 'Getting Ready · +5s',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 175,
    parent: 'thisIsNormal',
    x: 31,
    y: 33,
    icon: 'chat',
    hook: 'scheduledTechnique',
    description: '+1 Overload limit on success.',
    detail: 'Spawn 2 minigames on failure.',
    effect: {
      techniqueId: 'rehearsal',
      triggerDay: 7.35,
      addedSeconds: 5,
      runCapacityBonus: 1,
      failureSpawnCount: 2,
    },
  },
  {
    id: 'plan',
    name: 'RUN THROUGH THE PLAN',
    tagline: 'Getting Ready · +4s',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 325,
    parent: 'rehearse',
    x: 18,
    y: 18,
    icon: 'list',
    hook: 'scheduledTechnique',
    description: '+3s Spawn delay (10%)',
    detail: 'Each minigame has a 10% to spawn 3 seconds later.',
    effect: {
      techniqueId: 'plan',
      triggerDay: 13.1,
      addedSeconds: 4,
      staggerPairs: 2,
      staggerDelaySeconds: 3,
    },
  },
  {
    id: 'autotarget',
    name: 'HOLD IT TOGETHER',
    tagline: 'Automatic',
    category: 'automatic',
    palette: PALETTES.automatic,
    cost: 225,
    parent: 'thisIsNormal',
    x: 57,
    y: 68,
    icon: 'target',
    hook: 'onMicrogameClear',
    description: 'Autotarget the next minigame after a Clear.',
    detail: '',
    effect: {
      autotargetAfterClear: true,
      // App.jsx still performs a legacy getNode('hold') lookup. A zero value
      // keeps that lookup safe without restoring the rejected spawn delay.
      holdReleaseSeconds: 0,
    },
  },
  {
    id: 'adrenaline',
    name: 'RUN ON ADRENALINE',
    tagline: 'Automatic · Once per run',
    category: 'automatic',
    palette: PALETTES.automatic,
    cost: 425,
    parent: 'autotarget',
    x: 74,
    y: 58,
    icon: 'bolt',
    hook: 'onLoadChanged',
    description: '10% chance to pause spawning for 6 seconds.',
    detail: '',
    effect: { belowLimit: 1, pauseSeconds: 6 },
  },
  {
    id: 'suppress',
    name: 'SUPPRESS VISIBLE DISTRESS',
    tagline: 'Automatic · Once per run',
    category: 'emergency',
    palette: PALETTES.emergency,
    cost: 650,
    parent: 'adrenaline',
    x: 87,
    y: 77,
    icon: 'shield',
    hook: 'onBeforeOverload',
    description: 'Prevent Overload once, then mash Space to destroy active minigames.',
    detail: '',
    effect: { techniqueId: 'suppression', requiredPresses: 12 },
  },
]

const nodesById = Object.fromEntries(
  SKILL_TREE_NODES.map((node) => [node.id, node]),
)

// Compatibility only: old App code still asks for `hold`, while progression
// migration rewrites saved ownership and activation to `autotarget`.
export const SKILL_TREE_NODES_BY_ID = {
  ...nodesById,
  hold: nodesById.autotarget,
}

export function getNode(nodeId) {
  return SKILL_TREE_NODES_BY_ID[nodeId] ?? null
}

// The children a node reveals when it is purchased.
export function childrenOf(nodeId) {
  return SKILL_TREE_NODES.filter((node) => node.parent === nodeId).map((node) => node.id)
}

// Edges for rendering connectors, parent -> child.
export const SKILL_TREE_EDGES = SKILL_TREE_NODES
  .filter((node) => node.parent)
  .map((node) => ({ from: node.parent, to: node.id }))
