import { useEffect, useMemo, useState } from 'react'

// React-owned results screen. Replaces the old imperative endScreens.js
// observer, which derived results by reading rendered DOM text and inferring
// time from score. Everything here is driven by the real `result` object built
// by finishRun, so unscored technique time no longer corrupts the readout.

const RESULT_COPY = {
  overload: {
    eyebrow: 'DAY RESULT',
    title: 'OVERLOADED',
    outcome: 'Overloaded',
    note: 'Your capacity ran out.',
  },
  home: {
    eyebrow: 'DAY RESULT',
    title: 'SAFE RETURN',
    outcome: 'Went home',
    note: 'You chose to stop.',
  },
  complete: {
    eyebrow: 'DAY RESULT',
    title: 'MADE IT',
    outcome: 'Reached the café',
    note: 'You finished!',
  },
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function ScoreLedger({ result }) {
  const isOverload = result.outcome === 'overload'
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
      <div className="score-ledger-row total">
        <span>FINAL SCORE</span>
        <strong>{result.finalScore}</strong>
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

function ResultsCard({ result, capacity, banked, onRestart, onTutorial, onSkillTree }) {
  const copy = RESULT_COPY[result.outcome]

  return (
    <section className="results-screen" aria-labelledby="results-title">
      <div className="results-card">
        <header className="results-header">
          <span>{copy.eyebrow}</span>
          <h1 id="results-title">{copy.title}</h1>
          <p>{copy.note}</p>
        </header>

        <ScoreLedger result={result} />

        <div className="results-stats">
          <div><span>TIME OUT</span><strong>{result.dayElapsed.toFixed(1)}s</strong></div>
          <div><span>CLEARED</span><strong>{result.clearedCount}</strong></div>
          <div><span>PEAK LOAD</span><strong>{result.peakLoad}/{capacity}</strong></div>
          <div><span>LEFT ACTIVE</span><strong>{result.activeAtEnd}</strong></div>
        </div>

        <div className="results-outcome">
          <span>OUTCOME</span>
          <strong>{copy.outcome}</strong>
          <small>
            {result.appeared} demands appeared
            {result.suppressedCount > 0 ? ` · ${result.suppressedCount} suppressed` : ''}
          </small>
        </div>

        {banked != null && (
          <div className="results-bank" aria-live="polite">
            <span>BANKED</span>
            <strong>+{result.finalScore}</strong>
            <small>bank total {banked}</small>
          </div>
        )}

        <div className="results-actions">
          {onSkillTree && (
            <button className="results-skill-tree" type="button" onClick={onSkillTree}>
              SKILL TREE
            </button>
          )}
          <button className="results-restart" type="button" onClick={onRestart}>
            TRY ANOTHER DAY
          </button>
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
  const [phase, setPhase] = useState(isOverload ? 'bust' : 'results')

  useEffect(() => {
    if (phase !== 'bust') return undefined
    const duration = prefersReducedMotion() ? 1850 : 2150
    const timer = window.setTimeout(() => setPhase('results'), duration)
    return () => window.clearTimeout(timer)
  }, [phase])

  const rootClass = useMemo(() => {
    if (phase === 'bust') return 'end-sequence-root showing-bust'
    return `end-sequence-root showing-results outcome-${result.outcome}`
  }, [phase, result.outcome])

  return (
    <div className={rootClass}>
      {phase === 'bust' ? (
        <OverloadBust capacity={capacity} />
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
