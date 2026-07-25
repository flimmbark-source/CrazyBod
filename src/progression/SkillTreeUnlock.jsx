// First-run bridge. After the first day's score is banked, the tree unlocks
// and the player is routed here automatically. From the tree they can buy a
// technique or start another run immediately.
export default function SkillTreeUnlock({ finalScore, bank, onOpenTree }) {
  return (
    <div className="end-sequence-root showing-results outcome-unlock">
      <section className="results-screen" aria-labelledby="unlock-title">
        <div className="results-card unlock-card">
          <header className="results-header">
            <span>NEW</span>
            <h1 id="unlock-title">SKILL TREE UNLOCKED</h1>
            <p>Your first day is banked. Spend it on techniques for the days ahead.</p>
          </header>

          <div className="unlock-bank">
            <div><span>BANKED TODAY</span><strong>+{finalScore}</strong></div>
            <div><span>BANK TOTAL</span><strong>{bank}</strong></div>
          </div>

          <div className="results-actions">
            <button className="results-restart" type="button" onClick={onOpenTree}>
              OPEN SKILL TREE
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
