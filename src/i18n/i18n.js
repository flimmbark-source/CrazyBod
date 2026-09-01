// The translation layer. Strings are looked up by stable key so the underlying
// data structures (skill tree config, café dialogue, technique prompts) keep
// their English source — which the test-suite still asserts against — while the
// UI renders whichever language the player has selected.

import { getLanguage, subscribe } from '../settings/settingsStore.js'
import { useSyncExternalStore } from 'react'
import { translations } from './translations.js'

function interpolate(template, params) {
  if (!params) return template
  return Object.keys(params).reduce(
    (result, key) => result.split(`{${key}}`).join(String(params[key])),
    template,
  )
}

// Resolve a key for the given language, falling back to English and finally to
// the key itself so a missing translation degrades gracefully rather than
// rendering blank.
export function translateFor(language, key, params) {
  const dictionary = translations[language] ?? translations.en
  const value = dictionary[key] ?? translations.en[key] ?? key
  return interpolate(value, params)
}

export function translate(key, params) {
  return translateFor(getLanguage(), key, params)
}

// A hook that both subscribes the component to language changes and returns a
// bound translate function. Any component using strings should call this so it
// re-renders when the language switches.
export function useT() {
  const language = useSyncExternalStore(subscribe, getLanguage, getLanguage)
  return (key, params) => translateFor(language, key, params)
}
