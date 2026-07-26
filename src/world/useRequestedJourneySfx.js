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
const MIN_PROGRESS_RATE = 1.1
const MAX_PROGRESS_RATE = 1.9
const MAX_PROGRESS_INTERVAL_MS = 125
const MIN_PROGRESS_INTERVAL_MS = 42

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
    const observer = new MutationObserver((records) => {
      if (status !== 'playing') return
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
    const progressAudio = clipsRef.current.progress
    const previousValues = new WeakMap()
    const lastMovingAt = new WeakMap()
    let frame = 0
    let lastTriggerAt = Number.NEGATIVE_INFINITY

    const tick = (now) => {
      const bars = Array.from(document.querySelectorAll('.mini-progress > i, .tiny-progress > i'))
      let highestMovingProgress = -1

      bars.forEach((bar) => {
        const current = progressPercentage(bar)
        const previous = previousValues.get(bar)
        if (Number.isFinite(previous) && current > previous + 0.04) {
          lastMovingAt.set(bar, now)
        }
        previousValues.set(bar, current)

        const movedAt = lastMovingAt.get(bar)
        if (Number.isFinite(movedAt) && now - movedAt <= PROGRESS_IDLE_MS) {
          highestMovingProgress = Math.max(highestMovingProgress, current)
        }
      })

      if (status === 'playing' && highestMovingProgress >= 0 && progressAudio) {
        const ratio = highestMovingProgress / 100
        const interval = MAX_PROGRESS_INTERVAL_MS
          - (MAX_PROGRESS_INTERVAL_MS - MIN_PROGRESS_INTERVAL_MS) * ratio
        progressAudio.playbackRate = MIN_PROGRESS_RATE
          + (MAX_PROGRESS_RATE - MIN_PROGRESS_RATE) * ratio

        if (now - lastTriggerAt >= interval) {
          lastTriggerAt = now
          playClone(progressAudio)
        }
      } else {
        lastTriggerAt = Number.NEGATIVE_INFINITY
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
