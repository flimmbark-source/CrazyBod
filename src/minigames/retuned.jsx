import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Progress,
  clamp,
  keyDirection,
  shuffled,
  useAnimationFrame,
  useMicrogameKeys,
  useOnceResolve,
} from './shared.jsx'

const THOUGHT_ICONS = ['●', '▲', '◆', '✚', '■', '☾']

export function InterruptedThoughtGame({ onResolve }) {
  const sequence = useMemo(() => shuffled(THOUGHT_ICONS).slice(0, 3), [])
  const [phase, setPhase] = useState('study')
  const [index, setIndex] = useState(0)
  const [wrong, setWrong] = useState(false)
  const resolve = useOnceResolve(onResolve)

  useEffect(() => {
    if (phase !== 'study' && phase !== 'review') return undefined
    const nextPhase = phase === 'study' ? 'interrupt' : 'recall'
    const timer = window.setTimeout(() => setPhase(nextPhase), 850)
    return () => window.clearTimeout(timer)
  }, [phase])

  const recall = (icon) => {
    if (sequence[index] !== icon) {
      setWrong(true)
      setIndex(0)
      setPhase('review')
      window.setTimeout(() => setWrong(false), 180)
      return
    }

    const next = index + 1
    setIndex(next)
    if (next >= sequence.length) queueMicrotask(resolve)
  }

  const showingAnswer = phase === 'study' || phase === 'review'

  return (
    <div className={wrong ? 'new-minigame interrupted-game wrong' : 'new-minigame interrupted-game'}>
      {showingAnswer && (
        <>
          <small>{phase === 'review' ? 'HERE IT WAS' : 'KEEP THIS THOUGHT'}</small>
          <div className="thought-sequence">
            {sequence.map((icon) => <b key={icon}>{icon}</b>)}
          </div>
        </>
      )}

      {phase === 'interrupt' && (
        <div className="thought-popup">
          <strong>WAIT—DID YOU LOCK THE DOOR?</strong>
          <button type="button" onClick={() => setPhase('recall')}>CLOSE</button>
        </div>
      )}

      {phase === 'recall' && (
        <>
          <small>CONTINUE THE THOUGHT</small>
          <div className="thought-options">
            {THOUGHT_ICONS.map((icon) => (
              <button key={icon} type="button" onClick={() => recall(icon)}>{icon}</button>
            ))}
          </div>
          <Progress value={(index / sequence.length) * 100} />
        </>
      )}
    </div>
  )
}

export function PinsNeedlesGame({ onResolve }) {
  const targets = useMemo(
    () => shuffled(Array.from({ length: 9 }, (_, index) => index)).slice(0, 3),
    [],
  )
  const [showing, setShowing] = useState(true)
  const [selected, setSelected] = useState([])
  const [wrong, setWrong] = useState(null)
  const resolve = useOnceResolve(onResolve)

  useEffect(() => {
    if (!showing) return undefined
    const timer = window.setTimeout(() => setShowing(false), 850)
    return () => window.clearTimeout(timer)
  }, [showing])

  const choose = (index) => {
    if (showing || selected.includes(index)) return

    if (!targets.includes(index)) {
      setWrong(index)
      setSelected([])
      setShowing(true)
      window.setTimeout(() => setWrong(null), 180)
      return
    }

    const next = [...selected, index]
    setSelected(next)
    if (next.length >= targets.length) queueMicrotask(resolve)
  }

  return (
    <div className="new-minigame pins-game">
      <small>{showing ? 'WATCH THE FLASHES' : 'CLICK WHAT FLASHED'}</small>
      <div className="pins-grid">
        {Array.from({ length: 9 }, (_, index) => (
          <button
            key={index}
            type="button"
            className={`${showing && targets.includes(index) ? 'flash' : ''} ${selected.includes(index) ? 'selected' : ''} ${wrong === index ? 'wrong' : ''}`}
            onClick={() => choose(index)}
          />
        ))}
      </div>
      <Progress value={(selected.length / targets.length) * 100} />
    </div>
  )
}

export function DizzinessGame({ onResolve }) {
  const rootRef = useRef(null)
  const tiltRef = useRef(Math.random() > 0.5 ? 22 : -22)
  const heldRef = useRef(0)
  const steadyRef = useRef(0)
  const [tilt, setTilt] = useState(tiltRef.current)
  const [steady, setSteady] = useState(0)
  const resolve = useOnceResolve(onResolve)

  useMicrogameKeys(rootRef, {
    hint: 'A / D',
    onKeyDown: (event) => {
      const direction = keyDirection(event.code)
      if (!direction) return false
      heldRef.current = direction
      return true
    },
    onKeyUp: (event) => {
      const direction = keyDirection(event.code)
      if (!direction) return false
      if (heldRef.current === direction) heldRef.current = 0
      return true
    },
  })

  useAnimationFrame((_, delta) => {
    const pull = Math.sign(tiltRef.current || 1) * 0.012 * delta
    tiltRef.current = clamp(tiltRef.current + pull + heldRef.current * delta * 0.05, -28, 28)
    const level = Math.abs(tiltRef.current) < 6
    steadyRef.current = clamp(steadyRef.current + (level ? delta : -delta * 0.65), 0, 950)
    setTilt(tiltRef.current)
    setSteady(steadyRef.current)
    if (steadyRef.current >= 950) resolve()
  })

  const nudge = (amount) => {
    tiltRef.current = clamp(tiltRef.current + amount, -28, 28)
    setTilt(tiltRef.current)
  }

  return (
    <div ref={rootRef} className="new-minigame dizziness-game">
      <small>LEVEL THE HORIZON</small>
      <div className="horizon" style={{ transform: `rotate(${tilt}deg)` }}><i /></div>
      <div className="mini-button-row">
        <button type="button" onClick={() => nudge(-4)}>A</button>
        <button type="button" onClick={() => nudge(4)}>D</button>
      </div>
      <Progress value={(steady / 950) * 100} />
    </div>
  )
}

export function RacingHeartGame({ onResolve }) {
  const rootRef = useRef(null)
  const phaseRef = useRef(0)
  const [phase, setPhase] = useState(0)
  const [hits, setHits] = useState(0)
  const [miss, setMiss] = useState(false)
  const resolve = useOnceResolve(onResolve)

  useAnimationFrame((now) => {
    phaseRef.current = (now % 820) / 820
    setPhase(phaseRef.current)
  })

  const tap = () => {
    const good = phaseRef.current < 0.22 || phaseRef.current > 0.78
    if (!good) {
      setMiss(true)
      setHits((current) => Math.max(0, current - 1))
      window.setTimeout(() => setMiss(false), 150)
      return
    }

    setHits((current) => {
      const next = current + 1
      if (next >= 4) queueMicrotask(resolve)
      return next
    })
  }

  useMicrogameKeys(rootRef, {
    hint: 'TAP SPACE ON THE BEAT',
    onKeyDown: (event) => {
      if (event.code !== 'Space' || event.repeat) return false
      tap()
      return true
    },
  })

  const pulse = 1 + Math.sin(phase * Math.PI * 2) * 0.18

  return (
    <div ref={rootRef} className={miss ? 'new-minigame heart-game miss' : 'new-minigame heart-game'}>
      <small>TAP WITH THE BEAT</small>
      <button type="button" className="heart" style={{ transform: `scale(${pulse})` }} onClick={tap}>♥</button>
      <div className="beat-pips">
        {Array.from({ length: 4 }).map((_, index) => <i key={index} className={index < hits ? 'hit' : ''} />)}
      </div>
    </div>
  )
}
