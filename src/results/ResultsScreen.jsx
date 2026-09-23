import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import RunSnapshotLane from './RunSnapshots.jsx'
import SettingsMenu from '../settings/SettingsMenu.jsx'
import { useT } from '../i18n/i18n.js'

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

// Result title keys per outcome; the eyebrow is shared.
const RESULT_TITLE_KEY = {
  overload: 'result.overload.title',
  home: 'result.home.title',
  complete: 'result.complete.title',
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function resultSummary(t, result) {
  if (result.source === 'mandala') return t('result.summary.mandala', { depth: result.mandalaDepth ?? 0 })
  if (result.outcome === 'complete') return t('result.summary.complete')
  return t('result.summary.after', { seconds: result.dayElapsed.toFixed(1) })
}

function ScoreLedger({ result, banked }) {
  const t = useT()
  const isOverload = result.outcome === 'overload'
  const wasBanked = banked != null

  return (
    <div className="score-ledger">
      <div className="score-ledger-row">
        <span>{t('ledger.earned')}</span>
        <strong>{result.rawScore}</strong>
      </div>
      {isOverload ? (
        <div className="score-ledger-row penalty">
          <span>{t('ledger.penalty')}</span>
          <strong>-{result.penalty}</strong>
        </div>
      ) : (
        <div className="score-ledger-row protected">
          <span>{t('ledger.kept')}</span>
          <strong>{t('ledger.keptValue')}</strong>
        </div>
      )}
      <div className="score-ledger-row total" aria-live={wasBanked ? 'polite' : undefined}>
        <span>{wasBanked ? t('ledger.banked') : t('ledger.final')}</span>
        <div className="score-total-value">
          <strong>{wasBanked ? `+${result.finalScore}` : result.finalScore}</strong>
          {wasBanked && <small>{t('ledger.bankTotal', { total: banked })}</small>}
        </div>
      </div>
    </div>
  )
}

function OverloadBust({ capacity }) {
  const t = useT()
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
        <span>{t('bust.capacity')}</span>
        <strong>{t('bust.overload')}</strong>
        <em>{t('bust.tooMany')}</em>
      </div>
      <div className="bust-meter" aria-label={t('bust.aria', { capacity })}>
        {Array.from({ length: capacity }).map((_, index) => (
          <i key={index} />
        ))}
      </div>
    </section>
  )
}

function HomeReturn({ capacity, activeAtEnd }) {
  const t = useT()
  return (
    <section className="home-return-stage" role="status" aria-live="polite">
      <div className="home-hush" />
      <div className="home-rings" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <i key={index} className="home-ring" style={{ '--ring': index }} />
        ))}
      </div>
      <div className="home-copy">
        <strong>{t('home.wentHome')}</strong>
      </div>
      <div
        className="home-meter"
        aria-label={t('home.aria', { active: activeAtEnd, capacity })}
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
  const t = useT()
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
        className={`tutorial-callout has-action tutorial-callout-results-skill-tree placement-${placement.direction}`}
        style={{
          left: `${placement.left}px`,
          top: `${placement.top}px`,
          visibility: placement.ready ? 'visible' : 'hidden',
        }}
      >
        <i className="tutorial-pointer" aria-hidden="true" />
        <span>{t('skillTip.eyebrow')}</span>
        <strong>{t('skillTip.title')}</strong>
        <p>{t('skillTip.body')}</p>
        <button className="tutorial-next" type="button" onClick={onDismiss}>{t('common.gotIt')}</button>
      </aside>
    </section>
  )
}

function ResultsCard({
  result,
  capacity,
  banked,
  onRestart,
  onPractice,
  onSkillTree,
  tutorialEnabled,
  onToggleTutorial,
  emphasizeSkillTree,
  highlightSkillTree = false,
}) {
  const t = useT()
  const actionClass = `results-actions${onSkillTree ? ' has-skill-tree' : ''}`

  return (
    <section className="results-screen" aria-labelledby="results-title">
      <SettingsMenu variant="fixed" />
      <div className="results-card">
        <header className="results-header">
          <span>{t('result.eyebrow')}</span>
          <h1 id="results-title">{t(RESULT_TITLE_KEY[result.outcome])}</h1>
          <p>{resultSummary(t, result)}</p>
        </header>

        <ScoreLedger result={result} banked={banked} />

        <div className={actionClass}>
          <button className="results-restart" type="button" onClick={onRestart}>
            {t('results.tryAnother')}
          </button>
          {/* Practice is the untimed house: the day's minigames with nothing
              riding on them. It sits under the day because it is the quieter
              of the two doors out of this screen. */}
          <button className="results-practice" type="button" onClick={onPractice}>
            {t('results.practice')}
          </button>
          {onSkillTree && (
            <button
              className={`results-skill-tree${emphasizeSkillTree ? ' is-new' : ''}${highlightSkillTree ? ' tutorial-target' : ''}`}
              type="button"
              onClick={onSkillTree}
            >
              {t('common.skillTree')}
            </button>
          )}
          {/* The tutorial is a property of Practice, so its switch lives here,
              under the tree, rather than being a button that starts a run. */}
          <button
            className="results-tutorial-toggle"
            type="button"
            aria-pressed={tutorialEnabled}
            onClick={onToggleTutorial}
          >
            <span>{t('intro.tutorial')}</span>
            <strong>{tutorialEnabled ? t('common.on') : t('common.off')}</strong>
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
  onPractice,
  onSkillTree,
  tutorialEnabled = false,
  onToggleTutorial,
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
            onPractice={onPractice}
            onSkillTree={onSkillTree}
            tutorialEnabled={tutorialEnabled}
            onToggleTutorial={onToggleTutorial}
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
