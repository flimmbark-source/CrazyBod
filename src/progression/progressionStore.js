import { SKILL_NODES, STARTING_NODE_ID } from './skillTreeConfig.js'

export const PROGRESS_STORAGE_KEY = 'crazybod:progress-v1'
export const PROGRESS_VERSION = 1

export function createDefaultProgress() {
  return {
    version: PROGRESS_VERSION,
    bank: 0,
    treeUnlocked: false,
    purchasedNodeIds: [],
    revealedNodeIds: [STARTING_NODE_ID],
    enabledNodeIds: [],
    completedRuns: 0,
    highScore: 0,
  }
}

function uniqueKnownNodes(values) {
  return [...new Set(Array.isArray(values) ? values : [])].filter((id) => SKILL_NODES[id])
}

export function normalizeProgress(value) {
  const fallback = createDefaultProgress()
  if (!value || typeof value !== 'object') return fallback

  const purchasedNodeIds = uniqueKnownNodes(value.purchasedNodeIds)
  const revealedNodeIds = uniqueKnownNodes([
    STARTING_NODE_ID,
    ...purchasedNodeIds,
    ...(Array.isArray(value.revealedNodeIds) ? value.revealedNodeIds : []),
  ])
  const enabledNodeIds = uniqueKnownNodes(value.enabledNodeIds)
    .filter((id) => purchasedNodeIds.includes(id))

  return {
    version: PROGRESS_VERSION,
    bank: Math.max(0, Math.floor(Number(value.bank) || 0)),
    treeUnlocked: Boolean(value.treeUnlocked),
    purchasedNodeIds,
    revealedNodeIds,
    enabledNodeIds,
    completedRuns: Math.max(0, Math.floor(Number(value.completedRuns) || 0)),
    highScore: Math.max(0, Math.floor(Number(value.highScore) || 0)),
  }
}

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
    return raw ? normalizeProgress(JSON.parse(raw)) : createDefaultProgress()
  } catch {
    return createDefaultProgress()
  }
}

export function saveProgress(progress) {
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(normalizeProgress(progress)))
  } catch {
    // Progress still works for the current session if storage is unavailable.
  }
}

export function purchaseNode(progress, nodeId) {
  const node = SKILL_NODES[nodeId]
  if (!node) return progress
  if (!progress.revealedNodeIds.includes(nodeId)) return progress
  if (progress.purchasedNodeIds.includes(nodeId)) return progress
  if (progress.bank < node.cost) return progress
  if (!node.parents.every((parentId) => progress.purchasedNodeIds.includes(parentId))) return progress

  return normalizeProgress({
    ...progress,
    bank: progress.bank - node.cost,
    purchasedNodeIds: [...progress.purchasedNodeIds, nodeId],
    enabledNodeIds: [...progress.enabledNodeIds, nodeId],
    revealedNodeIds: [...progress.revealedNodeIds, ...node.children],
  })
}

export function toggleNode(progress, nodeId) {
  if (!progress.purchasedNodeIds.includes(nodeId)) return progress
  const enabled = progress.enabledNodeIds.includes(nodeId)
  return normalizeProgress({
    ...progress,
    enabledNodeIds: enabled
      ? progress.enabledNodeIds.filter((id) => id !== nodeId)
      : [...progress.enabledNodeIds, nodeId],
  })
}

export function resetSkillTree(progress) {
  return normalizeProgress({
    ...progress,
    purchasedNodeIds: [],
    enabledNodeIds: [],
    revealedNodeIds: [STARTING_NODE_ID],
  })
}
