import { useEffect, useMemo, useRef, useState } from 'react'

import { useT } from '../i18n/i18n.js'

// A shared "list + picture" technique screen.
//
// Both in-house upgrades used to be a bare column of words you clicked (and, in
// the stretch's case, clicked and held). That asks the player to read a list and
// hold a button, which is neither a picture of the thing nor much of an action.
// Here the thing is drawn: the checklist says what to get, and you grab it out
// of the scene. Nothing has to be held down.
//
// `items` are placed on a 0-100 picture grid. With `ordered`, the checklist is
// a sequence and grabbing out of turn is a mistake; without it, any order does.

function RoomScene() {
  return (
    <g className="pick-scene-art" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {/* floor line */}
      <path d="M0 74h100" strokeWidth="1.1" />
      {/* window, with the shelf under it */}
      <rect x="9" y="10" width="24" height="19" rx="1.2" strokeWidth="1.1" />
      <path d="M21 10v19M9 19.5h24" strokeWidth="0.8" />
      <path d="M8 40h26" strokeWidth="1.1" />
      {/* side table */}
      <path d="M38 58h28M42 58v16M62 58v16" strokeWidth="1.1" />
      {/* coat hooks */}
      <path d="M71 13h16M75 13v6M83 13v6" strokeWidth="1" />
      {/* front door */}
      <path d="M71 26h21v48H71z" strokeWidth="1.1" />
      <path d="M75.5 51h2.5" strokeWidth="1.6" />
    </g>
  )
}

function BodyScene() {
  return (
    <g className="pick-scene-art" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="11" r="7" strokeWidth="1.1" />
      <path d="M50 18v31" strokeWidth="1.1" />
      <path d="M32 27h36" strokeWidth="1.1" />
      <path d="M32 27l-6 15M68 27l6 15" strokeWidth="1.1" />
      <path d="M26 42l-4 13M74 42l4 13" strokeWidth="1.1" />
      <path d="M50 49l-10 17M50 49l10 17" strokeWidth="1.1" />
      <path d="M40 66l-3 18M60 66l3 18" strokeWidth="1.1" />
      <path d="M32 86h9M59 86h9" strokeWidth="1.1" />
    </g>
  )
}

const SCENES = { room: RoomScene, body: BodyScene }

export default function PickFromPicture({
  scene = 'room',
  items,
  ordered = false,
  timeLimitSeconds,
  headingKey,
  promptKey,
  ariaLabelKey,
  className = '',
  labelFor,
  onComplete,
}) {
  const t = useT()
  const [takenKeys, setTakenKeys] = useState(() => [])
  const [remaining, setRemaining] = useState(timeLimitSeconds)
  const [wrongKey, setWrongKey] = useState(null)
  const wrongRef = useRef(false)
  const doneRef = useRef(false)
  const wrongTimerRef = useRef(null)
  const Scene = SCENES[scene] ?? RoomScene

  const order = useMemo(
    () => (ordered ? [...items].sort((a, b) => a.order - b.order) : items),
    [items, ordered],
  )

  const finish = (finished) => {
    if (doneRef.current) return
    doneRef.current = true
    onComplete({ finished, wrong: wrongRef.current })
  }

  useEffect(() => {
    const deadline = performance.now() + timeLimitSeconds * 1000
    const id = window.setInterval(() => {
      const left = Math.max(0, (deadline - performance.now()) / 1000)
      setRemaining(left)
      if (left <= 0) {
        window.clearInterval(id)
        finish(false)
      }
    }, 100)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(wrongTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grab = (item) => {
    if (doneRef.current || takenKeys.includes(item.key)) return

    if (ordered && item.order !== takenKeys.length) {
      wrongRef.current = true
      window.clearTimeout(wrongTimerRef.current)
      setWrongKey(item.key)
      wrongTimerRef.current = window.setTimeout(() => setWrongKey(null), 360)
      return
    }

    const next = [...takenKeys, item.key]
    setTakenKeys(next)
    if (next.length >= items.length) finish(true)
  }

  const timeRatio = Math.max(0, Math.min(1, remaining / timeLimitSeconds))

  return (
    <section
      className={`pick-picture ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={t(ariaLabelKey)}
    >
      <header className="pick-picture-head">
        <strong>{t(headingKey)}</strong>
        <p>{t(promptKey)}</p>
      </header>

      <div className="pick-picture-body">
        <div className="pick-scene" dir="ltr">
          <svg viewBox="0 0 100 100" className="pick-scene-svg" aria-hidden="true" focusable="false">
            <Scene />
          </svg>
          {items.map((item) => {
            const taken = takenKeys.includes(item.key)
            return (
              <button
                key={item.key}
                type="button"
                className={`pick-target${taken ? ' is-taken' : ''}${wrongKey === item.key ? ' is-wrong' : ''}`}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                onClick={() => grab(item)}
                disabled={taken}
                aria-label={labelFor(item, t)}
              >
                <span className="pick-target-dot" aria-hidden="true" />
                <span className="pick-target-name">{labelFor(item, t)}</span>
              </button>
            )
          })}
        </div>

        <ol className="pick-list">
          {order.map((item, index) => {
            const taken = takenKeys.includes(item.key)
            const isNext = ordered && !taken && index === takenKeys.length
            return (
              <li
                key={item.key}
                className={`${taken ? 'is-taken' : ''}${isNext ? ' is-next' : ''}`.trim()}
              >
                <i aria-hidden="true">{taken ? '✓' : ordered ? index + 1 : '·'}</i>
                <span>{labelFor(item, t)}</span>
              </li>
            )
          })}
        </ol>
      </div>

      <footer
        className="pick-picture-clock"
        aria-label={t('technique.timeRemaining', { seconds: remaining.toFixed(1) })}
      >
        <div className="pick-picture-meter" aria-hidden="true">
          <i style={{ transform: `scaleX(${timeRatio})` }} />
        </div>
        <strong>{t('technique.secondsValue', { seconds: remaining.toFixed(1) })}</strong>
      </footer>
    </section>
  )
}
