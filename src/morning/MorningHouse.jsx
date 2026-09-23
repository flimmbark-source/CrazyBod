import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import { DOOR_SPOT, PRACTICE_SPOTS, TECHNIQUE_SPOTS } from './morningSpots.js'
import PracticeSession from './PracticeSession.jsx'
import useMorningLook from './useMorningLook.js'
import {
  closeMorningSpot,
  markMorningDone,
  markMorningUsed,
  morningProjections,
  requestMorningSpot,
  setMorningHover,
  useMorningState,
} from './morningStore.js'

// The Morning is the untimed half of the day: the player stands in their own
// house and touches things until they are ready. Nothing here is scored, no
// clock runs, nothing can overload, and every window can be closed unfinished.
//
// The objects themselves are drawn in 3D (see MorningProps.jsx). This layer is
// the writing over them: a name for each thing, what it will give you, and the
// window that opens when you take it. The front door is the ready-up.

// A label pinned to a real object in the room. It knows nothing about where it
// goes: MorningHouse places every label in one pass below, so labels for things
// standing close together can be nudged apart.
function SpotLabel({ spot, name, reward, done, active, disabled, pinned = false, registerRef, onOpen }) {
  return (
    <button
      ref={(element) => registerRef(spot.id, element)}
      type="button"
      className={`morning-tag morning-tag-${spot.id}${done ? ' is-done' : ''}${active ? ' is-active' : ''}${pinned ? ' is-pinned' : ''}`}
      disabled={disabled || done}
      onPointerEnter={() => setMorningHover(spot.id)}
      onPointerLeave={() => setMorningHover(null)}
      onFocus={() => setMorningHover(spot.id)}
      onBlur={() => setMorningHover(null)}
      onClick={() => onOpen(spot.id)}
    >
      <span className="morning-tag-name">{name}</span>
      {reward.text && (
        <span className={`morning-tag-reward${reward.upgrade ? ' is-upgrade' : ''}`}>{reward.text}</span>
      )}
      {done && <span className="morning-tag-tick" aria-hidden="true">✓</span>}
    </button>
  )
}

// Place every label against its object's projected position, then push any that
// still overlap upward. Two things on the same counter would otherwise bury one
// label under another, and the buried one is unreadable and unclickable.
function useLabelPlacement(labelRefs, spotIds) {
  useEffect(() => {
    let frame = 0
    const place = () => {
      frame = window.requestAnimationFrame(place)
      const placed = []
      for (const id of spotIds) {
        const element = labelRefs.current.get(id)
        const projection = morningProjections.get(id)
        if (!element) continue
        if (!projection || !projection.visible) {
          element.style.visibility = 'hidden'
          continue
        }
        const width = element.offsetWidth
        const height = element.offsetHeight
        // The label is centred on the thing it names, so one sitting near the
        // edge of the frame would hang half off the screen. Keep the whole name
        // readable; it still points at the right side of the room.
        const edge = width / 2 + 6
        const centerX = Math.min(Math.max(projection.x, edge), window.innerWidth - edge)
        let top = projection.y - height
        // Sorted-by-depth nudging: anything already placed that this would sit
        // on top of pushes it further up.
        for (const other of placed) {
          const overlapsX = Math.abs(other.centerX - centerX) < (other.width + width) / 2 + 6
          if (overlapsX && Math.abs(other.top - top) < height + 4) {
            top = other.top - height - 6
          }
        }
        placed.push({ centerX, top, width, height })
        element.style.visibility = 'visible'
        element.style.transform = `translate(-50%, 0) translate(${centerX}px, ${Math.max(6, top)}px)`
      }
    }
    frame = window.requestAnimationFrame(place)
    return () => window.cancelAnimationFrame(frame)
  }, [labelRefs, spotIds])
}

// Arcade upgrade text: what you just earned, in green, over the thing you
// earned it from.
function RewardBurst({ text, tone }) {
  return (
    <strong className={`morning-reward-burst tone-${tone}`} role="status" aria-live="polite">
      {text}
    </strong>
  )
}

