import { useT } from '../i18n/i18n.js'

// The day's overload meter, lifted out of App.jsx unchanged. The Morning's
// losable practice borrows it, so the bar the player learns to read there is
// the same bar the day shows them.

export default function OverloadMeter({ load, capacity, highlighted = false }) {
  const t = useT()
  const overloadRatio = Math.min(1, load / capacity)
  const overloadShake = Math.max(0, load - 2) * 0.8

  return (
    <div
      className={`load-meter${highlighted ? ' tutorial-target tutorial-meter-target' : ''}`}
      aria-label={t('overload.aria', { load, capacity })}
      style={{
        '--overload': overloadRatio,
        '--overload-scale': 1 + overloadRatio * 0.16,
        '--overload-saturation': 1 + overloadRatio * 0.8,
        '--overload-contrast': 1 + overloadRatio * 0.14,
        '--overload-alpha': overloadRatio * 0.72,
        '--overload-shake': `${overloadShake}px`,
        '--overload-shake-neg': `${-overloadShake}px`,
      }}
    >
      <span>{t('overload.label')}</span>
      <div className="load-pips">
        {Array.from({ length: capacity }).map((_, index) => (
          <i key={index} className={index >= capacity - load ? 'filled' : ''} />
        ))}
      </div>
    </div>
  )
}
