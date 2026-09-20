import { useCallback, useMemo, useState } from 'react'

import MorningIcon from './morningIcons.jsx'
import { MicrogameContent } from '../minigames/core.jsx'
import { useT } from '../i18n/i18n.js'
import SettingsMenu from '../settings/SettingsMenu.jsx'
import RehearsalTechnique from '../techniques/RehearsalTechnique.jsx'
import PlanTechnique from '../techniques/PlanTechnique.jsx'
import StretchTechnique from '../techniques/StretchTechnique.jsx'
import {
  REHEARSAL_SEQUENCE,
  PLAN_SEQUENCE,
  STRETCH_SEQUENCE,
} from '../techniques/techniqueEngine.js'
import { getNode } from '../progression/skillTreeConfig.js'

// The Morning is the untimed half of the day: the player stands in their own
// house and touches things until they are ready. Nothing here is scored, no
// clock runs, nothing can overload, and every practice window can be closed
// half-finished. It exists so a new player can meet the minigames one at a time
// before the day puts four of them on screen at once.
//
// The front door is the ready-up: the scored day starts the moment it opens.

// Ordinary morning things. Each opens one real minigame, alone, with no
// pressure — the same component the day will use, so the practice transfers.
const PRACTICE_SPOTS = [
  { id: 'coffee', icon: 'coffee', kind: 'fatigue', x: 20, y: 57 },
  { id: 'water', icon: 'water', kind: 'weakGrip', x: 35, y: 72 },
  { id: 'clothes', icon: 'clothes', kind: 'jointSlip', x: 64, y: 63 },
  { id: 'window', icon: 'window', kind: 'lightSensitivity', x: 80, y: 38 },
  { id: 'keys', icon: 'keys', kind: 'workingMemory', x: 50, y: 80 },
]

// Technique spots only appear when the matching skill node is switched on.
// Each one is the technique it always was, moved out of the timed day and into
// the room it was always described as happening in.
const TECHNIQUE_SPOTS = [
  { id: 'rehearse', icon: 'mirror', x: 12, y: 33 },
  { id: 'stretch', icon: 'mat', x: 30, y: 44 },
  { id: 'plan', icon: 'checklist', x: 70, y: 30 },
]

function SpotButton({ spot, label, done, onOpen }) {
  return (
    <button
      type="button"
      className={`morning-spot morning-spot-${spot.id}${done ? ' is-done' : ''}`}
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
      onClick={() => onOpen(spot.id)}
    >
      <span className="morning-spot-ring" aria-hidden="true" />
      <span className="morning-spot-icon"><MorningIcon name={spot.icon} /></span>
      <span className="morning-spot-label">{label}</span>
      {done && <span className="morning-spot-tick" aria-hidden="true">✓</span>}
    </button>
  )
}

