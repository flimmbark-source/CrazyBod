import { useEffect, useRef, useState } from 'react'
import { DAY_LENGTH } from '../config/gameConfig.js'

import gravelUrl from './kokoreli777-walking-on-a-gravel-169409.mp3'
import alarmUrl from './freesound_community-alarm-clock-beep-close-perspective-7092.mp3'
import rustleUrl from './freesound_community-foley-getting-in-and-out-of-bed-sheets-fabric-rustle-76964.mp3'
import goHomeUrl from './sergequadrado-brass-funk-jingle-449585.mp3'
import overloadedUrl from './sonican-big-band-detective-30-seconds-486239.mp3'
import cafeUrl from './freesound_community-cafe-noise-32940.mp3'

import barkUrl from './OutsideSounds/audiopapkin-barking-large-and-small-dog-290711.mp3'
import busIdleUrl from './OutsideSounds/freesound_community-bus-engine-idling-26992.mp3'
import busPassUrl from './OutsideSounds/freesound_community-bus-passing-104115.mp3'
import carnivalUrl from './OutsideSounds/freesound_community-street-carnival-2-68333.mp3'
import cityUrl from './OutsideSounds/km007-city-ambience-9272.mp3'
import motorcycleUrl from './OutsideSounds/universfield-fast-motorcycle-pass-by-559409.mp3'

const STEPS_OUTSIDE_AT = 15
const ENTERS_CAFE_AT = 29
const ALARM_MS = 1000
const OUTSIDE_SOUND_CHANCE = 0.5

function makeAudio(url, { loop = false, volume = 1 } = {}) {
  if (typeof Audio === 'undefined') return null
  const audio = new Audio(url)
  audio.loop = loop
  audio.volume = volume
  audio.preload = 'auto'
  return audio
}

function startClip(audio) {
  if (!audio) return
  try {
    audio.currentTime = 0
  } catch {
    // The clip may not be seekable until its metadata loads.
  }
  audio.play().catch(() => {})
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

function readJourneyState() {
  const shell = document.querySelector('.game-shell')
  const statusClass = shell
    ? Array.from(shell.classList).find((name) => name.startsWith('status-'))
    : null
  const status = statusClass?.slice('status-'.length) ?? 'intro'
  const tutorialPaused = Boolean(document.querySelector('.tutorial-layer'))
  const load = document.querySelectorAll('.load-pips i.filled').length
  const timeText = document.querySelector('.hud .hud-panel strong')?.textContent ?? ''
  const remaining = Number.parseFloat(timeText)
  const dayElapsed = Number.isFinite(remaining) ? Math.max(0, DAY_LENGTH - remaining) : 0

  return { status, tutorialPaused, load, dayElapsed }
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
    startCueToken: 0,
  }))

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setSignals((current) => ({
        ...readJourneyState(),
        startCueToken: current.startCueToken,
      }))
    }
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    const observer = new MutationObserver((records) => {
      const startCueAppeared = records.some(mutationShowsStartCue)
      if (startCueAppeared) {
        setSignals((current) => ({
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

export default function useJourneyAudio({ status, startCueToken, dayElapsed, load, tutorialPaused }) {
  const clipsRef = useRef(null)
  if (clipsRef.current === null) {
    clipsRef.current = {
      gravel: makeAudio(gravelUrl, { loop: true }),
      alarm: makeAudio(alarmUrl),
      rustle: makeAudio(rustleUrl, { loop: true }),
      goHome: makeAudio(goHomeUrl, { loop: true }),
      overloaded: makeAudio(overloadedUrl, { loop: true }),
      cafe: makeAudio(cafeUrl, { loop: true, volume: 0.85 }),
      outside: [barkUrl, busIdleUrl, busPassUrl, carnivalUrl, cityUrl, motorcycleUrl]
        .map((url) => makeAudio(url, { volume: 0.7 }))
        .filter(Boolean),
    }
  }

  const statusRef = useRef(status)
  statusRef.current = status
  const prevStatusRef = useRef(status)
  const outsideFiredRef = useRef(false)
  const cafeFiredRef = useRef(false)
  const prevLoadRef = useRef(load)
  const alarmTimerRef = useRef(null)
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
      ...clips.outside,
    ].filter(Boolean)
  }

  const stopInRunClips = () => {
    const clips = clipsRef.current
    if (alarmTimerRef.current) {
      window.clearTimeout(alarmTimerRef.current)
      alarmTimerRef.current = null
    }
    stopClip(clips.gravel)
    stopClip(clips.alarm)
    stopClip(clips.rustle)
    stopClip(clips.cafe)
    clips.outside.forEach(stopClip)
  }

  useEffect(() => {
    const previous = prevStatusRef.current
    prevStatusRef.current = status
    if (status === previous) return

    const clips = clipsRef.current
    if (status === 'countdown') {
      stopInRunClips()
      stopClip(clips.goHome)
      stopClip(clips.overloaded)
      tutorialPausedSetRef.current.clear()
      outsideFiredRef.current = false
      cafeFiredRef.current = false
      prevLoadRef.current = 0
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
  }, [status])

  useEffect(() => {
    if (startCueToken <= 0) return

    const clips = clipsRef.current
    startClip(clips.alarm)
    if (alarmTimerRef.current) window.clearTimeout(alarmTimerRef.current)
    alarmTimerRef.current = window.setTimeout(() => {
      alarmTimerRef.current = null
      stopClip(clips.alarm)
      if (!outsideFiredRef.current && statusRef.current === 'playing') {
        startClip(clips.rustle)
      }
    }, ALARM_MS)
  }, [startCueToken])

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
      startClip(clips.cafe)
    }
  }, [dayElapsed, status])

  useEffect(() => {
    const loadIncreased = load > prevLoadRef.current
    if (
      status === 'playing'
      && outsideFiredRef.current
      && !cafeFiredRef.current
      && loadIncreased
      && Math.random() < OUTSIDE_SOUND_CHANCE
    ) {
      const pool = clipsRef.current.outside
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
      paused.forEach((audio) => audio.play().catch(() => {}))
      paused.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialPaused])

  useEffect(() => () => allClips().forEach(stopClip), [])
}
