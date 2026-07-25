// Skill tree definition. Everything the progression system and the effect
// engine need is data here, so tuning a cost, a trigger time or a press
// requirement never means touching component logic.
//
// Coordinates are authored on a 0-100 grid (percent of the tree canvas, y
// increasing downward). Six nodes do not justify a layout library, and fixed
// coordinates keep responsive behaviour under our control.

export const STARTING_NODE_ID = 'thisIsNormal'

const PALETTES = {
  passive: { accent: '#657c8f', dark: '#4c9eef', light: '#dbe5ec' },
  preparation: { accent: '#efcf69', dark: '#fdc03c', light: '#fff4d8' },
  automatic: { accent: '#625d82', dark: '#843cf6', light: '#e6e1f0' },
  emergency: { accent: '#a45f62', dark: '#f73d52', light: '#f4d6d8' },
}

export const SKILL_TREE_NODES = [
  {
    id: 'thisIsNormal',
    name: 'Its Normal',
    tagline: 'Passive',
    category: 'passive',
    palette: PALETTES.passive,
    cost: 50,
    parent: null,
    x: 46,
    y: 50,
    icon: 'plus',
    hook: 'capacity',
    description: 'Overload Capacity +1.',
    detail: '',
    effect: { capacityBonus: 1 },
  },
  {
    id: 'rehearse',
    name: 'Reherse Lines (+10s)',
    tagline: '',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 175,
    parent: 'thisIsNormal',
    x: 31,
    y: 33,
    icon: 'chat',
    hook: 'scheduledTechnique',
    description: 'Overload Capacity +2.',
    detail: 'Spawn 1 minigames on failure.',
    effect: {
      techniqueId: 'rehearsal',
      triggerDay: 7.35,
      addedSeconds: 10,
      runCapacityBonus: 2,
      failureSpawnCount: 1,
    },
  },
  {
    id: 'plan',
    name: 'Run Through Plan',
    tagline: '',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 325,
    parent: 'rehearse',
    x: 18,
    y: 18,
    icon: 'list',
    hook: 'scheduledTechnique',
    description: '+3s Spawn delay (20%)',
    detail: 'Minigames have a 20% to have a 3s delay.',
    effect: {
      techniqueId: 'plan',
      triggerDay: 13.1,
      addedSeconds: 8,
      staggerPairs: 2,
      staggerDelaySeconds: 3,
    },
  },
  {
    id: 'autotarget',
    name: 'Put on Gameface',
    tagline: '',
    category: 'automatic',
    palette: PALETTES.automatic,
    cost: 225,
    parent: 'thisIsNormal',
    x: 57,
    y: 68,
    icon: 'target',
    hook: 'onMicrogameClear',
    description: 'Autotarget minigames.',
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
    name: 'ADRENALINE',
    tagline: '',
    category: 'automatic',
    palette: PALETTES.automatic,
    cost: 425,
    parent: 'autotarget',
    x: 74,
    y: 58,
    icon: 'bolt',
    hook: 'onLoadChanged',
    description: '+4s Game Pause (20%)',
    detail: '20% to pause for 4s on each minigame spawn',
    effect: { belowLimit: 1, pauseSeconds: 4 },
  },
  {
    id: 'suppress',
    name: 'Suppress Feelings',
    tagline: '',
    category: 'emergency',
    palette: PALETTES.emergency,
    cost: 650,
    parent: 'adrenaline',
    x: 87,
    y: 77,
    icon: 'shield',
    hook: 'onBeforeOverload',
    description: 'Prevent Overload once, mash Space to destroy minigames.',
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
