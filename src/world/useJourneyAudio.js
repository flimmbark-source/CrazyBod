import { useEffect, useRef, useState } from 'react'
import { DAY_ELAPSED_EVENT } from '../config/gameConfig.js'

import gravelUrl from './kokoreli777-walking-on-a-gravel-169409.mp3'
import alarmUrl from './freesound_community-alarm-clock-beep-close-perspective-7092.mp3'
import rustleUrl from './freesound_community-foley-getting-in-and-out-of-bed-sheets-fabric-rustle-76964.mp3'
import goHomeUrl from './sergequadrado-brass-funk-jingle-449585.mp3'
import overloadedUrl from './sonican-big-band-detective-30-seconds-486239.mp3'
import cafeUrl from './freesound_community-cafe-noise-32940.mp3'
import sillyTrumpetUrl from './floraphonic-silly-trumpet-3-187810.mp3'

import barkUrl from './OutsideSounds/audiopapkin-barking-large-and-small-dog-290711.mp3'
import busIdleUrl from './OutsideSounds/freesound_community-bus-engine-idling-26992.mp3'
import busPassUrl from './OutsideSounds/freesound_community-bus-passing-104115.mp3'
import carnivalUrl from './OutsideSounds/freesound_community-street-carnival-2-68333.mp3'
import cityUrl from './OutsideSounds/km007-city-ambience-9272.mp3'
import motorcycleUrl from './OutsideSounds/universfield-fast-motorcycle-pass-by-559409.mp3'

const STEPS_OUTSIDE_AT = 15
const ENTERS_CAFE_AT = 29
const ALARM_MS = 2000
const CELEBRATION_TRUMPET_STAGGER_MS = 300
const CARNIVAL_CAFE_VOLUME_MULTIPLIER = 0.25

function makeAudio(url, { loop = false, volume = 0.3 } = {}) {
  if (typeof Audio === 'undefined') return null
  const audio = new Audio(url)
  audio.loop = loop
  audio.volume = volume
  audio.__crazyBodBaseVolume = volume
  audio.preload = 'auto'
  return audio
}

function setClipVolume(audio, globalVolume, multiplier = 1) {
  if (!audio) return
  const baseVolume = Number(audio.__crazyBodBaseVolume ?? audio.volume)
  audio.volume = Math.min(1, Math.max(0, baseVolume * globalVolume * multiplier))
}

function startClip(audio) {
  if (!audio) return
  try {
    audio.currentTime = 0
  } catch {
    // The clip may not be seekable until its metadata loads.
  }
  audio.play().catch((error) => {
    console.warn('Journey audio playback failed:', error)
  })
}

function stopClip(audio) {
  if (!audio) return
  audio.pause()
  try {
    audio.currentTime = 0
  } catch {
    // Resetting an unloaded clip is harmless.
  }
}

function unlockClip(audio) {
  if (!audio) return

  const originalVolume = audio.volume
  audio.volume = 0
  audio.play()
    .then(() => {
      audio.pause()
      try {
        audio.currentTime = 0
      } catch {
        // Metadata may still be loading; the real playback resets it later.
      }
      audio.volume = originalVolume
    })
    .catch((error) => {
      audio.volume = originalVolume
      console.warn('Journey audio unlock failed:', error)
    })
}

function readJourneyState() {
  const shell = document.querySelector('.game-shell')
  const statusClass = shell
    ? Array.from(shell.classList).find((name) => name.startsWith('status-'))
    : null
  const status = statusClass?.slice('status-'.length) ?? 'intro'
  const tutorialPaused = Boolean(document.querySelector('.tutorial-layer'))
  const celebrationVisible = Boolean(document.querySelector('.cafe-celebration'))
  const load = document.querySelectorAll('.load-pips i.filled').length

  return { status, tutorialPaused, celebrationVisible, load }
}

