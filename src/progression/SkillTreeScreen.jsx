import { useState } from 'react'

import {
  SKILL_TREE_NODES,
  SKILL_TREE_NODES_BY_ID,
  SKILL_TREE_EDGES,
  STARTING_NODE_ID,
} from './skillTreeConfig.js'
import {
  canPurchase,
  isEnabled,
  isPurchased,
  isRevealed,
} from './progressionStore.js'

// Compact node glyphs, drawn as inline SVG so the tree keeps its own visual
// language without depending on an icon package.
const ICONS = {
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

function stateCopy(node, state) {
  return {
    hidden: {
      label: 'LOCKED',
      hint: 'Unlock the previous skill to reveal this node.',
    },
    available: {
      label: 'AVAILABLE',
      hint: `Click the node to spend ${node.cost} banked score.`,
    },
    unaffordable: {
      label: 'NEED MORE SCORE',
      hint: `This skill costs ${node.cost} banked score.`,
    },
    enabled: {
      label: 'ENABLED',
      hint: 'Click the node to disable it without losing ownership.',
    },
    disabled: {
      label: 'DISABLED',
      hint: 'Click the node to enable it again.',
    },
  }[state]
}

function NodeInspector({ node, state }) {
  if (!node) {
    return (
      <aside className="skill-tree-inspector is-empty" aria-live="polite">
        <span className="inspector-kicker">SELECT A SKILL</span>
        <h2>UNKNOWN</h2>
        <p>Move through the tree to inspect the skills you have revealed.</p>
      </aside>
    )
  }

  const copy = stateCopy(node, state)

  return (
    <aside
      className={`skill-tree-inspector inspector-${state} category-${node.category}`}
      style={paletteStyle(node)}
      aria-live="polite"
    >
      <div className="inspector-topline">
        <span className="inspector-kicker">{node.tagline}</span>
        <span className="inspector-state">{copy.label}</span>
      </div>

      <div className="inspector-skill-heading">
        <span className="inspector-icon" aria-hidden="true">
          <NodeIcon icon={node.icon} />
        </span>
        <h2>{node.name}</h2>
      </div>

      <div className="inspector-rule" aria-hidden="true" />
      <p>{node.description}</p>
      {node.detail && <small>{node.detail}</small>}

      <div className="inspector-cost-row">
        <span>COST</span>
        <strong>{isPurchasedState(state) ? 'OWNED' : node.cost}</strong>
      </div>

      <div className="inspector-hint">{copy.hint}</div>
    </aside>
  )
}

function isPurchasedState(state) {
  return state === 'enabled' || state === 'disabled'
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
  const [activeId, setActiveId] = useState(STARTING_NODE_ID)
  const [deniedId, setDeniedId] = useState(null)
  const active = activeId ? SKILL_TREE_NODES_BY_ID[activeId] : null
  const activeVisible = active && isRevealed(progression, active.id) ? active : null
  const activeState = activeVisible ? nodeState(progression, activeVisible) : 'hidden'

  const clickNode = (node, state) => {
    if (state === 'hidden') return

    setActiveId(node.id)

    if (state === 'enabled' || state === 'disabled') {
      onToggle(node.id, state === 'disabled')
    } else if (state === 'available') {
      onPurchase(node.id)
    } else if (state === 'unaffordable') {
      // Give feedback instead of silently ignoring the click.
      setDeniedId(node.id)
      window.setTimeout(() => setDeniedId((id) => (id === node.id ? null : id)), 480)
    }
  }

  return (
    <div className="skill-tree-screen">
      <div className="skill-tree-title" aria-hidden="true">
        <span>PROGRESSION</span>
        <h1>SKILL TREE</h1>
      </div>

      <div className="skill-tree-board">
        <div className="skill-tree-map" role="group" aria-label="Skill tree">
          <div className="skill-tree-map-inset" aria-hidden="true" />

          <svg className="skill-tree-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {SKILL_TREE_EDGES.map(({ from, to }) => {
              const a = SKILL_TREE_NODES_BY_ID[from]
              const b = SKILL_TREE_NODES_BY_ID[to]
              const lit = isPurchased(progression, from) && isRevealed(progression, to)

              return (
                <g key={`${from}-${to}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className="edge-track"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={lit ? 'edge-lit' : 'edge-dim'}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )
            })}
          </svg>

          {SKILL_TREE_NODES.map((node) => {
            const state = nodeState(progression, node)
            const showCost = state === 'available' || state === 'unaffordable'
            const isRoot = node.id === STARTING_NODE_ID

            return (
              <button
                key={node.id}
                type="button"
                className={`tree-node tree-node-${state}${isRoot ? ' tree-node-root' : ''}${activeId === node.id ? ' is-active' : ''}${deniedId === node.id ? ' is-denied' : ''}`}
                data-skill-category={node.category}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  ...paletteStyle(node),
                }}
                onClick={() => clickNode(node, state)}
                onMouseEnter={() => state !== 'hidden' && setActiveId(node.id)}
                onFocus={() => state !== 'hidden' && setActiveId(node.id)}
                disabled={state === 'hidden'}
                aria-label={
                  state === 'hidden'
                    ? 'Locked skill'
                    : `${node.name}. ${node.description} ${
                        state === 'enabled'
                          ? 'Enabled.'
                          : state === 'disabled'
                            ? 'Owned, disabled.'
                            : `Costs ${node.cost}.`
                      }`
                }
                aria-pressed={state === 'enabled' ? true : state === 'disabled' ? false : undefined}
              >
                <span className="tree-node-rim" aria-hidden="true" />
                <span className="tree-node-glyph">
                  {state === 'hidden' ? <span className="tree-node-lock">?</span> : <NodeIcon icon={node.icon} />}
                </span>
                {state !== 'hidden' && <span className="tree-node-label">{node.name}</span>}
                {showCost && <span className="tree-node-cost">{node.cost}</span>}
              </button>
            )
          })}
        </div>

        <NodeInspector node={activeVisible} state={activeState} />
      </div>

      <div className="skill-tree-bank" aria-live="polite">
        <span className="bank-gem" aria-hidden="true" />
        <strong>{progression.bank}</strong>
        {firstUnlock && <em className="bank-unlocked">UNLOCKED</em>}
      </div>

      <button type="button" className="skill-tree-close" onClick={onExit} aria-label="Back to title">
        ×
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
          confirmLabel="ERASE ALL?"
          onConfirm={onResetFull}
        />
      </div>

      <button type="button" className="skill-tree-start" onClick={onStartDay}>
        START THE DAY
      </button>
    </div>
  )
}
