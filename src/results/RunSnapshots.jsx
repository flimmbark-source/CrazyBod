import { useCallback, useEffect, useState } from 'react'

// The "run snapshot" strip shown on the end screens: a lane of polaroids taken
// during the run — a few at random moments before the first conversation, then
// one at each dialogue choice (captioned with the line the player picked).
// Clicking a polaroid opens it enlarged in a lightbox above the end screen,
// where clicking the left/right of the screen shifts between pictures.

// Deterministic per-index scatter so a given polaroid always sits the same way
// (no reshuffle on re-render), giving the "tossed onto the table" look.
function tossFor(index) {
  const a = Math.sin((index + 1) * 12.9898) * 43758.5453
  const b = Math.sin((index + 1) * 78.233) * 24634.6345
  const fracA = a - Math.floor(a)
  const fracB = b - Math.floor(b)
  return {
    rotate: (fracA - 0.5) * 11,
    lift: fracB * 14,
  }
}

function Polaroid({ snapshot, index, onOpen }) {
  const { rotate, lift } = tossFor(index)
  return (
    <button
      type="button"
      className={`run-snapshot run-snapshot-${snapshot.kind}`}
      style={{
        '--snap-rotate': `${rotate.toFixed(2)}deg`,
        '--snap-lift': `${lift.toFixed(1)}px`,
        '--snap-index': index,
      }}
      onClick={() => onOpen(index)}
      aria-label={snapshot.caption ? `Snapshot: ${snapshot.caption}` : `Run snapshot ${index + 1}`}
    >
      <span className="run-snapshot-frame">
        <img src={snapshot.src} alt="" draggable="false" />
      </span>
      {snapshot.caption && <span className="run-snapshot-caption">{snapshot.caption}</span>}
    </button>
  )
}

function SnapshotLightbox({ snapshots, index, onClose, onShift }) {
  const snapshot = snapshots[index]

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') onShift(-1)
      else if (event.key === 'ArrowRight') onShift(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onShift])

  if (!snapshot) return null
  const hasMultiple = snapshots.length > 1

  return (
    <div
      className="snapshot-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Run snapshot viewer"
      onClick={onClose}
    >
      {hasMultiple && (
        <button
          type="button"
          className="snapshot-nav snapshot-nav-prev"
          aria-label="Previous snapshot"
          onClick={(event) => {
            event.stopPropagation()
            onShift(-1)
          }}
        >
          <span aria-hidden="true">‹</span>
        </button>
      )}

      <figure className="snapshot-stage" onClick={(event) => event.stopPropagation()}>
        <div className="snapshot-stage-frame">
          <img src={snapshot.src} alt={snapshot.caption || 'Run snapshot'} draggable="false" />
        </div>
        {snapshot.caption && <figcaption>{snapshot.caption}</figcaption>}
        {hasMultiple && (
          <span className="snapshot-count">{index + 1} / {snapshots.length}</span>
        )}
        <button
          type="button"
          className="snapshot-close"
          aria-label="Close snapshot viewer"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          ×
        </button>
      </figure>

      {hasMultiple && (
        <button
          type="button"
          className="snapshot-nav snapshot-nav-next"
          aria-label="Next snapshot"
          onClick={(event) => {
            event.stopPropagation()
            onShift(1)
          }}
        >
          <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  )
}

export default function RunSnapshotLane({ snapshots }) {
  const [activeIndex, setActiveIndex] = useState(null)

  const open = useCallback((index) => setActiveIndex(index), [])
  const close = useCallback(() => setActiveIndex(null), [])
  const shift = useCallback(
    (direction) => {
      setActiveIndex((current) => {
        if (current === null || snapshots.length === 0) return current
        const next = (current + direction + snapshots.length) % snapshots.length
        return next
      })
    },
    [snapshots.length],
  )

  if (!snapshots || snapshots.length === 0) return null

  return (
    <section className="run-snapshot-lane" aria-label="Run snapshots">
      <span className="run-snapshot-lane-label">RUN SNAPSHOT</span>
      <div className="run-snapshot-track">
        {snapshots.map((snapshot, index) => (
          <Polaroid key={snapshot.id} snapshot={snapshot} index={index} onOpen={open} />
        ))}
      </div>
      {activeIndex !== null && (
        <SnapshotLightbox
          snapshots={snapshots}
          index={activeIndex}
          onClose={close}
          onShift={shift}
        />
      )}
    </section>
  )
}
