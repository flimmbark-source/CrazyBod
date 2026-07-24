import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Progress,
  clamp,
  shuffled,
  useAnimationFrame,
  useMicrogameKeys,
  useOnceResolve,
} from './shared.jsx'

const MEMORY_KEYS = ['A', 'D', 'W', 'S']
const KEY_CODES = { A: 'KeyA', D: 'KeyD', W: 'KeyW', S: 'KeyS' }

export function WorkingMemoryGame({ onResolve }) {
  const rootRef = useRef(null)
  const sequence = useMemo(() => shuffled(MEMORY_KEYS).slice(0, 3), [])
  const [showing, setShowing] = useState(true)
  const [index, setIndex] = useState(0)
  const resolve = useOnceResolve(onResolve)

  useEffect(() => {
    if (!showing) return undefined
    const timer = window.setTimeout(() => setShowing(false), 850)
    return () => window.clearTimeout(timer)
  }, [showing])

  const press = (key) => {
    if (showing) return
    if (sequence[index] !== key) {
      setIndex(0)
      setShowing(true)
      return
    }
    const next = index + 1
    setIndex(next)
    if (next >= sequence.length) queueMicrotask(resolve)
  }

  useMicrogameKeys(rootRef, {
    hint: 'REMEMBER THE KEYS',
    onKeyDown: (event) => {
      const key = Object.entries(KEY_CODES).find(([, code]) => code === event.code)?.[0]
      if (!key || event.repeat) return false
      press(key)
      return true
    },
  })

  return (
    <div ref={rootRef} className="new-minigame memory-game">
      <small>{showing ? 'REMEMBER' : 'REPEAT'}</small>
      <div className="memory-sequence">
        {sequence.map((key, keyIndex) => (
          <b key={keyIndex} className={!showing && keyIndex >= index ? 'hidden' : ''}>{showing ? key : keyIndex < index ? '✓' : '?'}</b>
        ))}
      </div>
      <div className="memory-keys">
        {MEMORY_KEYS.map((key) => <button key={key} type="button" onClick={() => press(key)}>{key}</button>)}
      </div>
      <Progress value={(index / sequence.length) * 100} />
    </div>
  )
}

const SWITCH_ITEMS = [
  { color: 'red', shape: 'circle' },
  { color: 'blue', shape: 'triangle' },
  { color: 'red', shape: 'square' },
  { color: 'gold', shape: 'circle' },
  { color: 'blue', shape: 'square' },
  { color: 'gold', shape: 'triangle' },
]

export function TaskSwitchingGame({ onResolve }) {
  const [step, setStep] = useState(0)
  const [offset, setOffset] = useState(0)
  const [mistake, setMistake] = useState(false)
  const resolve = useOnceResolve(onResolve)
  const rule = step < 2
    ? { property: 'color', target: 'red', label: 'CLICK RED' }
    : { property: 'shape', target: 'triangle', label: 'NOW: TRIANGLES' }
  const items = SWITCH_ITEMS.map((_, index) => SWITCH_ITEMS[(index + offset) % SWITCH_ITEMS.length])

  const choose = (item) => {
    if (item[rule.property] !== rule.target) {
      setMistake(true)
      window.setTimeout(() => setMistake(false), 180)
      setStep((current) => Math.max(0, current - 1))
      return
    }
    setOffset((current) => (current + 1) % SWITCH_ITEMS.length)
    setStep((current) => {
      const next = current + 1
      if (next >= 5) queueMicrotask(resolve)
      return next
    })
  }

  return (
    <div className={mistake ? 'new-minigame switch-game mistake' : 'new-minigame switch-game'}>
      <strong className="rule-banner">{rule.label}</strong>
      <div className="switch-grid">
        {items.map((item, index) => (
          <button
            key={`${item.color}-${item.shape}-${index}`}
            type="button"
            className={`${item.color} ${item.shape}`}
            onClick={() => choose(item)}
            aria-label={`${item.color} ${item.shape}`}
          ><i /></button>
        ))}
      </div>
      <Progress value={(step / 5) * 100} />
    </div>
  )
}

const DIRECTIONS = [
  { label: '↑', code: 'ArrowUp', alt: 'KeyW' },
  { label: '→', code: 'ArrowRight', alt: 'KeyD' },
  { label: '↓', code: 'ArrowDown', alt: 'KeyS' },
  { label: '←', code: 'ArrowLeft', alt: 'KeyA' },
]

