import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  SKILL_TREE_NODES,
  SKILL_TREE_NODES_BY_ID,
  SKILL_TREE_EDGES,
} from './skillTreeConfig.js'
import {
  canPurchase,
  isEnabled,
  isPurchased,
  isRevealed,
} from './progressionStore.js'
import SettingsMenu from '../settings/SettingsMenu.jsx'
import { useT } from '../i18n/i18n.js'

// Translate a skill node's authored fields by its stable id. Descriptions are
// blank for most nodes, so keep them blank rather than echoing a missing key.
function nodeName(t, node) {
  return t(`skill.${node.id}.name`)
}

function nodeDescription(t, node) {
  return node.description ? t(`skill.${node.id}.description`) : ''
}

function nodeDetail(t, node) {
  return node.detail ? t(`skill.${node.id}.detail`) : ''
}

function nodeTagline(t, node) {
  return t(`tagline.${node.tagline}`)
}

const RELEASE_HIDDEN_NODE_IDS = new Set(['swordCursor', 'mandalaDive'])

// Shown once, the first time the tree is ever opened. Without it the tree is a
// screen full of buttons with no stated exit, and players sat on it wondering
// what they were meant to do.
const TREE_TIP_STORAGE_KEY = 'crazybod:skill-tree-start-tip-seen'

function treeTipSeen() {
  try {
    return window.localStorage.getItem(TREE_TIP_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markTreeTipSeen() {
  try {
    window.localStorage.setItem(TREE_TIP_STORAGE_KEY, 'true')
  } catch {
    // Best effort; the tip reappears next session if storage is unavailable.
  }
}

// A callout in the same shape as the in-run tutorial steps, pinned to the
// Start The Day button.
function StartDayTip({ t, onDismiss }) {
  const calloutRef = useRef(null)
  const [placement, setPlacement] = useState({ left: 0, top: 0, direction: 'above', ready: false })

  useLayoutEffect(() => {
    const position = () => {
      const callout = calloutRef.current
      const target = document.querySelector('.skill-tree-start')
      if (!callout || !target) return
      const rect = target.getBoundingClientRect()
      const width = callout.offsetWidth
      const height = callout.offsetHeight
      const edge = 12
      const gap = 22
      const clampLeft = (left) => Math.max(edge, Math.min(left, window.innerWidth - width - edge))
      const clampTop = (top) => Math.max(edge, Math.min(top, window.innerHeight - height - edge))
      const aboveTop = rect.top - height - gap
      const direction = aboveTop < edge ? 'below' : 'above'
      const top = direction === 'below' ? rect.bottom + gap : aboveTop
      setPlacement({
        left: clampLeft(rect.left + rect.width / 2 - width / 2),
        top: clampTop(top),
        direction,
        ready: true,
      })
    }

    const frame = window.requestAnimationFrame(position)
    window.addEventListener('resize', position)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', position)
    }
  }, [])

  return (
    <section className="tutorial-layer tutorial-layer-tree-start" aria-live="polite">
      <aside
        ref={calloutRef}
        className={`tutorial-callout tutorial-callout-tree-start placement-${placement.direction}`}
        style={{
          left: `${placement.left}px`,
          top: `${placement.top}px`,
          visibility: placement.ready ? 'visible' : 'hidden',
        }}
      >
        <i className="tutorial-pointer" aria-hidden="true" />
        <span>{t('treeTip.eyebrow')}</span>
        <strong>{t('treeTip.title')}</strong>
        <p>{t('treeTip.body')}</p>
        <button className="tutorial-next" type="button" onClick={onDismiss}>{t('common.gotIt')}</button>
      </aside>
    </section>
  )
}

const ICONS = {
  sword: <path d="M18 4l2 2-8 8-1 3 3-1 8-8M6 18l3 3M4 20l3-3" />,
  dive: <path d="M12 4v11M7 11l5 5 5-5M6 20h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
  chat: <path d="M5 6h14v9H9l-4 3z" />,
  list: <path d="M6 8h12M6 12h12M6 16h8" />,
  target: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </>
  ),
  bolt: <path d="M13 5l-6 8h4l-1 6 6-9h-4z" />,
  shield: <path d="M12 5l6 2v5c0 4-3 6-6 7-3-1-6-3-6-7V7z" />,
  stretch: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 8v6M12 11l-5 2M12 11l5 2M12 14l-3 6M12 14l3 6" />
    </>
  ),
}

