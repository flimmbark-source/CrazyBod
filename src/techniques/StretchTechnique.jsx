import { useEffect, useRef, useState } from 'react'

import './stretchTechnique.css'

// Stretch Every Joint pauses the day (the parent sets activeTechnique with
// pausesDay). The player holds each joint until its meter fills; joints can be
// loosened in any order. Finishing every joint before the window closes is a
// success. Running out of time is a gentle failure: no benefit, no penalty.
export default function StretchTechnique({
  joints,
  timeLimitSeconds,
  holdSeconds = 0.8,
  onComplete,
}) {
  const [, forceRender] = useState(0)
  const [remaining, setRemaining] = useState(timeLimitSeconds)
  const filledRef = useRef({})
  const doneKeysRef = useRef(new Set())
  const activeKeyRef = useRef(null)
  const doneRef = useRef(false)
  const holdMs = holdSeconds * 1000

  const finish = (finished) => {
    if (doneRef.current) return
    doneRef.current = true
    onComplete({ finished })
  }

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const deadline = last + timeLimitSeconds * 1000

    const tick = (now) => {
      const delta = now - last
      last = now

      const key = activeKeyRef.current
      if (key && !doneKeysRef.current.has(key)) {
        const next = (filledRef.current[key] ?? 0) + delta
        filledRef.current[key] = next
        if (next >= holdMs) {
          doneKeysRef.current.add(key)
          activeKeyRef.current = null
          if (doneKeysRef.current.size >= joints.length) {
            finish(true)
            return
          }
        }
      }

      const left = Math.max(0, (deadline - now) / 1000)
      setRemaining(left)
      forceRender((value) => value + 1)
      if (left <= 0) {
        finish(false) // timeout
        return
      }
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const press = (key) => {
    if (doneRef.current || doneKeysRef.current.has(key)) return
    activeKeyRef.current = key
  }
  const release = (key) => {
    if (activeKeyRef.current === key) activeKeyRef.current = null
  }

  const timeRatio = Math.max(0, Math.min(1, remaining / timeLimitSeconds))
  const loosened = doneKeysRef.current.size

  return (
    <section
      className="dialogue-box rehearsal-dialogue stretch-dialogue"
      role="dialog"
      aria-label="Stretch every joint"
      aria-live="polite"
    >
      <div className="speaker-row">
        <span className="portrait">S</span>
        <div>
          <strong>Stretch</strong>
          <p>Loosen every joint before you go. Hold each one.</p>
        </div>
      </div>

      <div className="rehearsal-dialogue-clock" aria-label={`${remaining.toFixed(1)} seconds remaining`}>
        <div className="rehearsal-dialogue-meter" aria-hidden="true">
          <i style={{ transform: `scaleX(${timeRatio})` }} />
        </div>
        <strong>{remaining.toFixed(1)}s</strong>
      </div>

      <div className="dialogue-options stretch-joints">
        {joints.map((joint) => {
          const done = doneKeysRef.current.has(joint.key)
          const ratio = done ? 1 : Math.min(1, (filledRef.current[joint.key] ?? 0) / holdMs)
          const active = activeKeyRef.current === joint.key
          return (
            <button
              key={joint.key}
              type="button"
              className={`stretch-joint${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
              aria-pressed={done}
              disabled={done}
              onPointerDown={(event) => {
                event.preventDefault()
                press(joint.key)
              }}
              onPointerUp={() => release(joint.key)}
              onPointerLeave={() => release(joint.key)}
              onPointerCancel={() => release(joint.key)}
              onKeyDown={(event) => {
                if (event.code === 'Space' || event.code === 'Enter') {
                  event.preventDefault()
                  press(joint.key)
                }
              }}
              onKeyUp={(event) => {
                if (event.code === 'Space' || event.code === 'Enter') {
                  event.preventDefault()
                  release(joint.key)
                }
              }}
            >
              <span className="stretch-joint-fill" style={{ transform: `scaleX(${ratio})` }} aria-hidden="true" />
              <span className="stretch-joint-label">{joint.label}</span>
            </button>
          )
        })}
      </div>

      <div className="rehearsal-dialogue-progress" aria-label={`${loosened} of ${joints.length} loosened`}>
        {joints.map((joint) => (
          <i key={joint.key} className={doneKeysRef.current.has(joint.key) ? 'done' : ''} />
        ))}
      </div>
    </section>
  )
}
