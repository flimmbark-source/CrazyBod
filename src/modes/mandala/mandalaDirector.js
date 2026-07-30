// Pure Mandala director: runs the authored script (mandalaScript.js). It owns a
// cursor into sections/waves, schedules each wave's spawns over time, and
// advances waves when their trigger fires. No React, no DOM, no Three — the
// whole wave structure is exercised by `node --test`.
//
// The run hook drives it each frame: it calls advanceDirector(), places any
// returned spawn kinds as encounters flying down the tube, and reads
// currentEffects() to drive the background / perception / interaction changes.

import { MANDALA_SCRIPT } from './mandalaScript.js'

export function buildSchedule(wave) {
  const schedule = []
  for (const spec of wave?.spawns ?? []) {
    const start = spec.delaySeconds ?? 0
    const stagger = spec.staggerSeconds ?? 0
    const count = Math.max(1, spec.count ?? 1)
    for (let i = 0; i < count; i += 1) {
      schedule.push({ kind: spec.kind, at: start + i * stagger })
    }
  }
  schedule.sort((a, b) => a.at - b.at)
  return schedule
}

export function createDirector(script = MANDALA_SCRIPT) {
  const wave = script.sections?.[0]?.waves?.[0]
  return {
    sectionIndex: 0,
    waveIndex: 0,
    waveElapsed: 0,
    waveDistance: 0,
    schedule: wave ? buildSchedule(wave) : [],
    released: 0,
    killsAtWaveStart: 0,
    clearedAtWaveStart: 0,
    done: !wave,
  }
}

export function currentSection(director, script = MANDALA_SCRIPT) {
  return script.sections?.[director.sectionIndex] ?? null
}

export function currentWave(director, script = MANDALA_SCRIPT) {
  return currentSection(director, script)?.waves?.[director.waveIndex] ?? null
}

export function currentEffects(director, script = MANDALA_SCRIPT) {
  const section = currentSection(director, script)
  const wave = currentWave(director, script)
  const s = section?.effects ?? {}
  const w = wave?.effects ?? {}
  return {
    background: { ...(s.background ?? {}), ...(w.background ?? {}) },
    perception: { ...(s.perception ?? {}), ...(w.perception ?? {}) },
    interaction: { ...(s.interaction ?? {}), ...(w.interaction ?? {}) },
  }
}

function nextIndices(director, script) {
  const section = script.sections[director.sectionIndex]
  if (director.waveIndex + 1 < section.waves.length) {
    return { sectionIndex: director.sectionIndex, waveIndex: director.waveIndex + 1 }
  }
  if (director.sectionIndex + 1 < script.sections.length) {
    return { sectionIndex: director.sectionIndex + 1, waveIndex: 0 }
  }
  return null
}

function triggerMet(director, wave, killsThisWave, clearedThisWave) {
  const trigger = wave.advance ?? { type: 'cleared' }
  switch (trigger.type) {
    case 'timer':
      return director.waveElapsed >= (trigger.seconds ?? 0)
    case 'distance':
      return director.waveDistance >= (trigger.distance ?? 0)
    case 'kills':
      return killsThisWave >= (trigger.count ?? 0)
    case 'cleared':
    default:
      // A passed encounter is finished for wave progression even though it was
      // not killed; its consequence is carried separately as overload.
      return director.released >= director.schedule.length && clearedThisWave >= director.schedule.length
  }
}

export function advanceDirector(
  director,
  {
    deltaSeconds = 0,
    travelDelta = 0,
    totalKills = 0,
    totalCleared = totalKills,
    script = MANDALA_SCRIPT,
  } = {},
) {
  if (director.done) return { director, spawns: [], events: [] }
  const wave = currentWave(director, script)
  if (!wave) return { director: { ...director, done: true }, spawns: [], events: [{ type: 'complete' }] }

  const waveElapsed = director.waveElapsed + deltaSeconds
  const waveDistance = director.waveDistance + travelDelta
  let released = director.released
  const spawns = []
  while (released < director.schedule.length && director.schedule[released].at <= waveElapsed) {
    spawns.push(director.schedule[released].kind)
    released += 1
  }

  const working = { ...director, waveElapsed, waveDistance, released }
  const killsThisWave = totalKills - director.killsAtWaveStart
  const clearedThisWave = totalCleared - director.clearedAtWaveStart

  if (triggerMet(working, wave, killsThisWave, clearedThisWave)) {
    const next = nextIndices(working, script)
    if (!next) {
      return { director: { ...working, done: true }, spawns, events: [{ type: 'complete' }] }
    }
    const nextWave = script.sections[next.sectionIndex].waves[next.waveIndex]
    const events = []
    if (next.sectionIndex !== director.sectionIndex) {
      events.push({ type: 'section', sectionIndex: next.sectionIndex })
    }
    events.push({ type: 'wave', sectionIndex: next.sectionIndex, waveIndex: next.waveIndex })
    return {
      director: {
        ...working,
        sectionIndex: next.sectionIndex,
        waveIndex: next.waveIndex,
        waveElapsed: 0,
        waveDistance: 0,
        schedule: buildSchedule(nextWave),
        released: 0,
        killsAtWaveStart: totalKills,
        clearedAtWaveStart: totalCleared,
      },
      spawns,
      events,
    }
  }

  return { director: working, spawns, events: [] }
}