export default function MorningHouse({
  enabledNodeIds = [],
  onTechniqueComplete,
  onQueueSpawn,
  drawSpawnKind,
  onLeave,
}) {
  const t = useT()
  const [openSpot, setOpenSpot] = useState(null)
  const [doneSpots, setDoneSpots] = useState(() => new Set())
  const [cleared, setCleared] = useState(false)
  // Techniques are once-per-morning: a finished mirror rehearsal should not be
  // farmable for repeat capacity.
  const [usedTechniques, setUsedTechniques] = useState(() => new Set())

  const techniqueSpots = useMemo(
    () => TECHNIQUE_SPOTS.filter((spot) => enabledNodeIds.includes(spot.id)),
    [enabledNodeIds],
  )

  const close = useCallback(() => {
    setOpenSpot(null)
    setCleared(false)
  }, [])

  const markDone = useCallback((id) => {
    setDoneSpots((current) => {
      const next = new Set(current)
      next.add(id)
      return next
    })
  }, [])

  const resolvePractice = useCallback(() => {
    if (!openSpot) return
    markDone(openSpot)
    setCleared(true)
  }, [markDone, openSpot])

  const finishTechnique = useCallback((id, outcome) => {
    setUsedTechniques((current) => {
      const next = new Set(current)
      next.add(id)
      return next
    })
    markDone(id)
    onTechniqueComplete?.(id, outcome)
    setOpenSpot(null)
    setCleared(false)
  }, [markDone, onTechniqueComplete])

  // Every answer given to the mirror pulls one more thing into the day. Talking
  // yourself through it is not free: what you rehearse, you carry.
  const handleMirrorAnswer = useCallback(() => {
    const kind = drawSpawnKind?.()
    if (kind) onQueueSpawn?.(kind)
  }, [drawSpawnKind, onQueueSpawn])

  const activePractice = PRACTICE_SPOTS.find((spot) => spot.id === openSpot) ?? null
  const activeTechnique = techniqueSpots.find((spot) => spot.id === openSpot) ?? null
  // While something is open, the front door steps out of the way: leaving by
  // mis-clicking mid-rehearsal would throw away the thing you came here to do.
  const busy = Boolean(activePractice || activeTechnique)

  return (
    <section className={`morning-layer${busy ? ' morning-layer-busy' : ''}`} aria-label={t('morning.aria')}>
      <SettingsMenu variant="fixed" />

      <header className="morning-banner">
        <strong>{t('morning.title')}</strong>
        <p>{t('morning.body')}</p>
        <em>{t('morning.noTimer')}</em>
      </header>

      <div className="morning-spots">
        {PRACTICE_SPOTS.map((spot) => (
          <SpotButton
            key={spot.id}
            spot={spot}
            label={t(`morning.spot.${spot.id}`)}
            done={doneSpots.has(spot.id)}
            onOpen={setOpenSpot}
          />
        ))}
        {techniqueSpots.map((spot) => (
          <SpotButton
            key={spot.id}
            spot={spot}
            label={t(`morning.spot.${spot.id}`)}
            done={usedTechniques.has(spot.id)}
            onOpen={(id) => {
              if (usedTechniques.has(id)) return
              setOpenSpot(id)
            }}
          />
        ))}
      </div>

      <button type="button" className="morning-door" onClick={onLeave} hidden={busy}>
        <span className="morning-door-icon"><MorningIcon name="door" /></span>
        <strong>{t('morning.openDoor')}</strong>
        <small>{t('morning.openDoorHint')}</small>
      </button>

      {activePractice && (
        <div className="morning-practice-backdrop" role="dialog" aria-modal="true" aria-label={t(`morning.spot.${activePractice.id}`)}>
          <div className={`morning-practice microgame microgame-${activePractice.kind}${cleared ? ' is-cleared' : ''}`}>
            <div className="microgame-header">
              <span>{t(`morning.spot.${activePractice.id}`)}</span>
              <i />
            </div>
            <div className="microgame-body">
              <MicrogameContent kind={activePractice.kind} onResolve={resolvePractice} />
            </div>
            {cleared && <strong className="morning-practice-get">{t('morning.get')}</strong>}
            <footer className="morning-practice-footer">
              <span className="morning-practice-tag">{t('morning.practiceTag')}</span>
              <button type="button" onClick={close}>
                {cleared ? t('morning.done') : t('morning.leaveIt')}
              </button>
            </footer>
          </div>
        </div>
      )}

      {activeTechnique?.id === 'rehearse' && (
        <RehearsalTechnique
          prompts={REHEARSAL_SEQUENCE.prompts}
          timeLimitSeconds={getNode('rehearse').effect.addedSeconds}
          onAnswered={handleMirrorAnswer}
          onComplete={(outcome) => finishTechnique('rehearse', outcome)}
        />
      )}

      {activeTechnique?.id === 'plan' && (
        <PlanTechnique
          steps={PLAN_SEQUENCE.steps}
          timeLimitSeconds={getNode('plan').effect.addedSeconds}
          onComplete={(outcome) => finishTechnique('plan', outcome)}
        />
      )}

      {activeTechnique?.id === 'stretch' && (
        <StretchTechnique
          joints={STRETCH_SEQUENCE.joints}
          timeLimitSeconds={getNode('stretch').effect.addedSeconds}
          holdSeconds={getNode('stretch').effect.holdSeconds}
          onComplete={(outcome) => finishTechnique('stretch', outcome)}
        />
      )}
    </section>
  )
}
