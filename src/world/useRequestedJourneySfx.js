import { useEffect, useRef } from 'react'

import popupUrl from './Pops/dragon-studio-pop-402323.mp3'
import interactionUrl from './universfield-mouse-click-351398.mp3'
import doorUrl from './dragon-studio-open-door-stock-sfx-454246.mp3'
import achievementUrl from './Orchestral-hit-achievement-sound-effect.mp3'
import progressUrl from './universfield-new-notification-059-494262.mp3'
import completionUrl from './universfield-new-notification-04-326127.mp3'

const APARTMENT_DOOR_OPENS_AT = 13.05
const CAFE_DOOR_OPENS_AT = 28.75
const OVERLOAD_STING_MS = 1300
const OVERLOAD_MUSIC_FILE = 'sonican-big-band-detective-30-seconds-486239.mp3'
const PROGRESS_IDLE_MS = 180
const PROGRESS_INTERVAL_MS = 140
const PROGRESS_BASE_RATE = 1
const PROGRESS_RATE_STEP = 0.06
const PROGRESS_MAX_RATE = 2

function makeAudio(url, volume = 0.45, { loop = false } = {}) {
  if (typeof Audio === 'undefined') return null
  const audio = new Audio(url)
  audio.volume = volume
  audio.preload = 'auto'
  audio.loop = loop
  audio.__crazyBodBaseVolume = volume
  return audio
}

function applyMasterVolume(audio, volume) {
  if (!audio) return
  const baseVolume = Number(audio.__crazyBodBaseVolume ?? audio.volume)
  audio.volume = Math.min(1, Math.max(0, baseVolume * volume))
}

function resetAudio(audio) {
  if (!audio) return
  audio.pause()
  try {
    audio.currentTime = 0
  } catch {
    // Metadata may not be loaded yet.
  }
}

function playAudio(audio) {
  if (!audio) return
  try {
    audio.currentTime = 0
  } catch {
    // The clip can still play even if it is not seekable yet.
  }
  audio.play().catch((error) => {
    console.warn('Requested journey sound playback failed:', error)
  })
}

function playClone(audio) {
  if (!audio) return
  const clone = audio.cloneNode()
  clone.volume = audio.volume
  clone.playbackRate = audio.playbackRate
  clone.play().catch((error) => {
    console.warn('Requested journey sound playback failed:', error)
  })
}

function progressPercentage(element) {
  const inlineWidth = Number.parseFloat(element.style.width)
  if (Number.isFinite(inlineWidth)) return Math.min(100, Math.max(0, inlineWidth))

  const track = element.parentElement
  if (!track) return 0
  const trackWidth = track.getBoundingClientRect().width
  if (trackWidth <= 0) return 0
  return Math.min(100, Math.max(0, (element.getBoundingClientRect().width / trackWidth) * 100))
}

function countCompletionBursts(node) {
  if (!(node instanceof Element)) return 0
  return (node.classList.contains('completion-burst') ? 1 : 0)
    + node.querySelectorAll('.completion-burst').length
}

