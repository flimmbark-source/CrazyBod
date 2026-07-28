import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import RunSnapshotLane from './RunSnapshots.jsx'

// React-owned results screen. Everything here is driven by the result object
// created by finishRun, so the summary does not infer state from rendered DOM.

// Shown once, the first time a result screen offers the skill tree, so the
// player learns they can spend their banked points on upgrades.
const SKILL_TREE_TIP_STORAGE_KEY = 'crazybod:skill-tree-tip-seen'

function skillTreeTipSeen() {
  try {
    return window.localStorage.getItem(SKILL_TREE_TIP_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markSkillTreeTipSeen() {
  try {
    window.localStorage.setItem(SKILL_TREE_TIP_STORAGE_KEY, 'true')
  } catch {
    // Storage is best-effort; the tip simply reappears next run if it fails.
  }
}

const RESULT_COPY = {
  overload: {
    eyebrow: 'DAY RESULT',
    title: 'OVERLOADED',
  },
  home: {
    eyebrow: 'DAY RESULT',
    title: 'RETURNED HOME',
  },
  complete: {
    eyebrow: 'DAY RESULT',
    title: 'YOU DID IT!',
  },
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function resultSummary(result) {
  if (result.source === 'mandala') return `Mandala depth reached: ${result.mandalaDepth ?? 0}.`
  if (result.outcome === 'complete') return 'You made it to the café.'
  const duration = `${result.dayElapsed.toFixed(1)} seconds`
  return `after ${duration}.`
}

function ScoreLedger({ result, banked }) {
  const isOverload = result.outcome === 'overload'
  const wasBanked = banked != null

  return (
    <div className="score-ledger">
      <div className="score-ledger-row">
        <span>EARNED</span>
        <strong>{result.rawScore}</strong>
      </div>
      {isOverload ? (
        <div className="score-ledger-row penalty">
          <span>OVERLOAD PENALTY</span>
          <strong>-{result.penalty}</strong>
        </div>
      ) : (
        <div className="score-ledger-row protected">
          <span>SCORE KEPT</span>
          <strong>100%</strong>
        </div>
      )}
      <div className="score-ledger-row total" aria-live={wasBanked ? 'polite' : undefined}>
        <span>{wasBanked ? 'BANKED' : 'FINAL SCORE'}</span>
        <div className="score-total-value">
          <strong>{wasBanked ? `+${result.finalScore}` : result.finalScore}</strong>
          {wasBanked && <small>BANK TOTAL {banked}</small>}
        </div>
      </div>
    </div>
  )
}

function OverloadBust({ capacity }) {
  return (
    <section className="overload-bust-stage" role="alert" aria-live="assertive">
      <div className="bust-static" />
      <div className="bust-rings" />
      <div className="bust-tiles">
        {Array.from({ length: 12 }).map((_, index) => (
          <i key={index} className="bust-tile" style={{ '--tile': index }} />
        ))}
      </div>
      <div className="bust-copy">
        <span>CAPACITY</span>
        <strong>OVERLOAD</strong>
        <em>TOO MANY THINGS AT ONCE</em>
      </div>
      <div className="bust-meter" aria-label={`Overload ${capacity} of ${capacity}`}>
        {Array.from({ length: capacity }).map((_, index) => (
          <i key={index} />
        ))}
      </div>
    </section>
  )
}

function HomeReturn({ capacity, activeAtEnd }) {
  return (
    <section className="home-return-stage" role="status" aria-live="polite">
      <div className="home-hush" />
      <div className="home-rings" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <i key={index} className="home-ring" style={{ '--ring': index }} />
        ))}
      </div>
      <div className="home-copy">
        <strong>WENT HOME</strong>
      </div>
      <div
        className="home-meter"
        aria-label={`Went home with ${activeAtEnd} of ${capacity} capacity occupied`}
      >
        {Array.from({ length: capacity }).map((_, index) => (
          <i key={index} className={index < activeAtEnd ? 'filled' : ''} />
        ))}
      </div>
    </section>
  )
}

// A tutorial-style callout, matching the in-run tutorial steps, that points at
// the skill tree button on the first result screen and explains upgrades.
function SkillTreeTutorialTip({ onDismiss }) {
  const calloutRef = useRef(null)
  const [placement, setPlacement] = useState({ left: 0, top: 0, direction: 'above', ready: false })

  useLayoutEffect(() => {
    const position = () => {
      const callout = calloutRef.current
      const target = document.querySelector('.results-skill-tree')
      if (!callout || !target) return
      const rect = target.getBoundingClientRect()
      const width = callout.offsetWidth
      const height = callout.offsetHeight
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const edge = 12
      const gap = 24
      const centerX = rect.left + rect.width / 2
      const clampLeft = (left) => Math.max(edge, Math.min(left, viewportWidth - width - edge))
      const clampTop = (top) => Math.max(edge, Math.min(top, viewportHeight - height - edge))
      // Prefer sitting above the button; drop below it when there is no room.
      const aboveTop = rect.top - height - gap
      const direction = aboveTop < edge ? 'below' : 'above'
      const top = direction === 'below' ? rect.bottom + gap : aboveTop
      setPlacement({ left: clampLeft(centerX - width / 2), top: clampTop(top), direction, ready: true })
    }

    const frame = window.requestAnimationFrame(position)
    window.addEventListener('resize', position)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', position)
    }
  }, [])

  return (
    <section className="tutorial-layer tutorial-layer-results-skill-tree" aria-live="polite">
      <aside
        ref={calloutRef}
        className={`tutorial-callout tutorial-callout-results-skill-tree placement-${placement.direction}`}
        style={{
          left: `${placement.left}px`,
          top: `${placement.top}px`,
          visibility: placement.ready ? 'visible' : 'hidden',
        }}
      >
        <i className="tutorial-pointer" aria-hidden="true" />
        <span>NEW: SKILL TREE</span>
        <strong>Spend your points.</strong>
        <p>Open the skill tree to upgrade your character.</p>
        <button className="tutorial-next" type="button" onClick={onDismiss}>GOT IT</button>
      </aside>
    </section>
  )
}

