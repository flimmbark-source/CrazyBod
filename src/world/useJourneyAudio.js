import { useEffect, useRef } from 'react'

// Journey soundtrack. All playback is owned here so App only has to feed the
// hook the run signals it already tracks (status, the START! cue, the day
// clock, the overload load and whether a tutorial has the game paused).
//
// Timeline, in dayElapsed seconds:
//   - START! flashes            -> alarm clock beep for 1s, then bed-sheet
//                                  rustle looping until the player is outside.
//   - STEPS_OUTSIDE_AT (15)     -> gravel footsteps loop (rustle stops).
//   - ENTERS_CAFE_AT (29)       -> café ambience loops (gravel stops).
//   - each overload pip fills   -> one random OutsideSounds clip.
//   - Go Home pressed           -> brass funk jingle (a results-page track).
//   - Overloaded                -> big band detective cue (a results-page track).
//
// The two results-page tracks keep playing across the results / skill tree /
// title screens and are only silenced when a fresh run begins (runToken bump),
// i.e. the player pressed TRY ANOTHER DAY / PLAY TUTORIAL / START THE DAY.
// Everything else is paused while a tutorial callout has the game paused.

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
    // Some browsers throw if the media is not seekable yet; play still works.
  }
  audio.play().catch(() => {})
}

function stopClip(audio) {
  if (!audio) return
  audio.pause()
  try {
    audio.currentTime = 0
  } catch {
    // Ignore: resetting a not-yet-loaded clip is harmless.
  }
}

export default function useJourneyAudio({ status, startCue, dayElapsed, load, tutorialPaused, runToken }) {
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

  // Every clip, so pause/resume and full stops can sweep them uniformly.
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

  // The in-run soundscape: everything except the two results-page tracks, which
  // are meant to outlive the run itself.
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

  // Start of a fresh run (TRY ANOTHER DAY / PLAY TUTORIAL / START THE DAY):
  // silence everything, including the lingering results-page tracks, and rearm
  // the one-shot triggers for the new run.
  useEffect(() => {
    const clips = clipsRef.current
    stopInRunClips()
    stopClip(clips.goHome)
    stopClip(clips.overloaded)
    tutorialPausedSetRef.current.clear()
    outsideFiredRef.current = false
    cafeFiredRef.current = false
    prevLoadRef.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken])

  // START! flashes: alarm for one second, then the bed-sheet rustle until the
  // player heads outside.
  useEffect(() => {
    if (startCue !== 'start') return
    const clips = clipsRef.current
    startClip(clips.alarm)
    alarmTimerRef.current = window.setTimeout(() => {
      alarmTimerRef.current = null
      stopClip(clips.alarm)
      if (!outsideFiredRef.current && statusRef.current === 'playing') {
        startClip(clips.rustle)
      }
    }, ALARM_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCue])

  // Day-clock thresholds: stepping outside, then entering the café.
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

  // Each time the overload bar gains a pip, play one random street clip.
  useEffect(() => {
    if (status === 'playing' && load > prevLoadRef.current) {
      const pool = clipsRef.current.outside
      if (pool.length) startClip(pool[Math.floor(Math.random() * pool.length)])
    }
    prevLoadRef.current = load
  }, [load, status])

  // Run stops. Going home and overloading each start their results-page track;
  // reaching the café simply ends the in-run soundscape.
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (status === prev) return
    const clips = clipsRef.current
    if (status === 'home') {
      stopInRunClips()
      startClip(clips.goHome)
    } else if (status === 'overload') {
      stopInRunClips()
      startClip(clips.overloaded)
    } else if (status === 'complete') {
      stopInRunClips()
    }
  }, [status])

  // A tutorial callout freezes the game: pause whatever is sounding and resume
  // exactly those clips when play continues.
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
      paused.forEach((audio) => {
        audio.play().catch(() => {})
      })
      paused.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialPaused])

  // Silence everything if the whole app unmounts.
  useEffect(() => () => allClips().forEach(stopClip), [])
}