export function DirectionLossGame({ onResolve }) {
  const rootRef = useRef(null)
  const direction = useMemo(() => DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)], [])
  const rotation = useMemo(() => [90, 180, 270][Math.floor(Math.random() * 3)], [])
  const [showing, setShowing] = useState(true)
  const [wrong, setWrong] = useState(false)
  const resolve = useOnceResolve(onResolve)

  useEffect(() => {
    if (!showing) return undefined
    const timer = window.setTimeout(() => setShowing(false), 700)
    return () => window.clearTimeout(timer)
  }, [showing])

  const press = (candidate) => {
    if (showing) return
    if (candidate.code === direction.code) {
      resolve()
      return
    }
    setWrong(true)
    setShowing(true)
    window.setTimeout(() => setWrong(false), 200)
  }

  useMicrogameKeys(rootRef, {
    hint: 'PRESS THE ORIGINAL DIRECTION',
    onKeyDown: (event) => {
      const candidate = DIRECTIONS.find((item) => item.code === event.code || item.alt === event.code)
      if (!candidate || event.repeat) return false
      press(candidate)
      return true
    },
  })

  return (
    <div ref={rootRef} className={wrong ? 'new-minigame direction-game wrong' : 'new-minigame direction-game'}>
      <small>{showing ? 'REMEMBER THIS DIRECTION' : 'PRESS THE ORIGINAL'}</small>
      <div className="direction-stage" style={{ transform: showing ? 'none' : `rotate(${rotation}deg)` }}>
        <b>{direction.label}</b>
      </div>
      {!showing && (
        <div className="direction-buttons">
          {DIRECTIONS.map((item) => <button key={item.code} type="button" onClick={() => press(item)}>{item.label}</button>)}
        </div>
      )}
    </div>
  )
}

const PACK_ITEMS = [
  ['KEYS', '🔑'], ['PHONE', '▣'], ['WALLET', '▤'], ['WATER', '◉'], ['MEDS', '✚'], ['BOOK', '▥'],
]

export function PackingCheckGame({ onResolve }) {
  const required = useMemo(() => shuffled(PACK_ITEMS).slice(0, 3), [])
  const [packed, setPacked] = useState([])
  const [wrong, setWrong] = useState(null)
  const resolve = useOnceResolve(onResolve)
  const requiredNames = new Set(required.map(([name]) => name))

  const pack = (name) => {
    if (!requiredNames.has(name)) {
      setWrong(name)
      setPacked((current) => current.slice(0, Math.max(0, current.length - 1)))
      window.setTimeout(() => setWrong(null), 250)
      return
    }
    if (packed.includes(name)) return
    const next = [...packed, name]
    setPacked(next)
    if (next.length >= required.length) queueMicrotask(resolve)
  }

  return (
    <div className="new-minigame packing-game">
      <small>PACK: {required.map(([name]) => name).join(' · ')}</small>
      <div className="packing-grid">
        {PACK_ITEMS.map(([name, icon]) => (
          <button
            key={name}
            type="button"
            className={`${packed.includes(name) ? 'packed' : ''} ${wrong === name ? 'wrong' : ''}`}
            onClick={() => pack(name)}
          ><b>{icon}</b><span>{name}</span></button>
        ))}
      </div>
      <Progress value={(packed.length / required.length) * 100} />
    </div>
  )
}

const THOUGHT_ICONS = ['●', '▲', '◆', '✚', '■', '☾']

export function InterruptedThoughtGame({ onResolve }) {
  const sequence = useMemo(() => shuffled(THOUGHT_ICONS).slice(0, 3), [])
  const [phase, setPhase] = useState('study')
  const [index, setIndex] = useState(0)
  const [wrong, setWrong] = useState(false)
  const resolve = useOnceResolve(onResolve)

  useEffect(() => {
    if (phase !== 'study') return undefined
    const timer = window.setTimeout(() => setPhase('interrupt'), 800)
    return () => window.clearTimeout(timer)
  }, [phase])

  const recall = (icon) => {
    if (sequence[index] !== icon) {
      setWrong(true)
      setIndex(0)
      window.setTimeout(() => setWrong(false), 180)
      return
    }
    const next = index + 1
    setIndex(next)
    if (next >= sequence.length) queueMicrotask(resolve)
  }

  return (
    <div className={wrong ? 'new-minigame interrupted-game wrong' : 'new-minigame interrupted-game'}>
      {phase === 'study' && <><small>KEEP THIS THOUGHT</small><div className="thought-sequence">{sequence.map((icon) => <b key={icon}>{icon}</b>)}</div></>}
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
            {THOUGHT_ICONS.map((icon) => <button key={icon} type="button" onClick={() => recall(icon)}>{icon}</button>)}
          </div>
          <Progress value={(index / sequence.length) * 100} />
        </>
      )}
    </div>
  )
}

export function CheckingGame({ onResolve }) {
  const [switches, setSwitches] = useState([false, false, false, false])
  const resolve = useOnceResolve(onResolve)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSwitches((current) => {
        if (current.every(Boolean)) return current
        const onIndex = current.findIndex(Boolean)
        if (onIndex < 0) return current
        const next = [...current]
        next[onIndex] = false
        return next
      })
    }, 1150)
    return () => window.clearInterval(timer)
  }, [])

  const toggle = (index) => {
    setSwitches((current) => {
      const next = [...current]
      next[index] = !next[index]
      if (next.every(Boolean)) queueMicrotask(resolve)
      return next
    })
  }

  return (
    <div className="new-minigame checking-game">
      <small>GET EVERY CHECK ON</small>
      <div className="checking-switches">
        {switches.map((on, index) => (
          <button key={index} type="button" className={on ? 'on' : ''} onClick={() => toggle(index)}>
            <i /> <span>{on ? 'YES' : 'CHECK'}</span>
          </button>
        ))}
      </div>
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
    const good = phaseRef.current < 0.14 || phaseRef.current > 0.86
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
      <div className="beat-pips">{Array.from({ length: 4 }).map((_, index) => <i key={index} className={index < hits ? 'hit' : ''} />)}</div>
    </div>
  )
}