function NodeIcon({ icon }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[icon] ?? ICONS.plus}
    </svg>
  )
}

function paletteStyle(node) {
  return {
    '--node-accent': node.palette.accent,
    '--node-dark': node.palette.dark,
    '--node-light': node.palette.light,
  }
}

function nodeState(progression, node) {
  if (!isRevealed(progression, node.id)) return 'hidden'
  if (isPurchased(progression, node.id)) {
    return isEnabled(progression, node.id) ? 'enabled' : 'disabled'
  }
  return canPurchase(progression, node.id).ok ? 'available' : 'unaffordable'
}

function isOwnedState(state) {
  return state === 'enabled' || state === 'disabled'
}

function popupHint(t, node, state, bank) {
  if (state === 'enabled') return t('skillTree.enabled')
  if (state === 'disabled') return t('skillTree.disabled')
  if (state === 'available') return t('skillTree.buyFor', { cost: node.cost })
  if (state === 'unaffordable') return t('skillTree.need', { amount: Math.max(0, node.cost - bank) })
  return ''
}

function NodePopup({ node, state, bank }) {
  const t = useT()
  if (!node) return null

  const owned = isOwnedState(state)
  const horizontalClass = node.x >= 66 ? 'popup-left' : 'popup-right'
  const description = nodeDescription(t, node)
  const detail = nodeDetail(t, node)

  return (
    <aside
      className={`skill-node-popup ${horizontalClass} popup-${state}`}
      style={{
        '--popup-x': `${node.x}%`,
        '--popup-y': `${node.y}%`,
        ...paletteStyle(node),
      }}
      aria-live="polite"
    >
      <span className="skill-popup-tagline">{nodeTagline(t, node)}</span>
      <h2>{nodeName(t, node)}</h2>
      <p>{description}</p>
      {detail && <small>{detail}</small>}

      {!owned && (
        <div className="skill-popup-cost">
          <span>{t('skillTree.cost')}</span>
          <strong>{node.cost}</strong>
        </div>
      )}

      <div className="skill-popup-hint">{popupHint(t, node, state, bank)}</div>
    </aside>
  )
}

