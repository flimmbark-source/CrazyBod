import { useEffect, useRef } from 'react'

import popupUrl from './Pops/dragon-studio-pop-402323.mp3'
import interactionUrl from './universfield-mouse-click-351398.mp3'
import doorUrl from './dragon-studio-open-door-stock-sfx-454246.mp3'
import achievementUrl from './Orchestral-hit-achievement-sound-effect.mp3'

const APARTMENT_DOOR_OPENS_AT = 13.05
const CAFE_DOOR_OPENS_AT = 28.75
const OVERLOAD_STING_MS = 2000
const OVERLOAD_MUSIC_FILE = 'sonican-big-band-detective-30-seconds-486239.mp3'

function makeAudio(url, volume = 0.45) {
  if (typeof Audio === 'undefined') return null
  const audio = new Audio(url)
  audio.volume = volume
  audio.preload = 'auto'
  return audio
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
  clone.play().catch((error) => {
    console.warn('Requested journey sound playback failed:', error)
  })
}

export default function useRequestedJourneySfx({ status, dayElapsed, load }) {
  const clipsRef = useRef(null)
  if (clipsRef.current === null) {
    clipsRef.current = {
      popup: makeAudio(popupUrl, 0.5),
      interaction: makeAudio(interactionUrl, 0.38),
      door: makeAudio(doorUrl, 0.5),
      achievement: makeAudio(achievementUrl, 0.58),
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
    const originalPlay = HTMLMediaElement.prototype.play
    originalPlayRef.current = originalPlay

    HTMLMediaElement.prototype.play = function patchedPlay(...args) {
      const source = this.currentSrc || this.src || ''
      if (source.includes(OVERLOAD_MUSIC_FILE) && !allowOverloadMusicRef.current) {
        delayedOverloadMusicRef.current = this
        return Promise.resolve()
      }
      return originalPlay.apply(this, args)
    }

    return () => {
      HTMLMediaElement.prototype.play = originalPlay
      originalPlayRef.current = null
    }
  }, [])

  useEffect(() => {
    const clips = clipsRef.current
    let unlocked = false
    const unlock = () => {
      if (unlocked) return
      unlocked = true
      Object.values(clips).forEach((audio) => {
        if (!audio) return
        const volume = audio.volume
        audio.volume = 0
        audio.play()
          .then(() => {
            resetAudio(audio)
            audio.volume = volume
          })
          .catch(() => {
            audio.volume = volume
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
