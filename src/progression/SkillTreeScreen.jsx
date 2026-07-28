import { useState } from 'react'

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
import { deriveProgressionEffects } from './deriveProgressionEffects.js'

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

function popupHint(node, state, bank) {
  if (state === 'enabled') return 'Enabled.'
  if (state === 'disabled') return 'Disabled.'
  if (state === 'available') return `Buy for ${node.cost}.`
  if (state === 'unaffordable') return `You need ${Math.max(0, node.cost - bank)} to Buy.`
  return ''
}

function NodePopup({ node, state, bank }) {
  if (!node) return null

  const owned = isOwnedState(state)
  const horizontalClass = node.x >= 66 ? 'popup-left' : 'popup-right'

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
      <span className="skill-popup-tagline">{node.tagline}</span>
      <h2>{node.name}</h2>
      <p>{node.description}</p>
      {node.detail && <small>{node.detail}</small>}

      {!owned && (
        <div className="skill-popup-cost">
          <span>Cost</span>
          <strong>{node.cost}</strong>
        </div>
      )}

      <div className="skill-popup-hint">{popupHint(node, state, bank)}</div>
    </aside>
  )
}

function ConfirmButton({ className, label, confirmLabel, onConfirm }) {
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
        CANCEL
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
  onEnterMandala,
}) {
  const [activeId, setActiveId] = useState(null)
  const [deniedId, setDeniedId] = useState(null)
  const active = activeId ? SKILL_TREE_NODES_BY_ID[activeId] : null
  const activeVisible = active && isRevealed(progression, active.id) ? active : null
  const activeState = activeVisible ? nodeState(progression, activeVisible) : 'hidden'
  const mandalaReady = deriveProgressionEffects(progression.enabledNodeIds).mandalaEnabled

  // Connectors between revealed nodes; brighter once both ends are owned.
  const visibleEdges = SKILL_TREE_EDGES.filter(
    (edge) => isRevealed(progression, edge.from) && isRevealed(progression, edge.to),
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
      <h1 className="skill-tree-title">SKILL TREE</h1>

      <div className="skill-tree-bank" aria-live="polite">
        <span className="bank-gem" aria-hidden="true" />
        <strong>{progression.bank}</strong>
        {firstUnlock && <em className="bank-unlocked">UNLOCKED</em>}
      </div>

      <button type="button" className="skill-tree-close" onClick={onExit} aria-label="Back to title">
        ×
      </button>

      <div className="skill-tree-board">
        <div className="skill-tree-map" role="group" aria-label="Skill tree">
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

          {SKILL_TREE_NODES.map((node) => {
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
                    ? 'Locked skill'
                    : `${node.name}. ${node.description} ${
                        state === 'enabled'
                          ? 'Owned and enabled.'
                          : state === 'disabled'
                            ? 'Owned and disabled.'
                            : `Costs ${node.cost}.`
                      }`
                }
                aria-pressed={state === 'enabled' ? true : state === 'disabled' ? false : undefined}
              >
                {state === 'hidden' ? <span className="tree-node-lock">?</span> : <NodeIcon icon={node.icon} />}
                {owned && <span className="tree-node-owned">Owned</span>}
              </button>
            )
          })}

          <NodePopup node={activeVisible} state={activeState} bank={progression.bank} />
        </div>
      </div>

      <div className="skill-tree-resets">
        <ConfirmButton
          className="skill-tree-reset"
          label="RESET TREE"
          confirmLabel="RESET TREE?"
          onConfirm={onResetTree}
        />
        <ConfirmButton
          className="skill-tree-reset danger"
          label="RESET SAVE"
          confirmLabel="ERASE ALL?"
          onConfirm={onResetFull}
        />
      </div>

      <button type="button" className="skill-tree-start" onClick={onStartDay}>
        START THE DAY
      </button>

      {mandalaReady && onEnterMandala && (
        <button type="button" className="skill-tree-enter-mandala" onClick={onEnterMandala}>
          ENTER THE MANDALA
        </button>
      )}
    </div>
  )
}