function ConfirmButton({ className, label, confirmLabel, onConfirm }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button type="button" className={className} onClick={() => setConfirming(true)}>
        {label}
      </button>
    )
  }

  return (
    <span className="reset-confirm">
      <button
        type="button"
        className={`${className} reset-confirm-yes`}
        onClick={() => {
          setConfirming(false)
          onConfirm()
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="reset-confirm-no" onClick={() => setConfirming(false)}>
        {t('common.cancel')}
      </button>
    </span>
  )
}

export default function SkillTreeScreen({
  progression,
  firstUnlock = false,
  onStartDay,
  onExit,
  onPurchase,
  onToggle,
  onResetTree,
  onResetFull,
}) {
  const t = useT()
  const [activeId, setActiveId] = useState(null)
  const [deniedId, setDeniedId] = useState(null)
  const [showStartTip, setShowStartTip] = useState(false)

  useEffect(() => {
    if (treeTipSeen()) return
    markTreeTipSeen()
    setShowStartTip(true)
  }, [])
  const visibleNodes = SKILL_TREE_NODES.filter((node) => !RELEASE_HIDDEN_NODE_IDS.has(node.id))
  const active = activeId ? SKILL_TREE_NODES_BY_ID[activeId] : null
  const activeVisible = active
    && !RELEASE_HIDDEN_NODE_IDS.has(active.id)
    && isRevealed(progression, active.id)
    ? active
    : null
  const activeState = activeVisible ? nodeState(progression, activeVisible) : 'hidden'

  // Connectors between visible, revealed nodes; brighter once both ends are owned.
  const visibleEdges = SKILL_TREE_EDGES.filter(
    (edge) => !RELEASE_HIDDEN_NODE_IDS.has(edge.from)
      && !RELEASE_HIDDEN_NODE_IDS.has(edge.to)
      && isRevealed(progression, edge.from)
      && isRevealed(progression, edge.to),
  )

  const clickNode = (node, state) => {
    if (state === 'hidden') return

    setActiveId(node.id)

    if (state === 'enabled' || state === 'disabled') {
      onToggle(node.id, state === 'disabled')
    } else if (state === 'available') {
      onPurchase(node.id)
    } else if (state === 'unaffordable') {
      setDeniedId(node.id)
      window.setTimeout(() => setDeniedId((id) => (id === node.id ? null : id)), 480)
    }
  }

  return (
    <div className="skill-tree-screen">
      <SettingsMenu variant="skill-tree" />
      <h1 className="skill-tree-title">{t('common.skillTree')}</h1>

      <div className="skill-tree-bank" aria-live="polite">
        <span className="bank-gem" aria-hidden="true" />
        <strong>{progression.bank}</strong>
        {firstUnlock && <em className="bank-unlocked">{t('skillTree.unlocked')}</em>}
      </div>

      <button type="button" className="skill-tree-close" onClick={onExit} aria-label={t('skillTree.backToTitle')}>
        ×
      </button>

      <div className="skill-tree-board">
        <div className="skill-tree-map" role="group" aria-label={t('skillTree.mapLabel')}>
          <svg className="skill-tree-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {visibleEdges.map((edge) => {
              const from = SKILL_TREE_NODES_BY_ID[edge.from]
              const to = SKILL_TREE_NODES_BY_ID[edge.to]
              if (!from || !to) return null
              const owned = isPurchased(progression, edge.from) && isPurchased(progression, edge.to)
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={`skill-tree-edge-line${owned ? ' edge-owned' : ''}`}
                />
              )
            })}
          </svg>

          {visibleNodes.map((node) => {
            const state = nodeState(progression, node)
            const owned = isOwnedState(state)

            return (
              <button
                key={node.id}
                type="button"
                className={`tree-node tree-node-${state}${activeId === node.id ? ' is-active' : ''}${deniedId === node.id ? ' is-denied' : ''}`}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  ...paletteStyle(node),
                }}
                onClick={() => clickNode(node, state)}
                onMouseEnter={() => state !== 'hidden' && setActiveId(node.id)}
                onMouseLeave={() => setActiveId(null)}
                onFocus={() => state !== 'hidden' && setActiveId(node.id)}
                disabled={state === 'hidden'}
                aria-label={
                  state === 'hidden'
                    ? t('skillTree.lockedSkill')
                    : `${nodeName(t, node)}. ${nodeDescription(t, node)} ${
                        state === 'enabled'
                          ? t('skillTree.node.enabledDesc')
                          : state === 'disabled'
                            ? t('skillTree.node.disabledDesc')
                            : t('skillTree.node.costs', { cost: node.cost })
                      }`
                }
                aria-pressed={state === 'enabled' ? true : state === 'disabled' ? false : undefined}
              >
                {state === 'hidden' ? <span className="tree-node-lock">?</span> : <NodeIcon icon={node.icon} />}
                {owned && <span className="tree-node-owned">{t('skillTree.owned')}</span>}
              </button>
            )
          })}

          <NodePopup node={activeVisible} state={activeState} bank={progression.bank} />
        </div>
      </div>

      <div className="skill-tree-resets">
        <ConfirmButton
          className="skill-tree-reset"
          label={t('skillTree.resetTree')}
          confirmLabel={t('skillTree.resetTreeConfirm')}
          onConfirm={onResetTree}
        />
        <ConfirmButton
          className="skill-tree-reset danger"
          label={t('skillTree.resetSave')}
          confirmLabel={t('skillTree.resetSaveConfirm')}
          onConfirm={onResetFull}
        />
      </div>

      <button
        type="button"
        className={`skill-tree-start${showStartTip ? ' tutorial-target' : ''}`}
        onClick={onStartDay}
      >
        {t('common.startDay')}
      </button>

      {showStartTip && <StartDayTip t={t} onDismiss={() => setShowStartTip(false)} />}
    </div>
  )
}
