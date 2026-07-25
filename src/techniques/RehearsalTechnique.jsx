import { useEffect, useMemo, useRef, useState } from 'react'

import { scoredPromptCount } from './techniqueEngine.js'

// The rehearsal box. It pauses the day (the parent sets activeTechnique with
// pausesDay) but leaves minigames interactive — this panel only captures its
// own pointer area, never the whole screen.
//
// Every answer advances the sequence. A wrong answer to a scored prompt marks
// the run failed but does not stop it. Success requires finishing every prompt
// with no wrong scored answers before the window expires; running out of time
// is a timeout failure.
export default function RehearsalTechnique({ prompts, timeLimitSeconds, onComplete }) {
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(timeLimitSeconds)
  const wrongRef = useRef(0)
  const doneRef = useRef(false)
  const scored = useMemo(() => scoredPromptCount(prompts), [prompts])

  const finish = (finished) => {
    if (doneRef.current) return
    doneRef.current = true
    onComplete({ finished, wrongScoredAnswers: wrongRef.current, scoredPrompts: scored })
  }

  // Wall-clock window. Uses a deadline so the countdown display stays accurate.
  useEffect(() => {
    const deadline = performance.now() + timeLimitSeconds * 1000
    const id = window.setInterval(() => {
      const left = Math.max(0, (deadline - performance.now()) / 1000)
      setRemaining(left)
      if (left <= 0) {
        window.clearInterval(id)
        finish(false) // timeout
      }
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prompt = prompts[index]

  const answer = (optionIndex) => {
    if (doneRef.current) return
    if (prompt.correctOption !== null && optionIndex !== prompt.correctOption) {
      wrongRef.current += 1
    }
    if (index + 1 < prompts.length) {
      setIndex(index + 1)
    } else {
      finish(true)
    }
  }

  const timeRatio = Math.max(0, Math.min(1, remaining / timeLimitSeconds))

  return (
    <section
      className="rehearsal-box"
      role="dialog"
      aria-label="Rehearse the conversation"
      aria-live="polite"
    >
      <div className="rehearsal-head">
        <span>REHEARSE</span>
        <strong>{remaining.toFixed(1)}s</strong>
      </div>
      <div className="rehearsal-timer"><i style={{ transform: `scaleX(${timeRatio})` }} /></div>
      <p className="rehearsal-line">{prompt.line}</p>
      <div className="rehearsal-options">
        {prompt.options.map((option, optionIndex) => (
          <button key={option} type="button" onClick={() => answer(optionIndex)}>
            {option}
          </button>
        ))}
      </div>
      <div className="rehearsal-progress" aria-hidden="true">
        {prompts.map((_, promptIndex) => (
          <i key={promptIndex} className={promptIndex <= index ? 'done' : ''} />
        ))}
      </div>
    </section>
  )
}
