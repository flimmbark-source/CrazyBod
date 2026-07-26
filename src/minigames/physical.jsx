import { useMemo, useRef, useState } from 'react'
import {
  Progress,
  clamp,
  keyDirection,
  useAnimationFrame,
  useMicrogameKeys,
  useOnceResolve,
} from './shared.jsx'

export function BalanceGame({ onResolve }) {
  const rootRef = useRef(null)
  const markerRef = useRef(50)
  const velocityRef = useRef(0)
  const heldRef = useRef(0)
  const steadyRef = useRef(0)
  const [marker, setMarker] = useState(50)
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

  useAnimationFrame((now, delta) => {
    const externalForce = (
      Math.sin(now / 260) * 0.00050
      + Math.sin(now / 95 + 1.8) * 0.00030
      + Math.sign(Math.sin(now / 620) || 1) * 0.00020
    )
    const controlForce = heldRef.current * 0.00095

    velocityRef.current += (externalForce + controlForce) * delta
    velocityRef.current *= Math.pow(0.9, delta / 16.67)
    velocityRef.current = clamp(velocityRef.current, -0.095, 0.095)
    markerRef.current += velocityRef.current * delta

    if (markerRef.current <= 4 || markerRef.current >= 96) {
      markerRef.current = clamp(markerRef.current, 4, 96)
      velocityRef.current *= -0.65
    }

    const centered = markerRef.current >= 42 && markerRef.current <= 58
    steadyRef.current = clamp(steadyRef.current + (centered ? delta : 0), 0, 1500)
    setMarker(markerRef.current)
    setSteady(steadyRef.current)
    if (steadyRef.current >= 1500) resolve()
  })

  const setHeld = (direction) => () => { heldRef.current = direction }
  const release = () => { heldRef.current = 0 }

  return (
    <div ref={rootRef} className="new-minigame balance-game">
      <small>KEEP IT CENTERED.</small>
      <div className="balance-track">
        <i className="balance-zone" />
        <b style={{ left: `${marker}%` }} />
      </div>
      <div className="mini-button-row">
        <button type="button" onPointerDown={setHeld(-1)} onPointerUp={release} onPointerLeave={release}>A</button>
        <button type="button" onPointerDown={setHeld(1)} onPointerUp={release} onPointerLeave={release}>D</button>
      </div>
      <Progress value={(steady / 1500) * 100} />
    </div>
  )
}

export function TremorGame({ onResolve }) {
  const rootRef = useRef(null)
  const pointerRef = useRef({ x: -1, y: -1 })
  const targetRef = useRef({ x: 50, y: 50 })
  const progressRef = useRef(0)
  const [target, setTarget] = useState(targetRef.current)
  const [pointer, setPointer] = useState(pointerRef.current)
  const [progress, setProgress] = useState(0)
  const resolve = useOnceResolve(onResolve)

  useAnimationFrame((now, delta) => {
    targetRef.current = {
      x: 50 + Math.sin(now / 690) * 23,
      y: 49 + Math.cos(now / 870) * 18,
    }
    const dx = pointerRef.current.x - targetRef.current.x
    const dy = pointerRef.current.y - targetRef.current.y
    const inside = Math.hypot(dx, dy) < 13
    progressRef.current = clamp(progressRef.current + (inside ? delta : -delta * 0.75), 0, 1400)
    setTarget(targetRef.current)
    setProgress(progressRef.current)
    if (progressRef.current >= 1400) resolve()
  })

  const move = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    pointerRef.current = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    }
    setPointer(pointerRef.current)
  }

  return (
    <div ref={rootRef} className="new-minigame tremor-game">
      <small>FOLLOW THE CALM SPOT</small>
      <div className="tremor-field" onPointerMove={move}>
        <i className="tremor-target" style={{ left: `${target.x}%`, top: `${target.y}%` }} />
        {pointer.x >= 0 && <b style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }} />}
      </div>
      <Progress value={(progress / 1400) * 100} />
    </div>
  )
}

