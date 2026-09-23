import { useEffect, useMemo, useRef, useState } from 'react'

import { NewMicrogameContent } from './catalog.jsx'
import { useT } from '../i18n/i18n.js'

// The four original microgames, lifted out of App.jsx unchanged so that the
// Morning can show the same ones the day does. Nothing here is new code.

function DiscomfortGame({ onResolve }) {
  const t = useT()
  const [presses, setPresses] = useState(0)
  const needed = 6
  const shift = () => {
    const next = presses + 1
    setPresses(next)
    if (next >= needed) onResolve()
  }

  return (
    <div className="discomfort-game">
      <div className="body-shape">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} style={{ opacity: (presses + index) % 4 === 0 ? 1 : 0.35 }} />
        ))}
      </div>
      <button type="button" onClick={shift} style={{ transform: `translateX(${(presses % 3 - 1) * 16}px)` }}>
        {t('mg.adjust')}
      </button>
      <div className="tiny-progress"><i style={{ width: `${(presses / needed) * 100}%` }} /></div>
    </div>
  )
}

function AnxietyGame({ onResolve }) {
  const [hits, setHits] = useState(0)
  const targets = useMemo(
    () => [[18, 22], [72, 18], [43, 48], [78, 72], [24, 76]],
    [],
  )

  const hit = () => {
    const next = hits + 1
    setHits(next)
    if (next >= targets.length) onResolve()
  }

  return (
    <div className="anxiety-game">
      <div className="pulse-ring" />
      {targets.map(([left, top], index) => (
        <button
          key={`${left}-${top}`}
          type="button"
          className={index === hits ? 'active-target' : index < hits ? 'hit-target' : ''}
          style={{ left: `${left}%`, top: `${top}%` }}
          onClick={index === hits ? hit : undefined}
          aria-label={index === hits ? 'Catch pulse' : undefined}
        />
      ))}
    </div>
  )
}

function BrainFogGame({ onResolve }) {
  const [position, setPosition] = useState(0)
  const path = [1, 4, 5, 8]

  const move = (direction) => {
    const next = position + direction
    if (next < 0 || next > 8) return
    const currentRow = Math.floor(position / 3)
    const nextRow = Math.floor(next / 3)
    if (Math.abs(direction) === 1 && currentRow !== nextRow) return
    if (!path.includes(next) && next !== 0) {
      setPosition(0)
      return
    }
    setPosition(next)
    if (next === 8) onResolve()
  }

  return (
    <div className="fog-game">
      <div className="fog-grid">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className={`${path.includes(index) || index === 0 ? 'path' : ''} ${position === index ? 'you' : ''} ${index === 8 ? 'exit' : ''}`} />
        ))}
      </div>
      <div className="fog-controls">
        <button type="button" onClick={() => move(-3)}>↑</button>
        <button type="button" onClick={() => move(-1)}>←</button>
        <button type="button" onClick={() => move(1)}>→</button>
        <button type="button" onClick={() => move(3)}>↓</button>
      </div>
    </div>
  )
}

function FatigueGame({ onResolve, paused = false }) {
  const t = useT()
  const [held, setHeld] = useState(0)
  const holdingRef = useRef(false)
  const lastRef = useRef(0)
  const needed = 2400

  useEffect(() => {
    let frame
    const tick = (now) => {
      if (!lastRef.current) lastRef.current = now
      const delta = now - lastRef.current
      lastRef.current = now
      if (holdingRef.current && !paused) {
        setHeld((current) => {
          const next = Math.min(current + delta, needed)
          if (next >= needed) queueMicrotask(onResolve)
          return next
        })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onResolve, paused])

  const stopHolding = () => {
    holdingRef.current = false
  }

  return (
    <div className="fatigue-game">
      <div className="fatigue-eye">
        <div className="heavy-lid" style={{ transform: `translateY(${44 - (held / needed) * 44}px)` }} />
      </div>
      <button
        type="button"
        onPointerDown={() => { holdingRef.current = true }}
        onPointerUp={stopHolding}
        onPointerLeave={stopHolding}
        onPointerCancel={stopHolding}
      >
        {t('mg.hold')}
      </button>
      <div className="tiny-progress"><i style={{ width: `${(held / needed) * 100}%` }} /></div>
    </div>
  )
}


// Every microgame kind, old and new, behind one component.
export function MicrogameContent({ kind, onResolve, paused = false }) {
  return (
    <>
      {kind === 'discomfort' && <DiscomfortGame onResolve={onResolve} />}
      {kind === 'anxiety' && <AnxietyGame onResolve={onResolve} />}
      {kind === 'brainFog' && <BrainFogGame onResolve={onResolve} />}
      {kind === 'fatigue' && <FatigueGame onResolve={onResolve} paused={paused} />}
      <NewMicrogameContent kind={kind} onResolve={onResolve} />
    </>
  )
}
