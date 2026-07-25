import { useCallback, useEffect, useRef, useState } from 'react'

// Suppress Visible Distress. Intercepts an overload: the day, score and
// spawning are paused by the parent while the player mashes Space (or taps) to
// squeeze the overload down. Space is captured here — in the capture phase and
// with preventDefault — so a single press cannot also trigger a Space-based
// minigame underneath. Pointer input to those minigames stays live.
export default function SuppressionTechnique({ requiredPresses, onComplete }) {
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
    window.addEventListener('keydown', onKey, true) // capture: beat the minigames
    return () => window.removeEventListener('keydown', onKey, true)
  }, [bump])

  const ratio = Math.max(0, Math.min(1, presses / requiredPresses))

  return (
    <div className="suppression-overlay" role="alertdialog" aria-label="Suppress visible distress">
      <div className="suppression-core" style={{ '--squeeze': 1 - ratio * 0.4 }}>
        <span className="suppression-eyebrow">HOLD IT DOWN</span>
        <strong className="suppression-title">SUPPRESS</strong>
        <p className="suppression-hint">Mash Space to force it down.</p>
        <div className="suppression-meter">
          <i style={{ transform: `scaleX(${ratio})` }} />
        </div>
        <span className="suppression-count">{presses} / {requiredPresses}</span>
        <button type="button" className="suppression-mash" onClick={bump}>
          SQUEEZE
        </button>
      </div>
    </div>
  )
}
