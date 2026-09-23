import { useT } from '../i18n/i18n.js'

// The day's overload meter. The Morning borrows it for the practice that can
// actually be lost, so the bar the player learns to read is the same bar.

// How full is too full, in words: two plain steps before the bust, so the climb
// is something you can watch coming instead of something that happens to you.
export function overloadBand(load, capacity) {
  const slotsLeft = Math.max(0, capacity - load)
  return slotsLeft <= 1 ? 'edge' : slotsLeft <= 2 ? 'rising' : 'calm'
}

export default function OverloadMeter({ t, load, capacity, band, ratio, shake, highlighted = false }) {
  return (
    <div
      className={[
        'load-meter',
        `load-band-${band}`,
        highlighted ? 'tutorial-target tutorial-meter-target' : '',
      ].filter(Boolean).join(' ')}
      dir="ltr"
      aria-label={t('overload.aria', { load, capacity })}
      style={{
        '--overload': ratio,
        '--overload-scale': 1 + ratio * 0.16,
        '--overload-saturation': 1 + ratio * 0.8,
        '--overload-contrast': 1 + ratio * 0.14,
        '--overload-alpha': ratio * 0.72,
        '--overload-shake': `${shake}px`,
        '--overload-shake-neg': `${-shake}px`,
      }}
    >
      <span className="load-meter-title">
        {t('overload.label')}
        <b className="load-meter-count">{load}/{capacity}</b>
      </span>
      <div className="load-pips">
        {Array.from({ length: capacity }).map((_, index) => (
          <i
            key={index}
            className={[
              index < load ? 'filled' : '',
              index === capacity - 1 ? 'last-slot' : '',
            ].filter(Boolean).join(' ')}
          />
        ))}
      </div>
      {/* Two plain-language steps before the bust, so the climb is something
          you can watch coming instead of something that happens to you. */}
      <strong className="load-meter-status" aria-live="polite">
        {band === 'edge'
          ? t('overload.edge')
          : band === 'rising'
            ? t('overload.rising', { left: capacity - load })
            : t('overload.room', { left: capacity - load })}
      </strong>
    </div>
  )
}
