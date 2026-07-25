import { useEffect, useMemo, useRef, useState } from 'react'

// Run Through the Plan. Like the rehearsal it pauses the day (unscored) while
// spawning continues and minigames stay interactive. The player puts the
// morning's steps back into order; finishing in order before the window closes
// staggers the next pair spawns. A wrong pick or a timeout ends it with no
// effect — no extra spawn penalty is attached here.
export default function PlanTechnique({ steps, timeLimitSeconds, onComplete }) {
  const [placed, setPlaced] = useState(0)
  const [remaining, setRemaining] = useState(timeLimitSeconds)
  const wrongRef = useRef(false)
  const doneRef = useRef(false)

  const shuffled = useMemo(() => {
    const copy = steps.map((step, i) => ({ ...step, key: `${step.label}-${i}` }))
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }, [steps])

  const finish = (finished) => {
    if (doneRef.current) return
    doneRef.current = true
    onComplete({ finished, wrong: wrongRef.current })
  }

  useEffect(() => {
    const deadline = performance.now() + timeLimitSeconds * 1000
    const id = window.setInterval(() => {
      const left = Math.max(0, (deadline - performance.now()) / 1000)
      setRemaining(left)
      if (left <= 0) {
        window.clearInterval(id)
        finish(false)
      }
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = (order) => {
    if (doneRef.current) return
    if (order === placed) {
      const next = placed + 1
      setPlaced(next)
      if (next >= steps.length) finish(true)
    } else {
      wrongRef.current = true // out-of-order pick fails the technique
    }
  }

  const timeRatio = Math.max(0, Math.min(1, remaining / timeLimitSeconds))

  return (
    <section className="plan-box" role="dialog" aria-label="Run through the plan" aria-live="polite">
      <div className="rehearsal-head">
        <span>THE PLAN</span>
        <strong>{remaining.toFixed(1)}s</strong>
      </div>
      <div className="rehearsal-timer"><i style={{ transform: `scaleX(${timeRatio})` }} /></div>
      <p className="rehearsal-line">Put the morning in order.</p>
      <div className="plan-steps">
        {shuffled.map((step) => {
          const isPlaced = step.order < placed
          return (
            <button
              key={step.key}
              type="button"
              className={isPlaced ? 'plan-step placed' : 'plan-step'}
              onClick={() => pick(step.order)}
              disabled={isPlaced}
            >
              <em>{isPlaced ? step.order + 1 : '·'}</em>
              {step.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
