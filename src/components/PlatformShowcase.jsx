export default function PlatformShowcase({ onNavigate, totalLc = 43099, totalCf = 38648 }) {
  return (
    <section className="cphub-platforms-section" aria-label="Platforms Showcase">
      <div className="cphub-container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 48px auto' }}>
          <div className="section-eyebrow">
            <span>Platform Integration</span>
          </div>
          <h2 className="section-heading-editorial">
            Two arenas. <span className="italic-serif">One unified standing.</span>
          </h2>
          <p className="section-desc-editorial" style={{ margin: '0 auto' }}>
            We pull verified solve statistics from the two platforms students rely on most,
            bridging algorithmic practice with high-stakes contest speed.
          </p>
        </div>

        {/* Editorial Platforms Grid */}
        <div className="cphub-platforms-grid">
          {/* Card 1: LeetCode */}
          <div className="platform-card">
            <div>
              <div className="platform-card-header">
                <div className="platform-logo-wrapper">
                  <img
                    src="/lc.jpeg"
                    alt="LeetCode Logo"
                    className="platform-card-logo"
                    width="44"
                    height="44"
                  />
                  <div>
                    <h3 className="platform-brand-title">LeetCode</h3>
                    <span className="platform-brand-badge">Algorithmic Practice</span>
                  </div>
                </div>
                <span className="snapshot-badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                  {totalLc.toLocaleString()} Campus Solves
                </span>
              </div>

              <h4 className="platform-heading">Solve more. Learn faster.</h4>
              <p className="platform-desc">
                From two pointers and dynamic programming to trees and graph traversals.
                Track solution counts across Easy, Medium, and Hard difficulties, and benchmark
                your daily consistency against top campus performers.
              </p>

              {/* Difficulty Breakdown Visual */}
              <div className="lc-breakdown-box">
                <div className="lc-breakdown-title">Estimated Campus Difficulty Distribution</div>

                <div className="lc-diff-row">
                  <span className="diff-name diff-easy">
                    <span className="cf-tier-dot" style={{ background: '#16a34a' }} />
                    Easy Problems
                  </span>
                  <span className="diff-count">~18,100 (42%)</span>
                </div>

                <div className="lc-diff-row">
                  <span className="diff-name diff-medium">
                    <span className="cf-tier-dot" style={{ background: '#d97706' }} />
                    Medium Problems
                  </span>
                  <span className="diff-count">~19,820 (46%)</span>
                </div>

                <div className="lc-diff-row">
                  <span className="diff-name diff-hard">
                    <span className="cf-tier-dot" style={{ background: '#dc2626' }} />
                    Hard Problems
                  </span>
                  <span className="diff-count">~5,179 (12%)</span>
                </div>
              </div>
            </div>

            <button
              className="platform-action-btn"
              onClick={() => onNavigate && onNavigate('/leaderboard')}
            >
              <span>Explore LeetCode Leaders</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          {/* Card 2: Codeforces */}
          <div className="platform-card">
            <div>
              <div className="platform-card-header">
                <div className="platform-logo-wrapper">
                  <img
                    src="/cf.jpeg"
                    alt="Codeforces Logo"
                    className="platform-card-logo"
                    width="44"
                    height="44"
                  />
                  <div>
                    <h3 className="platform-brand-title">Codeforces</h3>
                    <span className="platform-brand-badge">Speed &amp; Rating</span>
                  </div>
                </div>
                <span className="snapshot-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                  {totalCf.toLocaleString()} Campus Solves
                </span>
              </div>

              <h4 className="platform-heading">Compete. Climb. Repeat.</h4>
              <p className="platform-desc">
                Step into live 2-hour contests where time complexity, stress testing, and edge
                cases make or break your standing. Climb division ranks, celebrate rating milestones,
                and review post-contest problem solutions with peers.
              </p>

              {/* Performance & Tiers Visual */}
              <div className="cf-performance-box">
                <div className="cf-performance-header">
                  <span className="lc-breakdown-title" style={{ margin: 0 }}>Campus Division Tiers</span>
                  <span className="cf-top-handle-pill">Top: @akhil_codes</span>
                </div>

                <div className="cf-ranks-pills">
                  <div className="cf-tier-chip">
                    <span className="cf-tier-dot" style={{ background: '#22c55e' }} />
                    <span>Pupil (1200–1399)</span>
                  </div>
                  <div className="cf-tier-chip">
                    <span className="cf-tier-dot" style={{ background: '#06b6d4' }} />
                    <span>Specialist (1400–1599)</span>
                  </div>
                  <div className="cf-tier-chip">
                    <span className="cf-tier-dot" style={{ background: '#3b82f6' }} />
                    <span>Expert (1600–1899)</span>
                  </div>
                  <div className="cf-tier-chip">
                    <span className="cf-tier-dot" style={{ background: '#a855f7' }} />
                    <span>Candidate Master (1900+)</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              className="platform-action-btn"
              onClick={() => onNavigate && onNavigate('/leaderboard')}
            >
              <span>View Competitive Rankings</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
