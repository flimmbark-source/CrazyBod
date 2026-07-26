import { useEffect, useState } from 'react'
import { DAY_ELAPSED_EVENT } from '../config/gameConfig.js'
import useJourneyAudio from './useJourneyAudio.js'
import useRequestedJourneySfx from './useRequestedJourneySfx.js'

const AUDIO_VOLUME_KEY = 'crazybod:audio-volume'

function readStoredVolume() {
  try {
    const stored = Number(window.localStorage.getItem(AUDIO_VOLUME_KEY))
    return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 0.75
  } catch {
    return 0.75
  }
}

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

function AudioSettings({ volume, onVolumeChange }) {
  const [open, setOpen] = useState(false)
  const percentage = Math.round(volume * 100)

  return (
    <aside className={`audio-settings${open ? ' audio-settings-open' : ''}`}>
      <button
        className="audio-settings-gear"
        type="button"
        aria-label={open ? 'Close sound settings' : 'Open sound settings'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        ⚙
      </button>
      {open && (
        <div className="audio-settings-panel">
          <label htmlFor="journey-volume">SOUND</label>
          <input
            id="journey-volume"
            type="range"
            min="0"
            max="100"
            step="1"
            value={percentage}
            onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
          />
          <output htmlFor="journey-volume">{percentage}%</output>
        </div>
      )}
    </aside>
  )
}

export default function ReadyJourneyAudioBridge() {
  const [signals, setSignals] = useState(() => ({
    ...readJourneyState(),
    dayElapsed: 0,
    startCueToken: 0,
  }))
  const [volume, setVolume] = useState(readStoredVolume)

  const changeVolume = (nextVolume) => {
    const clamped = Math.min(1, Math.max(0, nextVolume))
    setVolume(clamped)
    try {
      window.localStorage.setItem(AUDIO_VOLUME_KEY, String(clamped))
    } catch {
      // Audio still updates for this session when storage is unavailable.
    }
  }

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

  useRequestedJourneySfx({ ...signals, volume })
  useJourneyAudio({ ...signals, volume })

  return signals.status === 'home'
    ? <AudioSettings volume={volume} onVolumeChange={changeVolume} />
    : null
}
