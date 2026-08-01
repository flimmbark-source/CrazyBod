// Skill tree definition. Everything the progression system and the effect
// engine need is data here, so tuning a cost, a trigger time or a press
// requirement never means touching component logic.
//
// Coordinates are authored on a 0-100 grid (percent of the tree canvas, y
// increasing downward). Fixed coordinates keep responsive behaviour under our
// control.
//
// Dependencies are expressed as `prerequisites: [...ids]`. A legacy single
// `parent` is still honoured through prerequisitesOf() so old shapes keep
// working, but new nodes should use `prerequisites`.

// Stable public release: the original coping tree remains the player-facing
// progression root. Experimental Mandala nodes stay in the data model so work
// can resume later without deleting saves or implementation.
export const STARTING_NODE_ID = 'thisIsNormal'

const PALETTES = {
  mandala: { accent: '#c9a24b', dark: '#f0b429', light: '#f6ecd2' },
  passive: { accent: '#657c8f', dark: '#4c9eef', light: '#dbe5ec' },
  preparation: { accent: '#efcf69', dark: '#fdc03c', light: '#fff4d8' },
  automatic: { accent: '#625d82', dark: '#843cf6', light: '#e6e1f0' },
  emergency: { accent: '#a45f62', dark: '#f73d52', light: '#f4d6d8' },
}

export const SKILL_TREE_NODES = [
  // --- Experimental Mandala nodes (hidden in the stable release UI) -------
  {
    id: 'swordCursor',
    name: 'Sword Cursor',
    tagline: 'Mandala',
    category: 'mandala',
    palette: PALETTES.mandala,
    cost: 50, // TEMP prototype cost
    prerequisites: [],
    x: 50,
    y: 50,
    icon: 'sword',
    hook: 'persistentMode',
    description: 'Your cursor becomes a sword.',
    detail: 'Slash foes as you descend the Mandala. Fast movement cuts.',
    effect: { enablesSword: true, enablesMandala: true },
  },
  {
    id: 'mandalaDive',
    name: 'Dive',
    tagline: 'Mandala',
    category: 'mandala',
    palette: PALETTES.mandala,
    cost: 75, // TEMP prototype cost
    prerequisites: ['swordCursor'],
    x: 50,
    y: 24,
    icon: 'dive',
    hook: 'persistentMode',
    description: 'Press W or Forward to move faster through the Mandala.',
    detail: 'Hold to accelerate. Reach depth sooner — but threats arrive sooner too.',
    effect: { enablesDive: true },
  },

  // --- Stable coping tree -------------------------------------------------
  {
    id: 'thisIsNormal',
    name: 'Overload Capacity +1',
    tagline: 'Passive',
    category: 'passive',
    palette: PALETTES.passive,
    cost: 50,
    prerequisites: [],
    x: 50,
    y: 76,
    icon: 'plus',
    hook: 'capacity',
    description: '',
    detail: 'Its like this for everyone.',
    effect: { capacityBonus: 1 },
  },
  {
    id: 'rehearse',
    name: 'Overload Capacity +2',
    tagline: 'Getting Ready',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 175,
    prerequisites: ['thisIsNormal'],
    x: 30,
    y: 66,
    icon: 'chat',
    hook: 'scheduledTechnique',
    description: '',
    detail: 'Rehearse lines in the mirror for 10 seconds during the Ready Up phase.',
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
    name: 'Each minigame spawn may pause time for 2s. (20%)',
    tagline: 'Getting Ready',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 125,
    prerequisites: ['rehearse'],
    x: 16,
    y: 54,
    icon: 'list',
    hook: 'scheduledTechnique',
    description: '',
    detail: 'Before you leave, tap everything in the right order.',
    effect: {
      techniqueId: 'plan',
      triggerDay: 13.1,
      addedSeconds: 2,
      staggerPairs: 2,
      staggerDelaySeconds: 2,
    },
  },
  {
    id: 'stretch',
    name: 'Reduce the amount of physical minigames.',
    tagline: 'Getting Ready',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 275,
    prerequisites: ['rehearse'],
    x: 19,
    y: 80,
    icon: 'stretch',
    hook: 'scheduledTechnique',
    description: '',
    detail: 'Warm the ol\' bod up with a few stretches before leaving.',
    effect: {
      techniqueId: 'stretch',
      triggerDay: 10.5,
      addedSeconds: 11,
      holdSeconds: 0.8,
      thinChance: 0.5,
      windowSeconds: 12,
    },
  },
  {
    id: 'autotarget',
    name: 'Autotarget minigames.',
    tagline: 'Automatic',
    category: 'automatic',
    palette: PALETTES.automatic,
    cost: 125,
    prerequisites: ['thisIsNormal'],
    x: 70,
    y: 66,
    icon: 'target',
    hook: 'onMicrogameClear',
    description: '',
    detail: 'Auto detects when you feel uncomforable.',
    effect: {
      autotargetAfterClear: true,
      // App.jsx still performs a legacy getNode('hold') lookup. A zero value
      // keeps that lookup safe without restoring the rejected spawn delay.
      holdReleaseSeconds: 0,
    },
  },
  {
    id: 'adrenaline',
    name: 'Each minigame spawn may pause time for 2s.(20%)',
    tagline: 'Automatic',
    category: 'automatic',
    palette: PALETTES.automatic,
    cost: 250,
    prerequisites: ['autotarget'],
    x: 84,
    y: 54,
    icon: 'bolt',
    hook: 'onLoadChanged',
    description: '',
    detail: 'Get your adrenaline pumping to slow down time.',
    effect: { belowLimit: 1, pauseSeconds: 2 },
  },
  {
    id: 'suppress',
    name: 'Prevent Overload once, mash Space to destroy minigames.',
    tagline: 'Automatic',
    category: 'emergency',
    palette: PALETTES.emergency,
    cost: 300,
    prerequisites: ['autotarget'],
    x: 82,
    y: 80,
    icon: 'shield',
    hook: 'onBeforeOverload',
    description: '',
    detail: 'Ignore the feelings your body is telling you to just get it done.',
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

// Normalise a node's dependencies. Prefers an explicit `prerequisites` array,
// falling back to a legacy single `parent`. This is the seam that lets future
// nodes have several prerequisites (secrets, convergence, alternate paths).
export function prerequisitesOf(node) {
  if (!node) return []
  if (Array.isArray(node.prerequisites)) return node.prerequisites
  return node.parent ? [node.parent] : []
}

// The children a node reveals when it is purchased: any node listing it as a
// prerequisite.
export function childrenOf(nodeId) {
  return SKILL_TREE_NODES.filter((node) => prerequisitesOf(node).includes(nodeId)).map((node) => node.id)
}

// Edges for rendering connectors, prerequisite -> node.
export const SKILL_TREE_EDGES = SKILL_TREE_NODES.flatMap((node) =>
  prerequisitesOf(node).map((from) => ({ from, to: node.id })),
)