function ResultsCard({
  result,
  capacity,
  banked,
  onRestart,
  onTutorial,
  onSkillTree,
  emphasizeSkillTree,
  highlightSkillTree = false,
}) {
  const copy = RESULT_COPY[result.outcome]
  const actionClass = `results-actions${onSkillTree ? ' has-skill-tree' : ''}`

  return (
    <section className="results-screen" aria-labelledby="results-title">
      <div className="results-card">
        <header className="results-header">
          <span>{copy.eyebrow}</span>
          <h1 id="results-title">{copy.title}</h1>
          <p>{resultSummary(result)}</p>
        </header>

        <ScoreLedger result={result} banked={banked} />

        <div className={actionClass}>
          <button className="results-restart" type="button" onClick={onRestart}>
            TRY ANOTHER DAY
          </button>
          {onSkillTree && (
            <button
              className={`results-skill-tree${emphasizeSkillTree ? ' is-new' : ''}${highlightSkillTree ? ' tutorial-target' : ''}`}
              type="button"
              onClick={onSkillTree}
            >
              SKILL TREE
            </button>
          )}
          <button className="results-tutorial" type="button" onClick={onTutorial}>
            PLAY TUTORIAL
          </button>
        </div>
      </div>
    </section>
  )
}

export default function ResultsScreen({
  result,
  capacity,
  banked = null,
  onRestart,
  onTutorial,
  onSkillTree,
  emphasizeSkillTree = false,
  snapshots = [],
}) {
  const isOverload = result.outcome === 'overload'
  const isHome = result.outcome === 'home'
  const [phase, setPhase] = useState(isOverload ? 'bust' : isHome ? 'home' : 'results')
  // Coach the player once, the first time a result screen can reach the skill
  // tree. The tree unlocks as this screen mounts, so onSkillTree may only become
  // truthy a render after mount — react to it rather than reading it once.
  const [showSkillTreeTip, setShowSkillTreeTip] = useState(false)

  useEffect(() => {
    if (phase === 'results' && onSkillTree && !skillTreeTipSeen()) {
      markSkillTreeTipSeen()
      setShowSkillTreeTip(true)
    }
  }, [phase, onSkillTree])

  useEffect(() => {
    if (phase !== 'bust' && phase !== 'home') return undefined

    const reducedMotion = prefersReducedMotion()
    const duration = phase === 'bust'
      ? (reducedMotion ? 1850 : 2150)
      : (reducedMotion ? 1500 : 2200)
    const timer = window.setTimeout(() => setPhase('results'), duration)
    return () => window.clearTimeout(timer)
  }, [phase])

  const rootClass = useMemo(() => {
    if (phase === 'bust') return 'end-sequence-root showing-bust'
    if (phase === 'home') return 'end-sequence-root showing-home'
    return `end-sequence-root showing-results outcome-${result.outcome}`
  }, [phase, result.outcome])

  return (
    <div className={rootClass}>
      {phase === 'bust' ? (
        <OverloadBust capacity={capacity} />
      ) : phase === 'home' ? (
        <HomeReturn capacity={capacity} activeAtEnd={result.activeAtEnd} />
      ) : (
        <>
          <ResultsCard
            result={result}
            capacity={capacity}
            banked={banked}
            onRestart={onRestart}
            onTutorial={onTutorial}
            onSkillTree={onSkillTree}
            emphasizeSkillTree={emphasizeSkillTree}
            highlightSkillTree={showSkillTreeTip}
          />
          {showSkillTreeTip && onSkillTree && (
            <SkillTreeTutorialTip onDismiss={() => setShowSkillTreeTip(false)} />
          )}
          <RunSnapshotLane snapshots={snapshots} />
        </>
      )}
    </div>
  )
}
