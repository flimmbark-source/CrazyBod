import { useCallback, useEffect, useState } from 'react'

import {
  loadProgression,
  saveProgression,
  purchaseNode as purchaseNodeReducer,
  toggleNode as toggleNodeReducer,
  depositRun as depositRunReducer,
  resetTree as resetTreeReducer,
  resetFullState,
  clearTutorialFlag,
} from './progressionStore.js'

// React binding for the progression store. The store holds all the logic; this
// hook only owns the state cell and persists it on change.
export function useProgression() {
  const [progression, setProgression] = useState(() => loadProgression())

  useEffect(() => {
    saveProgression(progression)
  }, [progression])

  const purchaseNode = useCallback((nodeId) => {
    setProgression((state) => purchaseNodeReducer(state, nodeId))
  }, [])

  const toggleNode = useCallback((nodeId, enabled) => {
    setProgression((state) => toggleNodeReducer(state, nodeId, enabled))
  }, [])

  const depositRun = useCallback((payload) => {
    setProgression((state) => depositRunReducer(state, payload))
  }, [])

  const resetTree = useCallback(() => {
    setProgression((state) => resetTreeReducer(state))
  }, [])

  const resetFull = useCallback(() => {
    clearTutorialFlag()
    setProgression(resetFullState())
  }, [])

  return { progression, purchaseNode, toggleNode, depositRun, resetTree, resetFull }
}
