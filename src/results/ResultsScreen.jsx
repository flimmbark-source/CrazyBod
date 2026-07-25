import { useEffect, useMemo, useState } from 'react'

// React-owned results screen. Everything here is driven by the result object
// created by finishRun, so the summary does not infer state from rendered DOM.

const RESULT_COPY = {
  overload: {
    eyebrow: 'DAY RESULT',
    title: 'OVERLOADED',
  },
  home: {
    eyebrow: 'DAY RESULT',
    title: 'SAFE RETURN',
  },
  complete: {
    eyebrow: 'DAY RESULT',
    title: 'MADE IT',
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
  const duration = `${result.dayElapsed.toFixed(1)} seconds`
  if (result.outcome === 'overload') return `Your capacity ran out after ${duration}.`
  if (result.outcome === 'home') return `You chose to stop after ${duration}.`
  return `You reached the café after ${duration}.`
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
        <span>CAPACITY</span>
        <strong>WENT HOME</strong>
        <em>YOU CHOSE TO STOP</em>
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

function ResultsCard({ result, capacity, banked, onRestart, onTutorial, onSkillTree }) {
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

        <div className="results-stats" aria-label="Run summary">
          <div>
            <span>CLEARED</span>
            <strong>{result.clearedCount} OF {result.appeared}</strong>
            {result.suppressedCount > 0 && <small>{result.suppressedCount} SUPPRESSED</small>}
          </div>
          <div>
            <span>LEFT ACTIVE</span>
            <strong>{result.activeAtEnd}</strong>
          </div>
          <div>
            <span>PEAK LOAD</span>
            <strong>{result.peakLoad}/{capacity}</strong>
          </div>
        </div>

        <div className={actionClass}>
          <button className="results-restart" type="button" onClick={onRestart}>
            TRY ANOTHER DAY
          </button>
          {onSkillTree && (
            <button className="results-skill-tree" type="button" onClick={onSkillTree}>
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
}) {
  const isOverload = result.outcome === 'overload'
  const isHome = result.outcome === 'home'
  const [phase, setPhase] = useState(isOverload ? 'bust' : isHome ? 'home' : 'results')

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
        <ResultsCard
          result={result}
          capacity={capacity}
          banked={banked}
          onRestart={onRestart}
          onTutorial={onTutorial}
          onSkillTree={onSkillTree}
        />
      )}
    </div>
  )
}