export function JointSlipGame({ onResolve }) {
  const rootRef = useRef(null)
  const positionRef = useRef({ x: 24, y: 56 })
  const draggingRef = useRef(false)
  const settledRef = useRef(0)
  const [position, setPosition] = useState(positionRef.current)
  const [settled, setSettled] = useState(0)
  const [socketed, setSocketed] = useState(false)
  const resolve = useOnceResolve(onResolve)

  useAnimationFrame((_, delta) => {
    const distance = Math.hypot(positionRef.current.x - 76, positionRef.current.y - 48)
    const inSocket = distance < 15
    settledRef.current = clamp(settledRef.current + (inSocket ? delta : -delta * 1.5), 0, 700)
    setSettled(settledRef.current)
    if (settledRef.current >= 700) resolve()
  })

  const start = (event) => {
    if (socketed) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (event) => {
    if (!draggingRef.current) return
    const rect = rootRef.current.querySelector('.joint-field').getBoundingClientRect()
    const next = {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 12, 88),
    }
    const distance = Math.hypot(next.x - 76, next.y - 48)

    if (distance < 15) {
      positionRef.current = { x: 76, y: 48 }
      draggingRef.current = false
      setSocketed(true)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } else {
      positionRef.current = next
    }

    setPosition(positionRef.current)
  }

  const stop = () => { draggingRef.current = false }

  return (
    <div ref={rootRef} className="new-minigame joint-game">
      <small>DRAG TO THE CIRCLE</small>
      <div className="joint-field">
        <i className={socketed ? 'joint-socket filled' : 'joint-socket'} />
        <button
          type="button"
          className={socketed ? 'joint-piece socketed' : 'joint-piece'}
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          disabled={socketed}
          aria-label="Drag the loose circle into the dotted circle"
        />
      </div>
      <Progress value={(settled / 700) * 100} />
    </div>
  )
}

export function MuscleLockGame({ onResolve }) {
  const rootRef = useRef(null)
  const lastRef = useRef(null)
  const [steps, setSteps] = useState(0)
  const resolve = useOnceResolve(onResolve)

  const press = (side) => {
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
      const direction = keyDirection(event.code)
      if (!direction || event.repeat) return false
      press(direction < 0 ? 'left' : 'right')
      return true
    },
  })

  return (
    <div ref={rootRef} className="new-minigame muscle-game">
      <small>ALTERNATE PRESSES</small>
      <div className="muscle-coil" style={{ '--release': steps / 10 }}>
        {Array.from({ length: 5 }).map((_, index) => <i key={index} />)}
      </div>
      <div className="mini-button-row">
        <button type="button" onClick={() => press('left')}>A</button>
        <button type="button" onClick={() => press('right')}>D</button>
      </div>
      <Progress value={steps * 10} />
    </div>
  )
}

