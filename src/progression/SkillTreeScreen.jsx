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

function nodeState(progression, node) {
  if (!isRevealed(progression, node.id)) return 'hidden'
  if (isPurchased(progression, node.id)) {
    return isEnabled(progression, node.id) ? 'enabled' : 'disabled'
  }
  return canPurchase(progression, node.id).ok ? 'available' : 'unaffordable'
}

function TreeNode({ node, state, onPurchase, onToggle }) {
  const hidden = state === 'hidden'
  const purchased = state === 'enabled' || state === 'disabled'

  const handleClick = () => {
    if (hidden) return
    if (purchased) onToggle(node.id, state === 'disabled')
    else if (state === 'available') onPurchase(node.id)
  }

  const label = hidden ? 'Locked' : node.name
  return (
    <button
      type="button"
      className={`tree-node tree-node-${state}`}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      onClick={handleClick}
      disabled={hidden || state === 'unaffordable'}
      aria-label={
        hidden
          ? 'Locked skill'
          : `${node.name}. ${node.description} ${
              purchased
                ? state === 'enabled'
                  ? 'Purchased and enabled. Activate to toggle off.'
                  : 'Purchased but disabled. Activate to toggle on.'
                : `Costs ${node.cost}. ${state === 'available' ? 'Available to purchase.' : 'Not enough banked.'}`
            }`
      }
      aria-pressed={purchased ? state === 'enabled' : undefined}
    >
      <span className="tree-node-name">{hidden ? '???' : label}</span>
      {!hidden && <span className="tree-node-tagline">{node.tagline}</span>}
      {!hidden && !purchased && <span className="tree-node-cost">{node.cost}</span>}
      {purchased && (
        <span className="tree-node-toggle">{state === 'enabled' ? 'ON' : 'OFF'}</span>
      )}
    </button>
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
}) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = selectedId ? SKILL_TREE_NODES_BY_ID[selectedId] : null
  const selectedVisible = selected && isRevealed(progression, selected.id) ? selected : null

  return (
    <div className="skill-tree-screen">
      <header className="skill-tree-header">
        <div>
          <span className="skill-tree-eyebrow">
            {firstUnlock ? 'SKILL TREE UNLOCKED' : 'SKILL TREE'}
          </span>
          <h1>Techniques</h1>
        </div>
        <div className="skill-tree-bank" aria-live="polite">
          <span>BANK</span>
          <strong>{progression.bank}</strong>
        </div>
      </header>

      <div className="skill-tree-canvas" role="group" aria-label="Skill tree">
        <svg
          className="skill-tree-edges"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {SKILL_TREE_EDGES.map(({ from, to }) => {
            const a = SKILL_TREE_NODES_BY_ID[from]
            const b = SKILL_TREE_NODES_BY_ID[to]
            const active = isPurchased(progression, from) && isRevealed(progression, to)
            return (
              <line
                key={`${from}-${to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={active ? 'edge-active' : 'edge-dim'}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>

        {SKILL_TREE_NODES.map((node) => (
          <div
            key={node.id}
            className="tree-node-anchor"
            onMouseEnter={() => setSelectedId(node.id)}
            onFocus={() => setSelectedId(node.id)}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <TreeNode
              node={node}
              state={nodeState(progression, node)}
              onPurchase={onPurchase}
              onToggle={onToggle}
            />
          </div>
        ))}
      </div>

      <aside className="skill-tree-detail" aria-live="polite">
        {selectedVisible ? (
          <>
            <strong>{selectedVisible.name}</strong>
            <p>{selectedVisible.description}</p>
            <small>{selectedVisible.detail}</small>
          </>
        ) : (
          <>
            <strong>Choose a technique</strong>
            <p>Hover or focus a node to read what it does. Buy to own it; owned nodes can be toggled on and off.</p>
          </>
        )}
      </aside>

      <footer className="skill-tree-actions">
        <button type="button" className="skill-tree-start" onClick={onStartDay}>
          START THE DAY
        </button>
        <button type="button" className="skill-tree-back" onClick={onExit}>
          BACK
        </button>
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
            confirmLabel="ERASE EVERYTHING?"
            onConfirm={onResetFull}
          />
        </div>
      </footer>
    </div>
  )
}
