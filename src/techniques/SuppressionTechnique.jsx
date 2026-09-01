import { useCallback, useEffect, useRef, useState } from 'react'

import { useT } from '../i18n/i18n.js'

// Suppress Visible Distress. Intercepts an overload: the day, score and
// spawning are paused by the parent while the player mashes Space (or taps) to
// squeeze the overload down. Space is captured here — in the capture phase and
// with preventDefault — so a single press cannot also trigger a Space-based
// minigame underneath. Pointer input to those minigames stays live.
export default function SuppressionTechnique({ requiredPresses, onComplete }) {
  const t = useT()
  const [presses, setPresses] = useState(0)
  const doneRef = useRef(false)

  const bump = useCallback(() => {
    setPresses((current) => {
      if (doneRef.current) return current
      const next = current + 1
      if (next >= requiredPresses) {
        doneRef.current = true
        queueMicrotask(onComplete)
      }
      return Math.min(next, requiredPresses)
    })
  }, [requiredPresses, onComplete])

  useEffect(() => {
    const onKey = (event) => {
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        bump()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [bump])

  const ratio = Math.max(0, Math.min(1, presses / requiredPresses))

  return (
    <div className="suppression-overlay" role="alertdialog" aria-label={t('suppress.aria')}>
      <section className="suppression-core" style={{ '--squeeze': 1 - ratio * 0.04 }}>
        <div className="suppression-speaker-row">
          <span className="suppression-portrait" aria-hidden="true">!</span>
          <div className="suppression-copy">
            <span className="suppression-eyebrow">{t('suppress.eyebrow')}</span>
            <strong className="suppression-title">{t('suppress.title')}</strong>
            <p className="suppression-hint">{t('suppress.hint')}</p>
          </div>
        </div>

        <div className="suppression-meter" aria-hidden="true">
          <i style={{ transform: `scaleX(${ratio})` }} />
        </div>

        <div className="suppression-actions">
          <span className="suppression-count">{presses} / {requiredPresses}</span>
          <button type="button" className="suppression-mash" onClick={bump}>
            {t('suppress.squeeze')}
          </button>
        </div>
      </section>
    </div>
  )
}
