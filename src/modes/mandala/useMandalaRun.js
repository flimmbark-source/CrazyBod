import { useCallback, useRef, useState } from 'react'

import { MANDALA_CONFIG } from './mandalaConfig.js'
import { MANDALA_SCRIPT } from './mandalaScript.js'
import {
  MANDALA_PHASES,
  createMandalaRun,
  toTravelling,
  toOverloading,
  spawnEncounter,
  advanceMandala,
  resolveEncounter as resolveEncounterPure,
  activeLoad,
  travelSpeedFor,
} from './mandalaState.js'
import {
  createDirector,
  advanceDirector,
  currentSection,
  currentWave,
  currentEffects,
} from './mandalaDirector.js'

// Owns the Mandala run: the pure travel sim (mandalaState) AND the authored
// director (mandalaDirector) that decides who/when/how-many spawns per wave.
// Held in refs so the 60fps loop never forces React re-renders; a throttled
// sample surfaces HUD state (section/wave/effects/load/depth).
//
// Overload is NOT decided here. step() calls onOverload() when active load
// reaches the capacity the caller passes in, so the existing App/finishRun path
// stays the single authority.
export function useMandalaRun(config = MANDALA_CONFIG, script = MANDALA_SCRIPT) {
  const runRef = useRef(null)
  const directorRef = useRef(null)
  const overloadedRef = useRef(false)
  const sampleClockRef = useRef(0)
  const [sample, setSample] = useState(() => inactiveSample())

  const buildSample = useCallback(
    (run, phase) => {
      const director = directorRef.current
      const section = director ? currentSection(director, script) : null
      const wave = director ? currentWave(director, script) : null
      return {
        phase,
        activeCount: activeLoad(run),
        travelDistance: run.travelDistance,
        depth: run.maxDepth,
        sectionName: section?.name ?? '',
        sectionIndex: director?.sectionIndex ?? 0,
        waveIndex: director?.waveIndex ?? 0,
        waveCount: section?.waves?.length ?? 0,
        directorDone: director?.done ?? false,
        effects: director ? currentEffects(director, script) : { background: {}, perception: {}, interaction: {} },
      }
    },
    [script],
  )

  const enter = useCallback(() => {
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0
    runRef.current = toTravelling(createMandalaRun(config, seed))
    directorRef.current = createDirector(script)
    overloadedRef.current = false
    sampleClockRef.current = 0
    setSample(buildSample(runRef.current, MANDALA_PHASES.TRAVELLING))
  }, [config, script, buildSample])

  const exit = useCallback(() => {
    runRef.current = null
    directorRef.current = null
    overloadedRef.current = false
    setSample(inactiveSample())
  }, [])

  const resolveEncounter = useCallback((id) => {
    if (!runRef.current) return
    runRef.current = resolveEncounterPure(runRef.current, id)
  }, [])

  const step = useCallback(
    (deltaSeconds, { diving = false, capacity = Infinity, onOverload } = {}) => {
      const run = runRef.current
      const director = directorRef.current
      if (!run || overloadedRef.current) return run

      const travelSpeed = travelSpeedFor({ diving, config })
      const travelDelta = Math.max(0, travelSpeed) * Math.max(0, deltaSeconds)

      // Advance travel + encounter lifecycles.
      let next = advanceMandala(run, { deltaSeconds, travelSpeed, config })

      // Advance the director; place any spawns it releases this frame.
      let effectsChanged = false
      if (director && !director.done) {
        const result = advanceDirector(director, {
          deltaSeconds,
          travelDelta,
          totalKills: next.resolvedCount,
          script,
        })
        directorRef.current = result.director
        for (const kind of result.spawns) {
          next = spawnEncounter(next, { kind, config })
        }
        if (result.events.length > 0) effectsChanged = true
      }
      runRef.current = next

      const load = activeLoad(next)

      // Throttle the React-visible sample to ~15Hz, but push immediately on a
      // section/wave change so effects (background/perception) apply promptly.
      sampleClockRef.current += deltaSeconds
      if (effectsChanged || sampleClockRef.current >= 1 / 15) {
        sampleClockRef.current = 0
        setSample(buildSample(next, MANDALA_PHASES.TRAVELLING))
      }

      // Authoritative overload: reuse the caller's capacity rule, once.
      if (!overloadedRef.current && load >= capacity) {
        overloadedRef.current = true
        runRef.current = toOverloading(next)
        setSample(buildSample(next, MANDALA_PHASES.OVERLOADING))
        onOverload?.({ depth: next.maxDepth, resolvedCount: next.resolvedCount })
      }

      return runRef.current
    },
    [config, script, buildSample],
  )

  return { runRef, sample, enter, exit, resolveEncounter, step }
}

function inactiveSample() {
  return {
    phase: MANDALA_PHASES.INACTIVE,
    activeCount: 0,
    travelDistance: 0,
    depth: 0,
    sectionName: '',
    sectionIndex: 0,
    waveIndex: 0,
    waveCount: 0,
    directorDone: false,
    effects: { background: {}, perception: {}, interaction: {} },
  }
}
