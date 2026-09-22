// The Morning's state lives outside React because two different places need
// it: the interactable props, which are drawn inside the 3D Canvas, and the
// overlay that labels them and opens their windows. Threading it through App as
// props would make App own a screen it otherwise knows nothing about.
//
// Screen projections are deliberately NOT part of the reactive state: they are
// recomputed as the camera settles and would re-render the whole overlay every
// frame. They live in a plain mutable Map the label layer polls instead.

import { useSyncExternalStore } from 'react'
import {
  approachPose,
  resolveFloorTarget,
  spotById,
  standingPointFor,
  walkDurationMs,
} from './morningSpots.js'

let state = {
  // Where the player is walking, or standing: either a thing in the room
  // ({ type: 'spot' }) or a patch of floor they clicked ({ type: 'floor' }).
  focus: null,
  openId: null,
  doneIds: [],
  usedIds: [],
  hoverId: null,
}

const listeners = new Set()
let arrivalTimer = 0
let walkCounter = 0

function emit() {
  state = { ...state }
  for (const listener of listeners) listener()
}

export const morningProjections = new Map()

// Click-and-hold to look around. The drag handler piles up raw pixel deltas
// here and the camera consumes them each frame; keeping it out of React state
// means dragging does not re-render the overlay sixty times a second.
// `suppressClick` is set once a drag has travelled far enough to be a drag
// rather than a click, so letting go does not also walk you somewhere.
export const morningLook = { dx: 0, dy: 0, suppressClick: false, dragging: false }

export function resetMorningLook() {
  morningLook.dx = 0
  morningLook.dy = 0
  morningLook.suppressClick = false
  morningLook.dragging = false
}

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

function cancelArrival() {
  if (arrivalTimer) window.clearTimeout(arrivalTimer)
  arrivalTimer = 0
}

export function resetMorning() {
  cancelArrival()
  resetMorningLook()
  walkCounter = 0
  state = { focus: null, openId: null, doneIds: [], usedIds: [], hoverId: null }
  morningProjections.clear()
  emit()
}

// Walk to a thing and open it on arrival. Everything that can be clicked goes
// through here — the label over an object and the object itself — so a click
// never teleports the player into a window they have not walked to.
//
// `onArrive` lets the opening lesson use the walk without opening anything:
// it sends the player to the mirror and takes over once they are standing
// there.
export function requestMorningSpot(id, onArrive = null) {
  cancelArrival()
  const spot = spotById(id)
  const from = standingPointFor(state.focus)
  const pose = spot ? approachPose(spot) : null
  const to = pose ? [pose.position[0], pose.position[2]] : from
  walkCounter += 1
  state.focus = { type: 'spot', id, key: walkCounter }
  state.openId = null
  emit()
  // The walk is a real walk at a real speed, so how long it takes depends on
  // how far away the thing is. Opening on a fixed timer put the window up
  // while the player was still crossing the room.
  arrivalTimer = window.setTimeout(() => {
    arrivalTimer = 0
    if (onArrive) onArrive()
    else openMorningSpot(id)
  }, walkDurationMs(from, to))
}

// How long the walk to a thing will take from where the player is standing.
export function morningWalkDuration(id) {
  const spot = spotById(id)
  if (!spot) return 0
  const pose = approachPose(spot)
  return walkDurationMs(standingPointFor(state.focus), [pose.position[0], pose.position[2]])
}

// Walk to a patch of floor. Nothing opens; the player simply stands there.
export function walkToFloor(x, z) {
  const target = resolveFloorTarget(x, z)
  if (!target) return
  cancelArrival()
  walkCounter += 1
  state.focus = { type: 'floor', x: target.x, z: target.z, key: walkCounter }
  state.openId = null
  emit()
}

// Send the player back to the middle of the room (used when the opening lesson
// hands the room over, so they are not left nose-to-glass at the mirror).
export function resetMorningFocus() {
  cancelArrival()
  if (state.focus === null && state.openId === null) return
  state.focus = null
  state.openId = null
  emit()
}

export function openMorningSpot(id) {
  if (state.openId === id) return
  state.openId = id
  emit()
}

// Closing a window leaves the player standing where they walked to; only the
// window goes away.
export function closeMorningSpot() {
  cancelArrival()
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
