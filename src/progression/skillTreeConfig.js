// Skill tree definition. Everything the progression system and the effect
// engine need is data here, so tuning a cost, a trigger time or a press
// requirement never means touching component logic.
//
// Coordinates are authored on a 0-100 grid (percent of the tree canvas, y
// increasing downward). Six nodes do not justify a layout library, and fixed
// coordinates keep responsive behaviour under our control.

export const STARTING_NODE_ID = 'thisIsNormal'

export const SKILL_TREE_NODES = [
  {
    id: 'thisIsNormal',
    name: 'THIS IS NORMAL',
    tagline: 'Passive',
    category: 'passive',
    cost: 50,
    parent: null,
    x: 46,
    y: 50,
    icon: 'plus',
    hook: 'capacity',
    description: 'Increase the Overload limit by 1.',
    detail:
      '',
    effect: { capacityBonus: 1 },
  },
  {
    id: 'rehearse',
    name: 'REHEARSE THE CONVERSATION',
    tagline: 'Getting Ready · +5s',
    category: 'gettingReady',
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
    category: 'gettingReady',
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
    id: 'hold',
    name: 'HOLD IT TOGETHER',
    tagline: 'Automatic · Passive',
    category: 'automatic',
    cost: 225,
    parent: 'thisIsNormal',
    x: 57,
    y: 68,
    icon: 'target',
    hook: 'autoTarget',
    description: 'Autotarget the next minigame after a Clear.',
    detail: 'Clearing a minigame hands the keyboard to the next one, no click needed.',
    effect: { autoTarget: true },
  },
  {
    id: 'adrenaline',
    name: 'RUN ON ADRENALINE',
    tagline: 'Automatic · Once per run',
    category: 'automatic',
    cost: 425,
    parent: 'hold',
    x: 74,
    y: 58,
    icon: 'bolt',
    hook: 'onLoadChanged',
    description: '+6s Spawn delay (10%)',
    detail: '10% to pause spawning for 6 seconds.',
    effect: { belowLimit: 1, pauseSeconds: 6 },
  },
  {
    id: 'suppress',
    name: 'SUPPRESS VISIBLE DISTRESS',
    tagline: 'Automatic · Once per run',
    category: 'automatic',
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

export const SKILL_TREE_NODES_BY_ID = Object.fromEntries(
  SKILL_TREE_NODES.map((node) => [node.id, node]),
)

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
