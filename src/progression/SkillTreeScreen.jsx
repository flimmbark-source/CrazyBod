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

// Compact node glyphs, drawn as inline SVG so the tiles read as icons rather
// than labelled boxes. 24x24 viewBox, currentColor stroke.
const ICONS = {
  plus: <path d="M12 6v12M6 12h12" />,
  chat: <path d="M5 6h14v9H9l-4 3z" />,
  list: <path d="M6 8h12M6 12h12M6 16h8" />,
  hold: <path d="M9 6v12M15 6v12" />,
  bolt: <path d="M13 5l-6 8h4l-1 6 6-9h-4z" />,
  shield: <path d="M12 5l6 2v5c0 4-3 6-6 7-3-1-6-3-6-7V7z" />,
}

function NodeIcon({ icon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[icon] ?? ICONS.plus}
    </svg>
  )
}

function nodeState(progression, node) {
  if (!isRevealed(progression, node.id)) return 'hidden'
  if (isPurchased(progression, node.id)) {
    return isEnabled(progression, node.id) ? 'enabled' : 'disabled'
  }
  return canPurchase(progression, node.id).ok ? 'available' : 'unaffordable'
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
        onClick={() => { setConfirming(false); onConfirm() }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="reset-confirm-no" onClick={() => setConfirming(false)}>
        CANCEL
      </button>
    </span>
  )
}

function NodeTooltip({ node, state, affordable }) {
  const side = node.x < 50 ? 'right' : 'left'
  const hint = {
    hidden: 'Locked',
    available: `Cost ${node.cost} · click to unlock`,
    unaffordable: `Cost ${node.cost} · need more banked`,
    enabled: 'Enabled · click to turn off',
    disabled: 'Owned · click to turn on',
  }[state]

  return (
    <div
      className={`tree-tip tree-tip-${side}`}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      role="tooltip"
    >
      <strong>{node.name}</strong>
      <span className="tree-tip-tag">{node.tagline}</span>
      <p>{node.description}</p>
      {node.detail && <small>{node.detail}</small>}
      <span className={`tree-tip-hint${state === 'available' && affordable ? ' can-buy' : ''}`}>{hint}</span>
    </div>
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
  const [activeId, setActiveId] = useState(null)
  const [deniedId, setDeniedId] = useState(null)
  const active = activeId ? SKILL_TREE_NODES_BY_ID[activeId] : null
  const activeVisible = active && isRevealed(progression, active.id) ? active : null

  const clickNode = (node, state) => {
    if (state === 'hidden') return
    if (state === 'enabled' || state === 'disabled') onToggle(node.id, state === 'disabled')
    else if (state === 'available') onPurchase(node.id)
    else if (state === 'unaffordable') {
      // Give feedback instead of silently ignoring the click.
      setDeniedId(node.id)
      window.setTimeout(() => setDeniedId((id) => (id === node.id ? null : id)), 480)
    }
  }

  return (
    <div className="skill-tree-screen">
      <div className="skill-tree-map" role="group" aria-label="Skill tree">
        <svg className="skill-tree-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {SKILL_TREE_EDGES.map(({ from, to }) => {
            const a = SKILL_TREE_NODES_BY_ID[from]
            const b = SKILL_TREE_NODES_BY_ID[to]
            const lit = isPurchased(progression, from) && isRevealed(progression, to)
            return (
              <line
                key={`${from}-${to}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={lit ? 'edge-lit' : 'edge-dim'}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>

        {SKILL_TREE_NODES.map((node) => {
          const state = nodeState(progression, node)
          const affordable = state === 'available'
          const showCost = state === 'available' || state === 'unaffordable'
          return (
            <button
              key={node.id}
              type="button"
              className={`tree-node tree-node-${state}${activeId === node.id ? ' is-active' : ''}${deniedId === node.id ? ' is-denied' : ''}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onClick={() => clickNode(node, state)}
              onMouseEnter={() => setActiveId(node.id)}
              onMouseLeave={() => setActiveId((id) => (id === node.id ? null : id))}
              onFocus={() => setActiveId(node.id)}
              onBlur={() => setActiveId((id) => (id === node.id ? null : id))}
              disabled={state === 'hidden'}
              aria-label={
                state === 'hidden'
                  ? 'Locked skill'
                  : `${node.name}. ${node.description} ${
                      state === 'enabled' ? 'Enabled.'
                      : state === 'disabled' ? 'Owned, disabled.'
                      : `Costs ${node.cost}.`
                    }`
              }
              aria-pressed={state === 'enabled' ? true : state === 'disabled' ? false : undefined}
            >
              <span className="tree-node-glyph">
                {state === 'hidden' ? <span className="tree-node-lock">?</span> : <NodeIcon icon={node.icon} />}
              </span>
              {showCost && <span className="tree-node-cost">{node.cost}</span>}
            </button>
          )
        })}

        {activeVisible && (
          <NodeTooltip node={activeVisible} state={nodeState(progression, activeVisible)} affordable />
        )}
      </div>

      {/* HUD overlays */}
      <div className="skill-tree-bank" aria-live="polite">
        <span className="bank-gem" aria-hidden="true" />
        <strong>{progression.bank}</strong>
        {firstUnlock && <em className="bank-unlocked">UNLOCKED</em>}
      </div>

      <button type="button" className="skill-tree-close" onClick={onExit} aria-label="Back to title">×</button>

      <div className="skill-tree-resets">
        <ConfirmButton className="skill-tree-reset" label="RESET TREE" confirmLabel="RESET TREE?" onConfirm={onResetTree} />
        <ConfirmButton className="skill-tree-reset danger" label="RESET SAVE" confirmLabel="ERASE ALL?" onConfirm={onResetFull} />
      </div>

      <button type="button" className="skill-tree-start" onClick={onStartDay}>START THE DAY</button>
    </div>
  )
}
