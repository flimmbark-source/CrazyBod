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
    name: 'Room for one more thing',
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
    id: 'pace',
    name: 'Room for one more thing',
    tagline: 'Passive',
    category: 'passive',
    palette: PALETTES.passive,
    cost: 90,
    prerequisites: ['thisIsNormal'],
    x: 50,
    y: 57,
    icon: 'plus',
    hook: 'capacity',
    description: '',
    detail: 'You take it slower, so one more thing fits before you bust.',
    effect: { capacityBonus: 1 },
  },
  {
    id: 'boundaries',
    name: 'Room for one more thing',
    tagline: 'Passive',
    category: 'passive',
    palette: PALETTES.passive,
    cost: 200,
    prerequisites: ['pace'],
    x: 40,
    y: 43,
    icon: 'plus',
    hook: 'capacity',
    description: '',
    detail: 'You said no to one thing today. That is one slot back.',
    effect: { capacityBonus: 1 },
  },
  {
    id: 'restStop',
    name: 'Room for two more things',
    tagline: 'Passive',
    category: 'passive',
    palette: PALETTES.passive,
    cost: 420,
    prerequisites: ['boundaries'],
    x: 47,
    y: 27,
    icon: 'plus',
    hook: 'capacity',
    description: '',
    detail: 'You stop and sit down halfway. Two more slots before you bust.',
    effect: { capacityBonus: 2 },
  },
  {
    id: 'rehearse',
    name: 'Practise what you will say',
    tagline: 'In the house',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 175,
    prerequisites: ['thisIsNormal'],
    x: 30,
    y: 66,
    icon: 'chat',
    hook: 'scheduledTechnique',
    description: '',
    detail: 'Use the mirror before you leave. Get it right and you can hold two more things today.',
    effect: {
      techniqueId: 'rehearsal',
      addedSeconds: 16,
      runCapacityBonus: 2,
      failureSpawnCount: 1,
    },
  },
  {
    id: 'plan',
    name: 'Pick up your things in order',
    tagline: 'In the house',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 125,
    prerequisites: ['rehearse'],
    x: 16,
    y: 54,
    icon: 'list',
    hook: 'scheduledTechnique',
    description: '',
    detail: 'Grab keys, wallet, phone and door in order. Then things arrive one at a time, not two at once.',
    effect: {
      techniqueId: 'plan',
      // The plan is a Morning activity now, so its window is the time the
      // player has at the checklist, not a slice carved out of the scored day.
      addedSeconds: 14,
      staggerPairs: 2,
      staggerDelaySeconds: 1,
    },
  },
  {
    id: 'stretch',
    name: 'Warm up before you go',
    tagline: 'In the house',
    category: 'preparation',
    palette: PALETTES.preparation,
    cost: 275,
    prerequisites: ['rehearse'],
    x: 19,
    y: 80,
    icon: 'stretch',
    hook: 'scheduledTechnique',
    description: '',
    detail: 'Loosen every joint on the body picture. Fewer aches turn up early in the walk.',
    effect: {
      techniqueId: 'stretch',
      addedSeconds: 16,
      holdSeconds: 0.8,
      thinChance: 0.5,
      windowSeconds: 12,
    },
  },
  {
    id: 'fasterCompletion',
    name: 'Finish things faster',
    tagline: 'Automatic',
    category: 'automatic',
    palette: PALETTES.automatic,
    cost: 150,
    prerequisites: ['autotarget'],
    x: 70,
    y: 30,
    icon: 'bolt',
    hook: 'microgameCompletionRate',
    description: '',
    detail: 'Every window clears half again as fast — whether or not you wanted to rush.',
    effect: { completionRateMultiplier: 1.5 },
  },
  {
    id: 'autotarget',
    name: 'Jump to the next window',
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
    detail: 'Clear one window and the keyboard moves to the next by itself. No re-clicking.',
    effect: {
      autotargetAfterClear: true,
      // App.jsx still performs a legacy getNode('hold') lookup. A zero value
      // keeps that lookup safe without restoring the rejected spawn delay.
      holdReleaseSeconds: 0,
    },
  },
  {
    id: 'adrenaline',
    name: 'Breathing room near the edge',
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
    detail: 'One slot from bust, nothing new turns up for a moment.',
    effect: { belowLimit: 1, pauseSeconds: 1 },
  },
  {
    id: 'suppress',
    name: 'Push it down, once',
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
    detail: 'The first time you would bust, mash Space to shove half of it away. Once a day.',
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