function mutationShowsStartCue(record) {
  if (record.type === 'attributes') {
    return record.target instanceof Element
      && record.target.classList.contains('race-start-cue-start')
  }

  return Array.from(record.addedNodes).some((node) => (
    node instanceof Element
    && (
      node.classList.contains('race-start-cue-start')
      || Boolean(node.querySelector('.race-start-cue-start'))
    )
  ))
}

export function JourneyAudioBridge() {
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
      const startCueAppeared = records.some(mutationShowsStartCue)
      if (startCueAppeared) {
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

  useJourneyAudio(signals)
  return null
}

export default function useJourneyAudio({
  status,
  startCueToken,
  dayElapsed,
  load,
  tutorialPaused,
  celebrationVisible,
  volume = 1,
}) {
  const clipsRef = useRef(null)
  if (clipsRef.current === null) {
    clipsRef.current = {
      gravel: makeAudio(gravelUrl, { loop: true }),
      alarm: makeAudio(alarmUrl),
      rustle: makeAudio(rustleUrl, { loop: true }),
      goHome: makeAudio(goHomeUrl),
      overloaded: makeAudio(overloadedUrl),
      cafe: makeAudio(cafeUrl, { loop: true, volume: 0.425 }),
      carnival: makeAudio(carnivalUrl, { volume: 0.35 }),
      celebrationTrumpets: [
        makeAudio(sillyTrumpetUrl, { volume: 0.55 }),
        makeAudio(sillyTrumpetUrl, { volume: 0.55 }),
      ].filter(Boolean),
      outside: [barkUrl, busIdleUrl, busPassUrl, cityUrl, motorcycleUrl]
        .map((url) => makeAudio(url, { volume: 0.35 }))
        .filter(Boolean),
    }
  }

  const statusRef = useRef(status)
  statusRef.current = status
  const prevStatusRef = useRef(status)
  const outsideFiredRef = useRef(false)
  const cafeFiredRef = useRef(false)
  const prevLoadRef = useRef(load)
  const prevCelebrationVisibleRef = useRef(Boolean(celebrationVisible))
  const alarmTimerRef = useRef(null)
  const celebrationTimerRef = useRef(null)
  const tutorialPausedSetRef = useRef(new Set())

  const allClips = () => {
    const clips = clipsRef.current
    return [
      clips.gravel,
      clips.alarm,
      clips.rustle,
      clips.goHome,
      clips.overloaded,
      clips.cafe,
      clips.carnival,
      ...clips.celebrationTrumpets,
      ...clips.outside,
    ].filter(Boolean)
  }

  useEffect(() => {
    const clips = clipsRef.current
    allClips().forEach((audio) => setClipVolume(audio, volume))
    setClipVolume(
      clips.carnival,
      volume,
      cafeFiredRef.current ? CARNIVAL_CAFE_VOLUME_MULTIPLIER : 1,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume])

  const stopInRunClips = () => {
    const clips = clipsRef.current
    if (alarmTimerRef.current) {
      window.clearTimeout(alarmTimerRef.current)
      alarmTimerRef.current = null
    }
    if (celebrationTimerRef.current) {
      window.clearTimeout(celebrationTimerRef.current)
      celebrationTimerRef.current = null
    }
    stopClip(clips.gravel)
    stopClip(clips.alarm)
    stopClip(clips.rustle)
    stopClip(clips.cafe)
    stopClip(clips.carnival)
    clips.celebrationTrumpets.forEach(stopClip)
    clips.outside.forEach(stopClip)
  }

  useEffect(() => {
    let unlocked = false
    const unlockJourneyAudio = () => {
      if (unlocked) return
      unlocked = true
      allClips().forEach(unlockClip)
      window.removeEventListener('pointerdown', unlockJourneyAudio, true)
      window.removeEventListener('keydown', unlockJourneyAudio, true)
    }

    window.addEventListener('pointerdown', unlockJourneyAudio, true)
    window.addEventListener('keydown', unlockJourneyAudio, true)
    return () => {
      window.removeEventListener('pointerdown', unlockJourneyAudio, true)
      window.removeEventListener('keydown', unlockJourneyAudio, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const previous = prevStatusRef.current
    prevStatusRef.current = status
    if (status === previous) return

    const clips = clipsRef.current
    if (status === 'countdown') {
      stopInRunClips()
      stopClip(clips.goHome)
      stopClip(clips.overloaded)
      setClipVolume(clips.carnival, volume)
      tutorialPausedSetRef.current.clear()
      outsideFiredRef.current = false
      cafeFiredRef.current = false
      prevLoadRef.current = 0
      prevCelebrationVisibleRef.current = false
    } else if (status === 'home') {
      stopInRunClips()
      startClip(clips.goHome)
    } else if (status === 'overload') {
      stopInRunClips()
      startClip(clips.overloaded)
    } else if (status === 'complete') {
      stopInRunClips()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, volume])

  useEffect(() => {
    if (startCueToken <= 0) return

    const clips = clipsRef.current
    startClip(clips.alarm)
    if (alarmTimerRef.current) window.clearTimeout(alarmTimerRef.current)
    alarmTimerRef.current = window.setTimeout(() => {
      alarmTimerRef.current = null
      stopClip(clips.alarm)
      if (
        !outsideFiredRef.current
        && ['countdown', 'playing'].includes(statusRef.current)
      ) {
        startClip(clips.rustle)
      }
    }, ALARM_MS)
  }, [startCueToken])

  useEffect(() => {
    const appeared = celebrationVisible && !prevCelebrationVisibleRef.current
    prevCelebrationVisibleRef.current = Boolean(celebrationVisible)
    if (!appeared) return

    const [first, second] = clipsRef.current.celebrationTrumpets
    startClip(first)
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current)
    celebrationTimerRef.current = window.setTimeout(() => {
      celebrationTimerRef.current = null
      startClip(second)
    }, CELEBRATION_TRUMPET_STAGGER_MS)
  }, [celebrationVisible])

  useEffect(() => {
    if (status !== 'playing') return
    const clips = clipsRef.current
    if (!outsideFiredRef.current && dayElapsed >= STEPS_OUTSIDE_AT) {
      outsideFiredRef.current = true
      if (alarmTimerRef.current) {
        window.clearTimeout(alarmTimerRef.current)
        alarmTimerRef.current = null
      }
      stopClip(clips.alarm)
      stopClip(clips.rustle)
      startClip(clips.gravel)
    }
    if (!cafeFiredRef.current && dayElapsed >= ENTERS_CAFE_AT) {
      cafeFiredRef.current = true
      stopClip(clips.gravel)
      setClipVolume(clips.carnival, volume, CARNIVAL_CAFE_VOLUME_MULTIPLIER)
      startClip(clips.cafe)
    }
  }, [dayElapsed, status, volume])

  useEffect(() => {
    const loadIncreased = load > prevLoadRef.current
    if (
      status === 'playing'
      && outsideFiredRef.current
      && !cafeFiredRef.current
      && loadIncreased
    ) {
      const clips = clipsRef.current
      const pool = [...clips.outside, clips.carnival].filter(Boolean)
      if (pool.length) startClip(pool[Math.floor(Math.random() * pool.length)])
    }
    prevLoadRef.current = load
  }, [load, status])

  useEffect(() => {
    const paused = tutorialPausedSetRef.current
    if (tutorialPaused) {
      allClips().forEach((audio) => {
        if (!audio.paused && !audio.ended) {
          paused.add(audio)
          audio.pause()
        }
      })
    } else {
      paused.forEach((audio) => audio.play().catch((error) => {
        console.warn('Journey audio resume failed:', error)
      }))
      paused.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialPaused])

  useEffect(() => () => {
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current)
    allClips().forEach(stopClip)
  }, [])
}