export default function MorningHouse({
  spots = null,
  carried = false,
  enabledNodeIds = [],
  onTechniqueComplete,
  onQueueSpawn,
  drawSpawnKind,
  onLeave,
}) {
  const t = useT()
  const { openId, doneIds, usedIds, hoverId } = useMorningState()
  const [burst, setBurst] = useState(null)
  const burstTimerRef = useRef(null)

  // During the scripted lesson App narrows the room to one object; otherwise
  // the Morning shows everything it owns.
  const visibleSpots = spots ?? [
    ...PRACTICE_SPOTS,
    ...TECHNIQUE_SPOTS.filter((spot) => enabledNodeIds.includes(spot.id)),
    DOOR_SPOT,
  ]
  const practiceSpots = useMemo(
    () => visibleSpots.filter((spot) => PRACTICE_SPOTS.some((entry) => entry.id === spot.id)),
    [visibleSpots],
  )
  const techniqueSpots = useMemo(
    () => visibleSpots.filter((spot) => TECHNIQUE_SPOTS.some((entry) => entry.id === spot.id)),
    [visibleSpots],
  )
  const doorSpot = visibleSpots.find((spot) => spot.id === DOOR_SPOT.id) ?? null
  const doneSet = useMemo(() => new Set(doneIds), [doneIds])
  const usedSet = useMemo(() => new Set(usedIds), [usedIds])
  const labelRefs = useRef(new Map())
  const registerRef = useCallback((id, element) => {
    if (element) labelRefs.current.set(id, element)
    else labelRefs.current.delete(id)
  }, [])
  // Nearest objects first, so a distant label is the one pushed out of the way.
  const spotIds = useMemo(
    () => visibleSpots
      .slice()
      .sort((a, b) => b.position[2] - a.position[2])
      .map((spot) => spot.id),
    [visibleSpots],
  )
  useLabelPlacement(labelRefs, spotIds)

  useEffect(() => () => window.clearTimeout(burstTimerRef.current), [])

  const showBurst = useCallback((text, tone = 'gain') => {
    window.clearTimeout(burstTimerRef.current)
    setBurst({ text, tone, key: Date.now() })
    burstTimerRef.current = window.setTimeout(() => setBurst(null), 2200)
  }, [])

  const close = useCallback(() => {
    closeMorningSpot()
  }, [])

  // A practice that is seen through is marked done and says so; one that is
  // lost simply closes, so it can be tried again.
  const passPractice = useCallback((id) => {
    markMorningDone(id)
    showBurst(t('morning.reward.practice'), 'gain')
    closeMorningSpot()
  }, [showBurst, t])

  const failPractice = useCallback(() => {
    showBurst(t('practice.failed'), 'miss')
    closeMorningSpot()
  }, [showBurst, t])

  const finishTechnique = useCallback((id, outcome) => {
    markMorningUsed(id)
    markMorningDone(id)
    const granted = onTechniqueComplete?.(id, outcome)
    showBurst(
      granted ? t(`morning.reward.${id}`) : t('morning.reward.none'),
      granted ? 'gain' : 'miss',
    )
    closeMorningSpot()
  }, [onTechniqueComplete, showBurst, t])

  // Every answer given to the mirror pulls one more thing into the day.
  // Talking yourself through it is not free: what you rehearse, you carry.
  const handleMirrorAnswer = useCallback(() => {
    const kind = drawSpawnKind?.()
    if (kind) onQueueSpawn?.(kind)
  }, [drawSpawnKind, onQueueSpawn])

  const activePractice = PRACTICE_SPOTS.find((spot) => spot.id === openId) ?? null
  const activeTechnique = techniqueSpots.find((spot) => spot.id === openId) ?? null
  const busy = Boolean(activePractice || activeTechnique)
  // Looking around belongs to the player: off while the scripted opening is
  // carrying them on the authored path, and off while a window has their
  // attention.
  const playerHasTheRoom = !carried
  useMorningLook(playerHasTheRoom && !busy)

  return (
    <section
      className={`morning-layer${busy ? ' morning-layer-busy' : ''}`}
      aria-label={t('morning.aria')}
    >
      <SettingsMenu variant="fixed" />

      <div className="morning-tags">
        {practiceSpots.map((spot) => (
          <SpotLabel
            key={spot.id}
            spot={spot}
            name={t(`morning.spot.${spot.id}`)}
            reward={{ text: t('morning.reward.practice'), upgrade: false }}
            done={doneSet.has(spot.id)}
            active={hoverId === spot.id}
            disabled={busy}
            registerRef={registerRef}
            onOpen={requestMorningSpot}
          />
        ))}
        {doorSpot && (
          <SpotLabel
            key={doorSpot.id}
            spot={doorSpot}
            name={t(`morning.spot.${doorSpot.id}`)}
            reward={{ text: t(doorSpot.reward), upgrade: true }}
            pinned
            done={false}
            active={hoverId === doorSpot.id}
            disabled={busy}
            registerRef={registerRef}
            onOpen={() => onLeave?.()}
          />
        )}
        {techniqueSpots.map((spot) => (
          <SpotLabel
            key={spot.id}
            spot={spot}
            name={t(`morning.spot.${spot.id}`)}
            reward={{ text: spot.reward ? t(spot.reward) : '', upgrade: Boolean(spot.reward) }}
            done={usedSet.has(spot.id)}
            active={hoverId === spot.id}
            disabled={busy}
            registerRef={registerRef}
            onOpen={requestMorningSpot}
          />
        ))}
      </div>

      {burst && <RewardBurst key={burst.key} text={burst.text} tone={burst.tone} />}

      {activePractice && (
        <PracticeSession
          key={activePractice.id}
          id={activePractice.id}
          name={t(`morning.spot.${activePractice.id}`)}
          onPass={passPractice}
          onFail={failPractice}
          onLeave={close}
        />
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
