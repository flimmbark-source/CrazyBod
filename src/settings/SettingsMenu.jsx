import { useEffect, useRef, useState } from 'react'

import { setLanguage, setVolume, useSettings, SUPPORTED_LANGUAGES } from './settingsStore.js'
import { useT } from '../i18n/i18n.js'

// Each language is labelled in its own script so the selector is readable
// whatever the current language is.
const LANGUAGE_LABELS = {
  en: 'English',
  he: 'עברית',
}

// The shared settings menu: a gear button that opens a panel with the sound
// slider and the language selector. It reads and writes the global settings
// store directly, so it needs no props beyond an optional placement variant and
// can be dropped onto any screen.
export default function SettingsMenu({ variant = 'fixed' }) {
  const t = useT()
  const { volume, language } = useSettings()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const percentage = Math.round(volume * 100)

  // Close the panel when clicking away or pressing Escape, so it does not stay
  // hovering over the screen it was opened from.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <aside
      ref={rootRef}
      className={`settings-menu settings-menu-${variant}${open ? ' settings-menu-open' : ''}`}
    >
      <button
        className="settings-menu-gear"
        type="button"
        aria-label={open ? t('settings.close') : t('settings.open')}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-menu-panel">
          <div className="settings-menu-group">
            <label htmlFor="settings-volume">{t('settings.sound')}</label>
            <input
              id="settings-volume"
              type="range"
              min="0"
              max="100"
              step="1"
              value={percentage}
              onChange={(event) => setVolume(Number(event.target.value) / 100)}
            />
            <output htmlFor="settings-volume">{percentage}%</output>
          </div>

          <div className="settings-menu-group settings-menu-language">
            <span className="settings-menu-language-label">{t('settings.language')}</span>
            <div className="settings-menu-language-options" role="group" aria-label={t('settings.language')}>
              {SUPPORTED_LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`settings-menu-language-option${language === code ? ' is-selected' : ''}`}
                  aria-pressed={language === code}
                  lang={code}
                  onClick={() => setLanguage(code)}
                >
                  {LANGUAGE_LABELS[code] ?? code}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
