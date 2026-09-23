import { useEffect, useState } from 'react'
import { DAY_ELAPSED_EVENT } from '../config/gameConfig.js'
import { useSettings } from '../settings/settingsStore.js'
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

function mutationAddsClass(record, className) {
  if (record.type === 'attributes') {
    return record.target instanceof Element
      && record.target.classList.contains(className)
  }

  return Array.from(record.addedNodes).some((node) => (
    node instanceof Element
    && (
      node.classList.contains(className)
      || Boolean(node.querySelector(`.${className}`))
    )
  ))
}

export default function ReadyJourneyAudioBridge() {
  const [signals, setSignals] = useState(() => ({
    ...readJourneyState(),
    dayElapsed: 0,
    startCueToken: 0,
    celebrationToken: 0,
  }))
  // Volume is owned by the shared settings store so the settings menu (rendered
  // in the main App tree) and this audio driver stay in sync across roots.
  const { volume } = useSettings()

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
      const readyCueAppeared = records.some((record) => mutationAddsClass(record, 'race-start-cue-ready'))
      const celebrationAppeared = records.some((record) => mutationAddsClass(record, 'cafe-celebration'))

      if (readyCueAppeared || celebrationAppeared) {
        setSignals((current) => ({
          ...current,
          ...readJourneyState(),
          startCueToken: current.startCueToken + (readyCueAppeared ? 1 : 0),
          celebrationToken: current.celebrationToken + (celebrationAppeared ? 1 : 0),
        }))
      } else {
        scheduleUpdate()
      }
    })

    // Every derived signal (status class, tutorial layer, load pips, ready cue,
    // celebration) comes from class or childList changes. Filtering to the class
    // attribute avoids waking on per-frame HUD text and inline-style updates.
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    })
    scheduleUpdate()

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useRequestedJourneySfx({ ...signals, volume })
  useJourneyAudio({ ...signals, volume })

  // This bridge is now audio-only; the settings menu (volume + language) is
  // rendered by the App tree on every non-play screen.
  return null
}
