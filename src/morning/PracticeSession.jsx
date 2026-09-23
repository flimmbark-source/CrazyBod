import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MICROGAME_NAMES } from '../minigames/catalog.jsx'
import { MicrogameWindow, positionFor } from '../minigames/window.jsx'
import OverloadMeter from '../ui/OverloadMeter.jsx'
import { useT } from '../i18n/i18n.js'
import { practiceScript } from './practiceConfig.js'

// A practice is a short run of the day's real minigames, in the day's real
// windows, with the day's real overload meter when it can be lost. It is not a
// lookalike: the components, the chrome and the geometry are the ones App
// spawns, imported rather than reimplemented.

const ALL_KINDS = Object.keys(MICROGAME_NAMES)

function shuffled(list, seed) {
  const out = list.slice()
  let state = seed >>> 0
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// The kinds this practice will throw, in the order it will throw them.
function buildQueue(script, seed) {
  const pool = script.kinds ?? shuffled(ALL_KINDS, seed)
  const queue = []
  for (let i = 0; i < script.count; i += 1) queue.push(pool[i % pool.length])
  return queue
}

export default function PracticeSession({ id, name, onPass, onFail, onLeave }) {
  const t = useT()
  const script = useMemo(() => practiceScript(id), [id])
  const seed = useMemo(() => (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0, [id])
  const queue = useMemo(() => (script ? buildQueue(script, seed) : []), [script, seed])

  const [games, setGames] = useState([])
  const [spawned, setSpawned] = useState(0)
  const [cleared, setCleared] = useState(0)
  const [outcome, setOutcome] = useState(null)
  const gamesRef = useRef([])
  const counterRef = useRef(0)
  const resolvedRef = useRef(new Set())

  const capacity = script?.capacity ?? null
  const canFail = capacity != null
  const load = games.length

  const spawn = useCallback((kind) => {
    const index = counterRef.current
    counterRef.current += 1
    const game = {
      id: `practice-${id}-${index}`,
      kind,
      position: positionFor(seed, index, gamesRef.current),
    }
    setGames((current) => {
      const next = [...current, game]
      gamesRef.current = next
      return next
    })
  }, [id, seed])

  // Arrivals. They stop once the practice is over, and once everything the
  // script owes has been thrown.
  useEffect(() => {
    if (!script || outcome) return undefined
    if (spawned >= queue.length) return undefined
    const perWave = script.pairs ? 2 : 1
    // The first wave lands almost at once, so opening a practice does not begin
    // with an empty screen and a wait.
    const delay = spawned === 0 ? 700 : script.interval * 1000
    const timer = window.setTimeout(() => {
      const wave = queue.slice(spawned, spawned + perWave)
      wave.forEach(spawn)
      setSpawned(spawned + wave.length)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [script, queue, spawned, outcome, spawn])

  const resolve = useCallback((gameId) => {
    if (resolvedRef.current.has(gameId)) return
    resolvedRef.current.add(gameId)
    setGames((current) => {
      const next = current.filter((game) => game.id !== gameId)
      gamesRef.current = next
      return next
    })
    setCleared((n) => n + 1)
  }, [])

  // Losing: only the practice that has a capacity can be lost, and it is lost
  // the moment the meter fills, exactly as the day is.
  useEffect(() => {
    if (!canFail || outcome) return
    if (load >= capacity) setOutcome('failed')
  }, [canFail, capacity, load, outcome])

  // Passing: everything the script owed has arrived and been answered.
  useEffect(() => {
    if (outcome || !script) return
    if (spawned >= queue.length && cleared >= queue.length) setOutcome('passed')
  }, [outcome, script, spawned, queue.length, cleared])

  const finishedRef = useRef(false)
  useEffect(() => {
    if (!outcome || finishedRef.current) return undefined
    finishedRef.current = true
    const timer = window.setTimeout(() => {
      if (outcome === 'passed') onPass?.(id)
      else onFail?.(id)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [outcome, id, onPass, onFail])

  if (!script) return null

  const left = Math.max(0, queue.length - cleared)

  return (
    <section
      className={`practice-session${outcome ? ` is-${outcome}` : ''}`}
      aria-label={name}
      dir="ltr"
    >
      <header className="practice-session-bar">
        <div className="practice-session-what">
          <span>{t('morning.practiceTag')}</span>
          <strong>{name}</strong>
        </div>
        {canFail ? (
          <OverloadMeter load={load} capacity={capacity} />
        ) : (
          <div className="practice-session-count">
            <span>{t('practice.left')}</span>
            <strong>{left}</strong>
          </div>
        )}
        <button type="button" className="practice-session-leave" onClick={() => onLeave?.(id)}>
          {t('morning.leaveIt')}
        </button>
      </header>

      <div className="practice-session-board">
        {games.map((game, index) => (
          <MicrogameWindow
            key={game.id}
            game={game}
            index={index}
            load={load}
            onResolve={resolve}
            frozen={Boolean(outcome)}
          />
        ))}
      </div>

      {outcome && (
        <div className="practice-session-verdict" role="status" aria-live="polite">
          <strong>{outcome === 'passed' ? t('practice.passed') : t('practice.failed')}</strong>
          <em>{outcome === 'passed' ? t('practice.passedBody') : t('practice.failedBody')}</em>
        </div>
      )}
    </section>
  )
}
