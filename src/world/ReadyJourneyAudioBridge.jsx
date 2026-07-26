import { useEffect, useState } from 'react'
import { DAY_ELAPSED_EVENT } from '../config/gameConfig.js'
import useJourneyAudio from './useJourneyAudio.js'
import useRequestedJourneySfx from './useRequestedJourneySfx.js'

function readJourneyState() {
  const shell = document.querySelector('.game-shell')
  const statusClass = shell
    ? Array.from(shell.classList).find((name) => name.startsWith('status-'))
    : null
  const status = statusClass?.slice('status-'.length) ?? 'intro'
  const tutorialPaused = Boolean(document.querySelector('.tutorial-layer'))
  const load = document.querySelectorAll('.load-pips i.filled').length

  return { status, tutorialPaused, load }
}

function mutationShowsReadyCue(record) {
  if (record.type === 'attributes') {
    return record.target instanceof Element
      && record.target.classList.contains('race-start-cue-ready')
  }

  return Array.from(record.addedNodes).some((node) => (
    node instanceof Element
    && (
      node.classList.contains('race-start-cue-ready')
      || Boolean(node.querySelector('.race-start-cue-ready'))
    )
  ))
}

export default function ReadyJourneyAudioBridge() {
  const [signals, setSignals] = useState(() => ({
    ...readJourneyState(),
    dayElapsed: 0,
    startCueToken: 0,
  }))

  useEffect(() => {
    const handleDayElapsed = (event) => {
      const exactElapsed = Number(event.detail)
      if (!Number.isFinite(exactElapsed)) return
      setSignals((current) => ({ ...current, dayElapsed: exactElapsed }))
    }

    window.addEventListener(DAY_ELAPSED_EVENT, handleDayElapsed)
    return () => window.removeEventListener(DAY_ELAPSED_EVENT, handleDayElapsed)
  }, [])

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setSignals((current) => ({
        ...current,
        ...readJourneyState(),
      }))
    }
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    const observer = new MutationObserver((records) => {
      const readyCueAppeared = records.some(mutationShowsReadyCue)
      if (readyCueAppeared) {
        setSignals((current) => ({
          ...current,
          ...readJourneyState(),
          startCueToken: current.startCueToken + 1,
        }))
      } else {
        scheduleUpdate()
      }
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
    scheduleUpdate()

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useRequestedJourneySfx(signals)
  useJourneyAudio(signals)
  return null
}