export function WeakGripGame({ onResolve }) {
  const rootRef = useRef(null)
  const holdingRef = useRef(false)
  const lastTapRef = useRef(0)
  const progressRef = useRef(0)
  const [progress, setProgress] = useState(0)
  const [pulse, setPulse] = useState(false)
  const resolve = useOnceResolve(onResolve)

  const tap = () => {
    if (!holdingRef.current) return
    lastTapRef.current = performance.now()
    setPulse(true)
    window.setTimeout(() => setPulse(false), 100)
  }

  useMicrogameKeys(rootRef, {
    hint: 'HOLD MOUSE + TAP SPACE',
    onKeyDown: (event) => {
      if (event.code !== 'Space' || event.repeat) return false
      tap()
      return true
    },
  })

  useAnimationFrame((now, delta) => {
    const supported = holdingRef.current && now - lastTapRef.current < 720
    progressRef.current = clamp(progressRef.current + (supported ? delta : -delta * 0.85), 0, 1800)
    setProgress(progressRef.current)
    if (progressRef.current >= 1800) resolve()
  })

  const begin = () => {
    holdingRef.current = true
    lastTapRef.current = performance.now()
  }
  const stop = () => { holdingRef.current = false }

  return (
    <div ref={rootRef} className="new-minigame weak-grip-game">
      <small>HOLD AND KEEP TAPPING SPACE</small>
      <button
        type="button"
        className={pulse ? 'grip-button pulsing' : 'grip-button'}
        onPointerDown={begin}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      >
        HOLD
      </button>
      <Progress value={(progress / 1800) * 100} />
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

  useAnimationFrame((now, delta) => {
    const pull = Math.sign(tiltRef.current || 1) * 0.012 * delta
    tiltRef.current = clamp(tiltRef.current + pull + heldRef.current * delta * 0.05, -28, 28)
    const level = Math.abs(tiltRef.current) < 3
    steadyRef.current = clamp(steadyRef.current + (level ? delta : -delta), 0, 950)
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
      <small>STEADY THE HORIZON</small>
      <div className="horizon" style={{ transform: `rotate(${tilt}deg)` }}><i /></div>
      <div className="mini-button-row">
        <button type="button" onClick={() => nudge(-4)}>A</button>
        <button type="button" onClick={() => nudge(4)}>D</button>
      </div>
      <Progress value={(steady / 950) * 100} />
    </div>
  )
}

export function PressurePointGame({ onResolve }) {
  const rootRef = useRef(null)
  const pointerRef = useRef({ x: -100, y: -100 })
  const pointRef = useRef({ x: 50, y: 50 })
  const progressRef = useRef(0)
  const [point, setPoint] = useState(pointRef.current)
  const [progress, setProgress] = useState(0)
  const resolve = useOnceResolve(onResolve)

  useAnimationFrame((now, delta) => {
    pointRef.current = {
      x: 50 + Math.sin(now / 760) * 29,
      y: 50 + Math.sin(now / 510 + 1.4) * 24,
    }
    const distance = Math.hypot(pointerRef.current.x - pointRef.current.x, pointerRef.current.y - pointRef.current.y)
    progressRef.current = clamp(progressRef.current + (distance < 10 ? delta : -delta * 0.7), 0, 1350)
    setPoint(pointRef.current)
    setProgress(progressRef.current)
    if (progressRef.current >= 1350) resolve()
  })

  const track = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    pointerRef.current = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    }
  }

  return (
    <div ref={rootRef} className="new-minigame pressure-game">
      <small>STAY ON THE SORE POINT</small>
      <div className="pressure-field" onPointerMove={track} onPointerLeave={() => { pointerRef.current = { x: -100, y: -100 } }}>
        <i style={{ left: `${point.x}%`, top: `${point.y}%` }} />
      </div>
      <Progress value={(progress / 1350) * 100} />
    </div>
  )
}

export function SpiralGame({ onResolve }) {
  const rootRef = useRef(null)
  const draggingRef = useRef(false)
  const positionRef = useRef({ x: 50, y: 50 })
  const heldRef = useRef(0)
  const [position, setPosition] = useState(positionRef.current)
  const [held, setHeld] = useState(0)
  const resolve = useOnceResolve(onResolve)

  useAnimationFrame((_, delta) => {
    const distance = Math.hypot(positionRef.current.x - 50, positionRef.current.y - 50)
    heldRef.current = clamp(heldRef.current + (draggingRef.current && distance > 35 ? delta : -delta), 0, 800)
    setHeld(heldRef.current)
    if (heldRef.current >= 800) resolve()
  })

  const start = (event) => {
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event) => {
    if (!draggingRef.current) return
    const rect = rootRef.current.querySelector('.spiral-field').getBoundingClientRect()
    positionRef.current = {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 8, 92),
    }
    setPosition(positionRef.current)
  }
  const stop = () => { draggingRef.current = false }

  return (
    <div ref={rootRef} className="new-minigame spiral-game">
      <small>PULL TO THE EDGE.</small>
      <div className="spiral-field">
        <i className="spiral-rings" />
        <button
          type="button"
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
      </div>
      <Progress value={(held / 800) * 100} />
    </div>
  )
}
