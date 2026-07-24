import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Progress,
  clamp,
  shuffled,
  useAnimationFrame,
  useMicrogameKeys,
  useOnceResolve,
} from './shared.jsx'

export function HeavyEyesGame({ onResolve }) {
  const rootRef = useRef(null)
  const lastRef = useRef(null)
  const [steps, setSteps] = useState(0)
  const resolve = useOnceResolve(onResolve)

  const open = (side) => {
    if (lastRef.current === side) {
      setSteps((current) => Math.max(0, current - 1))
      return
    }
    lastRef.current = side
    setSteps((current) => {
      const next = current + 1
      if (next >= 10) queueMicrotask(resolve)
      return next
    })
  }

  useMicrogameKeys(rootRef, {
    hint: 'ALTERNATE A / D',
    onKeyDown: (event) => {
      if (event.repeat) return false
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        open('left')
        return true
      }
      if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        open('right')
        return true
      }
      return false
    },
  })

  const lid = clamp(38 - steps * 3.1, 4, 38)
  return (
    <div ref={rootRef} className="new-minigame heavy-eyes-game">
      <small>KEEP BOTH EYES OPEN</small>
      <div className="two-eyes">
        {['left', 'right'].map((side) => (
          <button key={side} type="button" onClick={() => open(side)}>
            <i style={{ height: `${lid}px` }} />
            <b>●</b>
          </button>
        ))}
      </div>
      <div className="mini-button-row"><span>A</span><span>D</span></div>
      <Progress value={steps * 10} />
    </div>
  )
}

export function MicroRestGame({ onResolve }) {
  const rootRef = useRef(null)
  const stillRef = useRef(0)
  const [still, setStill] = useState(0)
  const [disturbed, setDisturbed] = useState(false)
  const resolve = useOnceResolve(onResolve)

  const disturb = () => {
    const windowElement = rootRef.current?.closest('.microgame')
    if (!windowElement?.classList.contains('keyboard-active')) return
    stillRef.current = 0
    setStill(0)
    setDisturbed(true)
    window.setTimeout(() => setDisturbed(false), 120)
  }

  useMicrogameKeys(rootRef, {
    hint: 'STOP MOVING',
    onKeyDown: () => {
      disturb()
      return false
    },
  })

  useAnimationFrame((_, delta) => {
    const windowElement = rootRef.current?.closest('.microgame')
    if (!windowElement?.classList.contains('keyboard-active')) return
    stillRef.current = clamp(stillRef.current + delta, 0, 1700)
    setStill(stillRef.current)
    if (stillRef.current >= 1700) resolve()
  })

  return (
    <div
      ref={rootRef}
      className={disturbed ? 'new-minigame micro-rest-game disturbed' : 'new-minigame micro-rest-game'}
      onPointerMove={disturb}
    >
      <small>STOP. DO NOTHING.</small>
      <div className="rest-orb" style={{ transform: `scale(${0.65 + (still / 1700) * 0.35})` }}><i /></div>
      <strong>{still > 150 ? 'STAY STILL' : 'CLICK, THEN STOP MOVING'}</strong>
      <Progress value={(still / 1700) * 100} />
    </div>
  )
}

const LIGHT_SYMBOLS = ['☾', '✦', '●', '▲']

export function LightSensitivityGame({ onResolve }) {
  const symbol = useMemo(() => LIGHT_SYMBOLS[Math.floor(Math.random() * LIGHT_SYMBOLS.length)], [])
  const [brightness, setBrightness] = useState(100)
  const resolve = useOnceResolve(onResolve)
  const visible = brightness <= 24

  return (
    <div className="new-minigame light-game" style={{ '--brightness': brightness / 100 }}>
      <small>TURN THE LIGHT DOWN</small>
      <button type="button" className={visible ? 'light-symbol visible' : 'light-symbol'} onClick={visible ? resolve : undefined}>{symbol}</button>
      <input
        aria-label="Brightness"
        type="range"
        min="0"
        max="100"
        value={brightness}
        onChange={(event) => setBrightness(Number(event.target.value))}
      />
      <span>{visible ? 'CLICK THE SYMBOL' : 'TOO BRIGHT'}</span>
    </div>
  )
}

export function PinsNeedlesGame({ onResolve }) {
  const targets = useMemo(() => shuffled(Array.from({ length: 9 }, (_, index) => index)).slice(0, 3), [])
  const [showing, setShowing] = useState(true)
  const [selected, setSelected] = useState([])
  const [wrong, setWrong] = useState(null)
  const resolve = useOnceResolve(onResolve)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowing(false), 850)
    return () => window.clearTimeout(timer)
  }, [])

  const choose = (index) => {
    if (showing || selected.includes(index)) return
    if (!targets.includes(index)) {
      setWrong(index)
      setSelected([])
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

const AFTERIMAGE_OPTIONS = ['✦', '◆', '●', '▲']

export function AfterimageGame({ onResolve }) {
  const symbol = useMemo(() => AFTERIMAGE_OPTIONS[Math.floor(Math.random() * AFTERIMAGE_OPTIONS.length)], [])
  const [showing, setShowing] = useState(true)
  const [wrong, setWrong] = useState(null)
  const resolve = useOnceResolve(onResolve)

  useEffect(() => {
    if (!showing) return undefined
    const timer = window.setTimeout(() => setShowing(false), 720)
    return () => window.clearTimeout(timer)
  }, [showing])

  const choose = (candidate) => {
    if (candidate === symbol) {
      resolve()
      return
    }
    setWrong(candidate)
    setShowing(true)
    window.setTimeout(() => setWrong(null), 180)
  }

  return (
    <div className="new-minigame afterimage-game">
      <small>{showing ? 'LOOK' : 'WHAT DID YOU SEE?'}</small>
      {showing ? (
        <div className="afterimage-flash"><b>{symbol}</b></div>
      ) : (
        <div className="afterimage-options">
          {AFTERIMAGE_OPTIONS.map((candidate) => (
            <button key={candidate} type="button" className={wrong === candidate ? 'wrong' : ''} onClick={() => choose(candidate)}>{candidate}</button>
          ))}
        </div>
      )}
    </div>
  )
}