export default function useRequestedJourneySfx({ status, dayElapsed, load, volume = 1 }) {
  const clipsRef = useRef(null)
  if (clipsRef.current === null) {
    clipsRef.current = {
      popup: makeAudio(popupUrl, 0.5),
      interaction: makeAudio(interactionUrl, 0.38),
      door: makeAudio(doorUrl, 0.5),
      achievement: makeAudio(achievementUrl, 0.58),
      progress: makeAudio(progressUrl, 0.34),
      completion: makeAudio(completionUrl, 0.52),
    }
  }

  const previousLoadRef = useRef(load)
  const previousElapsedRef = useRef(dayElapsed)
  const firedDoorsRef = useRef(new Set())
  const overloadTimerRef = useRef(null)
  const delayedOverloadMusicRef = useRef(null)
  const allowOverloadMusicRef = useRef(false)
  const originalPlayRef = useRef(null)

  useEffect(() => {
    Object.values(clipsRef.current).forEach((audio) => applyMasterVolume(audio, volume))
    const delayedMusic = delayedOverloadMusicRef.current
    if (delayedMusic) {
      delayedMusic.__crazyBodBaseVolume ??= delayedMusic.volume
      applyMasterVolume(delayedMusic, volume)
    }
  }, [volume])

  useEffect(() => {
    const originalPlay = HTMLMediaElement.prototype.play
    originalPlayRef.current = originalPlay

    HTMLMediaElement.prototype.play = function patchedPlay(...args) {
      const source = this.currentSrc || this.src || ''
      if (source.includes(OVERLOAD_MUSIC_FILE) && !allowOverloadMusicRef.current) {
        delayedOverloadMusicRef.current = this
        this.__crazyBodBaseVolume ??= this.volume
        applyMasterVolume(this, volume)
        return Promise.resolve()
      }
      return originalPlay.apply(this, args)
    }

    return () => {
      HTMLMediaElement.prototype.play = originalPlay
      originalPlayRef.current = null
    }
  }, [volume])

  useEffect(() => {
    const clips = clipsRef.current
    let unlocked = false
    const unlock = () => {
      if (unlocked) return
      unlocked = true
      Object.values(clips).forEach((audio) => {
        if (!audio) return
        const audibleVolume = audio.volume
        audio.volume = 0
        audio.play()
          .then(() => {
            resetAudio(audio)
            audio.volume = audibleVolume
          })
          .catch(() => {
            audio.volume = audibleVolume
          })
      })
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }

    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('.microgame-body')) return
      playClone(clipsRef.current.interaction)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [])

  useEffect(() => {
    // Completion bursts only appear during play; skip observing the whole body
    // (and reacting to unrelated DOM churn) on every other screen.
    if (status !== 'playing') return undefined

    const observer = new MutationObserver((records) => {
      const completed = records.reduce((total, record) => (
        total + Array.from(record.addedNodes).reduce(
          (count, node) => count + countCompletionBursts(node),
          0,
        )
      ), 0)

      for (let index = 0; index < completed; index += 1) {
        playClone(clipsRef.current.completion)
      }
    })

    observer.observe(document.body, { subtree: true, childList: true })
    return () => observer.disconnect()
  }, [status])

  useEffect(() => {
    // The progress loop only scans bars during play; don't run a per-frame DOM
    // query on the intro, results, or overload screens.
    if (status !== 'playing') return undefined

    const progressAudio = clipsRef.current.progress
    const previousValues = new WeakMap()
    const lastMovingAt = new WeakMap()
    let frame = 0
    let lastTriggerAt = Number.NEGATIVE_INFINITY
    let pitchStep = 0

    const tick = (now) => {
      const bars = Array.from(document.querySelectorAll('.mini-progress > i, .tiny-progress > i'))
      let anyMoving = false

      bars.forEach((bar) => {
        const current = progressPercentage(bar)
        const previous = previousValues.get(bar)
        if (Number.isFinite(previous) && current > previous + 0.04) {
          lastMovingAt.set(bar, now)
        }
        previousValues.set(bar, current)

        const movedAt = lastMovingAt.get(bar)
        if (Number.isFinite(movedAt) && now - movedAt <= PROGRESS_IDLE_MS) {
          anyMoving = true
        }
      })

      if (anyMoving && progressAudio) {
        // Steady cadence, but each retrigger steps up a notch in pitch so the
        // loop climbs while the bar fills instead of just speeding up.
        if (now - lastTriggerAt >= PROGRESS_INTERVAL_MS) {
          lastTriggerAt = now
          progressAudio.playbackRate = Math.min(
            PROGRESS_MAX_RATE,
            PROGRESS_BASE_RATE + pitchStep * PROGRESS_RATE_STEP,
          )
          playClone(progressAudio)
          pitchStep += 1
        }
      } else {
        lastTriggerAt = Number.NEGATIVE_INFINITY
        pitchStep = 0
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [status])

  useEffect(() => {
    const added = load - previousLoadRef.current
    previousLoadRef.current = load
    if (status !== 'playing' || added <= 0) return

    for (let index = 0; index < added; index += 1) {
      window.setTimeout(() => playClone(clipsRef.current.popup), index * 70)
    }
  }, [load, status])

  useEffect(() => {
    if (status === 'countdown' || dayElapsed < previousElapsedRef.current) {
      firedDoorsRef.current.clear()
      previousElapsedRef.current = dayElapsed
      return
    }

    if (status !== 'playing') {
      previousElapsedRef.current = dayElapsed
      return
    }

    const previous = previousElapsedRef.current
    const doors = [
      ['apartment', APARTMENT_DOOR_OPENS_AT],
      ['cafe', CAFE_DOOR_OPENS_AT],
    ]

    doors.forEach(([id, opensAt]) => {
      if (previous < opensAt && dayElapsed >= opensAt && !firedDoorsRef.current.has(id)) {
        firedDoorsRef.current.add(id)
        playClone(clipsRef.current.door)
      }
    })
    previousElapsedRef.current = dayElapsed
  }, [dayElapsed, status])

  useEffect(() => {
    if (status === 'countdown') {
      allowOverloadMusicRef.current = false
      if (overloadTimerRef.current) window.clearTimeout(overloadTimerRef.current)
      overloadTimerRef.current = null
      resetAudio(clipsRef.current.achievement)
      resetAudio(delayedOverloadMusicRef.current)
      delayedOverloadMusicRef.current = null
      return
    }

    if (status !== 'overload') return

    allowOverloadMusicRef.current = false
    playAudio(clipsRef.current.achievement)
    overloadTimerRef.current = window.setTimeout(() => {
      overloadTimerRef.current = null
      resetAudio(clipsRef.current.achievement)
      allowOverloadMusicRef.current = true
      const music = delayedOverloadMusicRef.current
      const originalPlay = originalPlayRef.current
      if (!music || !originalPlay) return
      try {
        music.currentTime = 0
      } catch {
        // Start from the beginning when the browser allows seeking.
      }
      originalPlay.call(music).catch((error) => {
        console.warn('Overload music playback failed:', error)
      })
    }, OVERLOAD_STING_MS)

    return () => {
      if (overloadTimerRef.current) window.clearTimeout(overloadTimerRef.current)
      overloadTimerRef.current = null
    }
  }, [status])

  useEffect(() => () => {
    if (overloadTimerRef.current) window.clearTimeout(overloadTimerRef.current)
    Object.values(clipsRef.current).forEach(resetAudio)
  }, [])
}
