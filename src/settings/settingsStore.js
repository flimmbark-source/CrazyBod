// A tiny module-level store for the two player-facing settings: audio volume
// and language. Both the main App tree and the separate ReadyJourneyAudioBridge
// root read from here, so the settings live outside React and are shared through
// subscriptions rather than passed as props between the two roots.

import { useSyncExternalStore } from 'react'

const VOLUME_KEY = 'crazybod:audio-volume'
const LANGUAGE_KEY = 'crazybod:language'

export const SUPPORTED_LANGUAGES = ['en', 'he']
export const DEFAULT_LANGUAGE = 'en'
const RTL_LANGUAGES = new Set(['he'])

function readStoredVolume() {
  try {
    const storedValue = window.localStorage.getItem(VOLUME_KEY)
    if (storedValue === null) return 0.5

    const stored = Number(storedValue)
    return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 0.5
  } catch {
    return 0.5
  }
}

function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY)
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

let state = {
  volume: readStoredVolume(),
  language: readStoredLanguage(),
}

const listeners = new Set()

function emit() {
  for (const listener of listeners) listener()
}

// Reflect the language on the document so the browser applies the correct text
// direction (Hebrew is right-to-left) and lang attribute for accessibility.
function applyDocumentLanguage(language) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.lang = language
  root.dir = RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr'
}

// Set the initial document direction as soon as the module loads.
applyDocumentLanguage(state.language)

export function getSettings() {
  return state
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getVolume() {
  return state.volume
}

export function getLanguage() {
  return state.language
}

export function isRtl(language = state.language) {
  return RTL_LANGUAGES.has(language)
}

export function setVolume(nextVolume) {
  const clamped = Math.min(1, Math.max(0, nextVolume))
  if (clamped === state.volume) return
  state = { ...state, volume: clamped }
  try {
    window.localStorage.setItem(VOLUME_KEY, String(clamped))
  } catch {
    // Audio still updates for this session when storage is unavailable.
  }
  emit()
}

export function setLanguage(nextLanguage) {
  if (!SUPPORTED_LANGUAGES.includes(nextLanguage) || nextLanguage === state.language) return
  state = { ...state, language: nextLanguage }
  applyDocumentLanguage(nextLanguage)
  try {
    window.localStorage.setItem(LANGUAGE_KEY, nextLanguage)
  } catch {
    // The choice still applies for this session when storage is unavailable.
  }
  emit()
}

// Subscribe a component to the whole settings object.
export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}

// Subscribe a component to just the language (re-renders on language change).
export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage)
}
