import { useEffect, useMemo, useRef, useState } from 'react'

import DialogueBox from '../dialogue/DialogueBox.jsx'
import '../dialogue/rehearsalDialogue.css'

// Run Through the Plan pauses the day while spawning and minigames remain active.
// The player restores the morning steps in order. Wrong picks mark the technique
// as failed, flash the selected option, and leave the sequence available to finish.
export default function PlanTechnique({
  steps,
  timeLimitSeconds,
  load = 0,
  distortion = 0,
  onComplete,
}) {
  const [placed, setPlaced] = useState(0)
  const [remaining, setRemaining] = useState(timeLimitSeconds)
  const [wrongChoice, setWrongChoice] = useState(null)
  const wrongRef = useRef(false)
  const doneRef = useRef(false)
  const wrongTimerRef = useRef(null)

  const shuffled = useMemo(() => {
    const copy = steps.map((step, index) => ({ ...step, key: `${step.label}-${index}` }))
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
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

    return () => {
      window.clearInterval(id)
      window.clearTimeout(wrongTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = (optionIndex) => {
    if (doneRef.current) return
    const step = shuffled[optionIndex]

    if (step.order === placed) {
      const next = placed + 1
      setPlaced(next)
      if (next >= steps.length) finish(true)
      return
    }

    wrongRef.current = true
    window.clearTimeout(wrongTimerRef.current)
    setWrongChoice({ key: step.key, attempt: performance.now() })
    wrongTimerRef.current = window.setTimeout(() => setWrongChoice(null), 360)
  }

  const timeRatio = Math.max(0, Math.min(1, remaining / timeLimitSeconds))
  const dialogue = {
    speaker: 'The Plan',
    line: 'Put the morning in order.',
    options: shuffled,
  }

  return (
    <DialogueBox
      dialogue={dialogue}
      load={load}
      distortion={distortion}
      onAnswer={pick}
      className="plan-dialogue"
      ariaLabel="Run through the plan"
      beforeOptions={(
        <div className="rehearsal-dialogue-clock" aria-label={`${remaining.toFixed(1)} seconds remaining`}>
          <div className="rehearsal-dialogue-meter" aria-hidden="true">
            <i style={{ transform: `scaleX(${timeRatio})` }} />
          </div>
          <strong>{remaining.toFixed(1)}s</strong>
        </div>
      )}
      getOptionProps={(step) => {
        const isPlaced = step.order < placed
        const isWrong = wrongChoice?.key === step.key
        return {
          className: [isPlaced ? 'plan-option-placed' : '', isWrong ? 'plan-option-wrong' : '']
            .filter(Boolean)
            .join(' '),
          disabled: isPlaced,
          'aria-invalid': isWrong || undefined,
        }
      }}
      renderOption={(step) => {
        const isPlaced = step.order < placed
        return (
          <>
            <em>{isPlaced ? step.order + 1 : '·'}</em>
            <span>{step.label}</span>
          </>
        )
      }}
      afterOptions={(
        <div className="rehearsal-dialogue-progress" aria-hidden="true">
          {steps.map((_, stepIndex) => (
            <i key={stepIndex} className={stepIndex < placed ? 'done' : ''} />
          ))}
        </div>
      )}
    />
  )
}
