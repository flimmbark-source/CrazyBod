import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSchedule,
  createDirector,
  advanceDirector,
  currentSection,
  currentWave,
  currentEffects,
} from '../src/modes/mandala/mandalaDirector.js'

// A small self-contained script exercising every trigger type + effects.
const SCRIPT = {
  sections: [
    {
      id: 's1',
      name: 'ONE',
      effects: { background: { color: '#111' }, interaction: { twistScale: 1 } },
      waves: [
        { id: 's1w1', spawns: [{ kind: 'a', count: 3, staggerSeconds: 1 }], advance: { type: 'cleared' } },
        { id: 's1w2', spawns: [{ kind: 'b', count: 2, staggerSeconds: 2 }], advance: { type: 'timer', seconds: 5 } },
      ],
    },
    {
      id: 's2',
      name: 'TWO',
      effects: { background: { color: '#222' }, perception: { invertPointerX: true } },
      waves: [
        { id: 's2w1', spawns: [{ kind: 'c', count: 2, staggerSeconds: 1 }], advance: { type: 'kills', count: 2 } },
      ],
    },
  ],
}

function step(director, opts) {
  return advanceDirector(director, { script: SCRIPT, ...opts })
}

test('buildSchedule expands specs into staggered release times', () => {
  const schedule = buildSchedule({ spawns: [{ kind: 'a', count: 3, staggerSeconds: 1 }] })
  assert.deepEqual(schedule.map((s) => s.at), [0, 1, 2])
  assert.ok(schedule.every((s) => s.kind === 'a'))
})

test('a fresh director starts at section 0, wave 0', () => {
  const d = createDirector(SCRIPT)
  assert.equal(d.sectionIndex, 0)
  assert.equal(d.waveIndex, 0)
  assert.equal(currentSection(d, SCRIPT).id, 's1')
  assert.equal(currentWave(d, SCRIPT).id, 's1w1')
})

test('spawns are released on their stagger schedule (not all at once)', () => {
  let d = createDirector(SCRIPT)
  let r = step(d, { deltaSeconds: 0.5, totalKills: 0 })
  assert.deepEqual(r.spawns, ['a']) // first at t=0
  d = r.director
  r = step(d, { deltaSeconds: 0.6, totalKills: 0 }) // t=1.1 -> release 2nd
  assert.deepEqual(r.spawns, ['a'])
  d = r.director
  r = step(d, { deltaSeconds: 1.0, totalKills: 0 }) // t=2.1 -> release 3rd
  assert.deepEqual(r.spawns, ['a'])
  d = r.director
  r = step(d, { deltaSeconds: 1.0, totalKills: 0 }) // nothing left to release
  assert.deepEqual(r.spawns, [])
})

test("a 'cleared' wave advances only once every spawn is released and killed", () => {
  let d = createDirector(SCRIPT)
  // Release all 3, no kills yet -> stays on wave 0.
  let r = step(d, { deltaSeconds: 3, totalKills: 0 })
  d = r.director
  assert.equal(d.waveIndex, 0)
  // Kill 2 of 3 -> still wave 0.
  r = step(d, { deltaSeconds: 0.1, totalKills: 2 })
  d = r.director
  assert.equal(d.waveIndex, 0)
  // Kill the 3rd -> advance to wave 1, event emitted.
  r = step(d, { deltaSeconds: 0.1, totalKills: 3 })
  assert.ok(r.events.some((e) => e.type === 'wave'))
  assert.equal(r.director.waveIndex, 1)
})

test("a 'timer' wave advances after its seconds elapse", () => {
  // Jump straight to wave 1 (timer 5s) by clearing wave 0.
  let d = createDirector(SCRIPT)
  d = step(d, { deltaSeconds: 3, totalKills: 0 }).director
  d = step(d, { deltaSeconds: 0.1, totalKills: 3 }).director // -> wave 1
  assert.equal(d.waveIndex, 1)
  const before = step(d, { deltaSeconds: 4, totalKills: 3 })
  assert.equal(before.director.waveIndex, 1) // not yet (4 < 5)
  const after = step(before.director, { deltaSeconds: 2, totalKills: 3 }) // 6 >= 5
  // wave 1 was the last wave of section 1 -> advances into section 2
  assert.ok(after.events.some((e) => e.type === 'section'))
  assert.equal(after.director.sectionIndex, 1)
})

test("a 'kills' wave advances after enough kills, and the run completes at the end", () => {
  // Fast-forward to section 2 wave 0 (kills:2).
  let d = createDirector(SCRIPT)
  d = step(d, { deltaSeconds: 3, totalKills: 0 }).director
  d = step(d, { deltaSeconds: 0.1, totalKills: 3 }).director // section1 wave1
  d = step(d, { deltaSeconds: 6, totalKills: 3 }).director // -> section2 wave0
  assert.equal(d.sectionIndex, 1)
  // Need 2 kills within this wave (killsAtWaveStart was 3).
  let r = step(d, { deltaSeconds: 1, totalKills: 4 })
  assert.equal(r.director.done, false)
  r = step(r.director, { deltaSeconds: 1, totalKills: 5 }) // 2 kills this wave -> last wave -> complete
  assert.ok(r.events.some((e) => e.type === 'complete'))
  assert.equal(r.director.done, true)
})

test('a done director produces no more spawns or events', () => {
  const done = { ...createDirector(SCRIPT), done: true }
  const r = step(done, { deltaSeconds: 10, totalKills: 99 })
  assert.deepEqual(r.spawns, [])
  assert.deepEqual(r.events, [])
})

test('effects merge section + wave, wave winning', () => {
  const d = createDirector(SCRIPT)
  const eff = currentEffects(d, SCRIPT)
  assert.equal(eff.background.color, '#111')
  assert.equal(eff.interaction.twistScale, 1)
  // Section 2 turns on inverted aim.
  const d2 = { ...d, sectionIndex: 1, waveIndex: 0 }
  assert.equal(currentEffects(d2, SCRIPT).perception.invertPointerX, true)
})
