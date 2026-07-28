import { useCallback, useRef, useState } from 'react'

import { MANDALA_CONFIG } from './mandalaConfig.js'
import {
  MANDALA_PHASES,
  createMandalaRun,
  toTravelling,
  toOverloading,
  advanceMandala,
  resolveEncounter as resolveEncounterPure,
  activeLoad,
  travelSpeedFor,
} from './mandalaState.js'

// Owns the Mandala travel simulation for the mode. The simulation itself is the
// pure reducer in mandalaState.js; this hook holds it in a ref (so the 60fps
// frame loop never forces React re-renders), advances it from MandalaScene's
// useFrame via step(), and surfaces a throttled sample for HUD + overload.
//
// Overload is NOT decided here. step() calls onOverload() when active load
// reaches the capacity the caller passes in, so the existing App/finishRun path
// stays the single authority.
export function useMandalaRun(config = MANDALA_CONFIG) {
  const runRef = useRef(null)
  const overloadedRef = useRef(false)
  const sampleClockRef = useRef(0)
  const [sample, setSample] = useState({
    phase: MANDALA_PHASES.INACTIVE,
    activeCount: 0,
    travelDistance: 0,
    depth: 0,
  })

  const enter = useCallback(() => {
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0
    runRef.current = toTravelling(createMandalaRun(config, seed))
    overloadedRef.current = false
    sampleClockRef.current = 0
    setSample({ phase: MANDALA_PHASES.TRAVELLING, activeCount: 0, travelDistance: 0, depth: 0 })
  }, [config])

  const exit = useCallback(() => {
    runRef.current = null
    overloadedRef.current = false
    setSample({ phase: MANDALA_PHASES.INACTIVE, activeCount: 0, travelDistance: 0, depth: 0 })
  }, [])

  const resolveEncounter = useCallback((id) => {
    if (!runRef.current) return
    runRef.current = resolveEncounterPure(runRef.current, id)
  }, [])

  // Advance one frame. `diving` and `capacity` are read live from the caller.
  // Returns the current run for imperative rendering. Freezes once overloaded.
  const step = useCallback(
    (deltaSeconds, { diving = false, capacity = Infinity, onOverload } = {}) => {
      const run = runRef.current
      if (!run || overloadedRef.current) return run

      const travelSpeed = travelSpeedFor({ diving, config })
      const next = advanceMandala(run, { deltaSeconds, travelSpeed, config })
      runRef.current = next

      const load = activeLoad(next)

      // Throttle the React-visible sample to ~15Hz; the ref stays frame-exact.
      sampleClockRef.current += deltaSeconds
      if (sampleClockRef.current >= 1 / 15) {
        sampleClockRef.current = 0
        setSample({
          phase: overloadedRef.current ? MANDALA_PHASES.OVERLOADING : MANDALA_PHASES.TRAVELLING,
          activeCount: load,
          travelDistance: next.travelDistance,
          depth: next.maxDepth,
        })
      }

      // Authoritative overload: reuse the caller's capacity rule, once.
      if (!overloadedRef.current && load >= capacity) {
        overloadedRef.current = true
        runRef.current = toOverloading(next)
        setSample({
          phase: MANDALA_PHASES.OVERLOADING,
          activeCount: load,
          travelDistance: next.travelDistance,
          depth: next.maxDepth,
        })
        onOverload?.({ depth: next.maxDepth, resolvedCount: next.resolvedCount })
      }

      return runRef.current
    },
    [config],
  )

  return { runRef, sample, enter, exit, resolveEncounter, step }
}
