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
    cost: 50,
    parent: null,
    x: 46,
    y: 50,
    icon: 'plus',
    hook: 'capacity',
    description: 'Increase the Overload limit by 1.',
    detail:
      'The day begins at 5 capacity. Establishing this baseline restores the '
      + 'familiar limit of 6. Disabling it returns you to 5.',
    effect: { capacityBonus: 1 },
  },
  {
    id: 'rehearse',
    name: 'REHEARSE THE CONVERSATION',
    tagline: 'Getting Ready · Adds 5s',
    cost: 175,
    parent: 'thisIsNormal',
    x: 31,
    y: 33,
    icon: 'chat',
    hook: 'scheduledTechnique',
    description: 'Complete the rehearsal to gain +1 Overload limit for the rest of the run.',
    detail: 'A wrong answer or timeout spawns 2 minigames.',
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
    tagline: 'Getting Ready · Adds 4s',
    cost: 325,
    parent: 'rehearse',
    x: 18,
    y: 18,
    icon: 'list',
    hook: 'scheduledTechnique',
    description: 'Complete the sequence to stagger the next 2 double spawns.',
    detail: 'The second minigame of each pair spawns 3 seconds later.',
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
    tagline: 'Automatic · Once per run',
    cost: 225,
    parent: 'thisIsNormal',
    x: 57,
    y: 68,
    icon: 'hold',
    hook: 'onSpawnAttempt',
    description: 'The first minigame that would fill the last open Overload slot is held back.',
    detail: 'It spawns when a slot opens or after 5 seconds.',
    effect: { holdReleaseSeconds: 5 },
  },
  {
    id: 'adrenaline',
    name: 'RUN ON ADRENALINE',
    tagline: 'Automatic · Once per run',
    cost: 425,
    parent: 'hold',
    x: 74,
    y: 58,
    icon: 'bolt',
    hook: 'onLoadChanged',
    description: 'At 1 below the Overload limit, stop new minigames from spawning for 6 seconds.',
    detail: 'Active minigames stay on screen.',
    effect: { belowLimit: 1, pauseSeconds: 6 },
  },
  {
    id: 'suppress',
    name: 'SUPPRESS VISIBLE DISTRESS',
    tagline: 'Automatic · Once per run',
    cost: 650,
    parent: 'adrenaline',
    x: 87,
    y: 77,
    icon: 'shield',
    hook: 'onBeforeOverload',
    description: 'When you would Overload, mash Space to suppress half of the active minigames.',
    detail: 'Suppressed minigames do not count as cleared.',
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
