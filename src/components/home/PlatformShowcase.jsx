export default function PlatformShowcase({ onNavigate, totalLc = 43099 }) {
  return (
    <section className="cphub-platforms-section" aria-label="Platforms Showcase">
      <div className="cphub-container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 48px auto' }}>
          <div className="section-eyebrow">
            <span>LeetCode Rankings</span>
          </div>
          <h2 className="section-heading-editorial">
            Your progress. <span className="italic-serif">One campus leaderboard.</span>
          </h2>
          <p className="section-desc-editorial" style={{ margin: '0 auto' }}>
            Explore LeetCode practice totals and difficulty breakdowns across the campus dataset.
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
                    <span className="difficulty-dot" style={{ background: '#16a34a' }} />
                    Easy Problems
                  </span>
                  <span className="diff-count">~18,100 (42%)</span>
                </div>

                <div className="lc-diff-row">
                  <span className="diff-name diff-medium">
                    <span className="difficulty-dot" style={{ background: '#d97706' }} />
                    Medium Problems
                  </span>
                  <span className="diff-count">~19,820 (46%)</span>
                </div>

                <div className="lc-diff-row">
                  <span className="diff-name diff-hard">
                    <span className="difficulty-dot" style={{ background: '#dc2626' }} />
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


        </div>
      </div>
    </section>
  )
}
