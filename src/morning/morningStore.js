// The Morning's state lives outside React because two different places need
// it: the interactable props, which are drawn inside the 3D Canvas, and the
// overlay that labels them and opens their windows. Threading it through App as
// props would make App own a screen it otherwise knows nothing about.
//
// Screen projections are deliberately NOT part of the reactive state: they are
// recomputed as the camera settles and would re-render the whole overlay every
// frame. They live in a plain mutable Map the label layer polls instead.

import { useSyncExternalStore } from 'react'

let state = {
  openId: null,
  doneIds: [],
  usedIds: [],
  hoverId: null,
}

const listeners = new Set()

function emit() {
  state = { ...state }
  for (const listener of listeners) listener()
}

export const morningProjections = new Map()

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getMorningState() {
  return state
}

export function useMorningState() {
  return useSyncExternalStore(subscribe, getMorningState, getMorningState)
}

export function resetMorning() {
  state = { openId: null, doneIds: [], usedIds: [], hoverId: null }
  morningProjections.clear()
  emit()
}

export function openMorningSpot(id) {
  if (state.openId === id) return
  state.openId = id
  emit()
}

export function closeMorningSpot() {
  if (state.openId === null) return
  state.openId = null
  emit()
}

export function markMorningDone(id) {
  if (state.doneIds.includes(id)) return
  state.doneIds = [...state.doneIds, id]
  emit()
}

export function markMorningUsed(id) {
  if (state.usedIds.includes(id)) return
  state.usedIds = [...state.usedIds, id]
  emit()
}

export function setMorningHover(id) {
  if (state.hoverId === id) return
  state.hoverId = id
  emit()
}
