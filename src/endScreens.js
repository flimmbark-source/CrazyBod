const OVERLOAD_LIMIT = 6
const SCORE_PER_SECOND = 10

function createRunSnapshot() {
  return {
    rawScore: 0,
    currentLoad: 0,
    peakLoad: 0,
    solved: 0,
    spawnedIds: new Set(),
  }
}

let run = createRunSnapshot()
let endSequenceRoot = null
let bustTimer = null
let wasPlaying = false
const countedEffects = new WeakSet()

function numberFrom(text) {
  const value = Number.parseFloat(String(text ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(value) ? value : 0
}

function resetRunSnapshot() {
  run = createRunSnapshot()
}

function removeEndSequence() {
  if (bustTimer) window.clearTimeout(bustTimer)
  bustTimer = null
  endSequenceRoot?.remove()
  endSequenceRoot = null
  document.querySelectorAll('.screen-overlay.end-card-hidden').forEach((overlay) => {
    overlay.classList.remove('end-card-hidden')
  })
}

function registerMicrogame(element) {
  const id = element.dataset.gameId
  if (id) run.spawnedIds.add(id)
}

function registerCompletion(effect) {
  if (countedEffects.has(effect)) return
  countedEffects.add(effect)
  run.solved += 1
}

function scanNode(node) {
  if (!(node instanceof Element)) return

  if (node.matches('.microgame[data-game-id]')) registerMicrogame(node)
  node.querySelectorAll?.('.microgame[data-game-id]').forEach(registerMicrogame)

  if (node.matches('.completion-burst')) registerCompletion(node)
  node.querySelectorAll?.('.completion-burst').forEach(registerCompletion)

  if (node.matches('.screen-overlay') || node.querySelector?.('.screen-overlay')) {
    window.queueMicrotask(enhanceEndCard)
  }
}

function samplePlayingState() {
  const hud = document.querySelector('.hud')
  if (!hud) {
    wasPlaying = false
    return
  }

  if (!wasPlaying) {
    removeEndSequence()
    resetRunSnapshot()
    wasPlaying = true
  }

  const scoreText = document.querySelector('.score-panel strong')?.textContent
  const load = document.querySelectorAll('.load-pips i.filled').length

  run.rawScore = Math.max(run.rawScore, numberFrom(scoreText))
  run.currentLoad = load
  run.peakLoad = Math.max(run.peakLoad, load)
  document.querySelectorAll('.microgame[data-game-id]').forEach(registerMicrogame)
}

function outcomeFrom(card) {
  const eyebrow = card.querySelector('.eyebrow')?.textContent?.trim()
  if (eyebrow === 'OVERLOAD') return 'overload'
  if (eyebrow === 'YOU WENT HOME') return 'home'
  if (eyebrow === 'DESTINATION REACHED') return 'complete'
  return null
}

function buildResult(card, outcome) {
  const finalScore = Math.round(numberFrom(card.querySelector('.final-score strong')?.textContent))
  const inferredRaw = outcome === 'overload' ? finalScore * 4 : finalScore
  const rawScore = Math.max(finalScore, inferredRaw, Math.round(run.rawScore))
  const penalty = Math.max(0, rawScore - finalScore)
  const activeAtEnd = outcome === 'overload' ? OVERLOAD_LIMIT : run.currentLoad

  return {
    outcome,
    rawScore,
    finalScore,
    penalty,
    seconds: Math.min(50, rawScore / SCORE_PER_SECOND),
    solved: run.solved,
    peakLoad: outcome === 'overload' ? Math.max(OVERLOAD_LIMIT, run.peakLoad) : run.peakLoad,
    activeAtEnd,
    appeared: Math.max(run.spawnedIds.size, run.solved + activeAtEnd),
  }
}

function createSequenceRoot() {
  removeEndSequence()
  endSequenceRoot = document.createElement('div')
  endSequenceRoot.className = 'end-sequence-root'
  document.body.append(endSequenceRoot)
  return endSequenceRoot
}

function bustTiles() {
  return Array.from({ length: 12 }, (_, index) => (
    `<i class="bust-tile" style="--tile:${index}"></i>`
  )).join('')
}

function showOverloadBust(result, originalRestartButton) {
  const root = createSequenceRoot()
  root.classList.add('showing-bust')
  root.innerHTML = `
    <section class="overload-bust-stage" role="alert" aria-live="assertive">
      <div class="bust-static"></div>
      <div class="bust-rings"></div>
      <div class="bust-tiles">${bustTiles()}</div>
      <div class="bust-copy">
        <span>CAPACITY</span>
        <strong>OVERLOAD</strong>
        <em>TOO MANY THINGS AT ONCE</em>
      </div>
      <div class="bust-meter" aria-label="Overload six of six">
        ${Array.from({ length: OVERLOAD_LIMIT }, () => '<i></i>').join('')}
      </div>
    </section>
  `

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  bustTimer = window.setTimeout(
    () => showResults(result, originalRestartButton),
    reducedMotion ? 650 : 1850,
  )
}

const RESULT_COPY = {
  overload: {
    eyebrow: 'DAY RESULT',
    title: 'OVERLOADED',
    outcome: 'Overloaded',
    note: 'The day kept moving after your capacity ran out.',
  },
  home: {
    eyebrow: 'DAY RESULT',
    title: 'SAFE RETURN',
    outcome: 'Went home',
    note: 'You chose to stop before the day chose for you.',
  },
  complete: {
    eyebrow: 'DAY RESULT',
    title: 'MADE IT',
    outcome: 'Reached the café',
    note: 'You stayed out until the route was finished.',
  },
}

function scoreLedger(result) {
  const penaltyRow = result.outcome === 'overload'
    ? `<div class="score-ledger-row penalty"><span>OVERLOAD PENALTY</span><strong>-${result.penalty}</strong></div>`
    : `<div class="score-ledger-row protected"><span>SCORE KEPT</span><strong>100%</strong></div>`

  return `
    <div class="score-ledger">
      <div class="score-ledger-row"><span>EARNED</span><strong>${result.rawScore}</strong></div>
      ${penaltyRow}
      <div class="score-ledger-row total"><span>FINAL SCORE</span><strong>${result.finalScore}</strong></div>
    </div>
  `
}

function showResults(result, originalRestartButton) {
  if (bustTimer) window.clearTimeout(bustTimer)
  bustTimer = null

  const root = endSequenceRoot ?? createSequenceRoot()
  const copy = RESULT_COPY[result.outcome]
  root.className = `end-sequence-root showing-results outcome-${result.outcome}`
  root.innerHTML = `
    <section class="results-screen" aria-labelledby="results-title">
      <div class="results-card">
        <header class="results-header">
          <span>${copy.eyebrow}</span>
          <h1 id="results-title">${copy.title}</h1>
          <p>${copy.note}</p>
        </header>

        ${scoreLedger(result)}

        <div class="results-stats">
          <div><span>TIME OUT</span><strong>${result.seconds.toFixed(1)}s</strong></div>
          <div><span>CLEARED</span><strong>${result.solved}</strong></div>
          <div><span>PEAK LOAD</span><strong>${result.peakLoad}/${OVERLOAD_LIMIT}</strong></div>
          <div><span>LEFT ACTIVE</span><strong>${result.activeAtEnd}</strong></div>
        </div>

        <div class="results-outcome">
          <span>OUTCOME</span>
          <strong>${copy.outcome}</strong>
          <small>${result.appeared} demands appeared</small>
        </div>

        <div class="results-actions">
          <button class="results-restart" type="button">TRY ANOTHER DAY</button>
          <button class="results-tutorial" type="button">PLAY TUTORIAL</button>
        </div>
      </div>
    </section>
  `

  root.querySelector('.results-restart')?.addEventListener('click', () => {
    removeEndSequence()
    resetRunSnapshot()
    originalRestartButton.click()
  }, { once: true })

  root.querySelector('.results-tutorial')?.addEventListener('click', () => {
    removeEndSequence()
    resetRunSnapshot()
    window.dispatchEvent(new Event('crazybod:start-tutorial'))
  }, { once: true })
}

function enhanceEndCard() {
  const overlay = document.querySelector('.screen-overlay')
  const card = overlay?.querySelector('.overlay-card')
  if (!overlay || !card || overlay.dataset.endEnhanced === 'true') return

  const outcome = outcomeFrom(card)
  if (!outcome) return

  const originalRestartButton = card.querySelector(':scope > button')
  if (!originalRestartButton) return

  overlay.dataset.endEnhanced = 'true'
  overlay.classList.add('end-card-hidden')

  const result = buildResult(card, outcome)
  if (outcome === 'overload') showOverloadBust(result, originalRestartButton)
  else showResults(result, originalRestartButton)
}

const observer = new MutationObserver((records) => {
  for (const record of records) {
    record.addedNodes.forEach(scanNode)
  }
  window.queueMicrotask(enhanceEndCard)
})

function startEndScreens() {
  observer.observe(document.body, { childList: true, subtree: true })
  document.querySelectorAll('.microgame[data-game-id], .completion-burst').forEach(scanNode)
  window.setInterval(samplePlayingState, 80)
  samplePlayingState()
  enhanceEndCard()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startEndScreens, { once: true })
} else {
  startEndScreens()
}
