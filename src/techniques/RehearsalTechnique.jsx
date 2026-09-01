import { useEffect, useMemo, useRef, useState } from 'react'

import DialogueBox from '../dialogue/DialogueBox.jsx'
import '../dialogue/rehearsalDialogue.css'
import { scoredPromptCount } from './techniqueEngine.js'
import { useT } from '../i18n/i18n.js'

// The rehearsal dialogue pauses the day (the parent sets activeTechnique with
// pausesDay) but leaves minigames interactive. It uses the same dialogue box as
// the rest of the game and only captures pointer input inside the box itself.
//
// Every answer advances the sequence. A wrong answer to a scored prompt marks
// the run failed but does not stop it. Success requires finishing every prompt
// with no wrong scored answers before the window expires; running out of time
// is a timeout failure.
export default function RehearsalTechnique({
  prompts,
  timeLimitSeconds,
  load = 0,
  distortion = 0,
  onComplete,
}) {
  const t = useT()
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
  const dialogue = {
    speaker: t('speaker.Rehearse'),
    line: t(`rehearse.p.${index}.line`),
    options: prompt.options.map((_, optionIndex) => t(`rehearse.p.${index}.opt.${optionIndex}`)),
  }

  return (
    <DialogueBox
      dialogue={dialogue}
      load={load}
      distortion={distortion}
      onAnswer={answer}
      className="rehearsal-dialogue"
      ariaLabel={t('rehearse.aria')}
      beforeOptions={(
        <div className="rehearsal-dialogue-clock" aria-label={t('technique.timeRemaining', { seconds: remaining.toFixed(1) })}>
          <div className="rehearsal-dialogue-meter" aria-hidden="true">
            <i style={{ transform: `scaleX(${timeRatio})` }} />
          </div>
          <strong>{t('technique.secondsValue', { seconds: remaining.toFixed(1) })}</strong>
        </div>
      )}
      afterOptions={(
        <div className="rehearsal-dialogue-progress" aria-hidden="true">
          {prompts.map((_, promptIndex) => (
            <i key={promptIndex} className={promptIndex <= index ? 'done' : ''} />
          ))}
        </div>
      )}
    />
  )
}
