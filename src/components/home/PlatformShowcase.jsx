export default function PlatformShowcase({ onNavigate, totalLc = 0 }) {
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
            Explore cached LeetCode practice totals from completed student profiles.
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

              {/* Cached statistics summary */}
              <div className="lc-breakdown-box">
                <div className="lc-breakdown-title">Verified campus statistics</div>
                <p className="platform-desc">
                  {totalLc > 0
                    ? `${totalLc.toLocaleString()} problems solved across cached student profiles.`
                    : 'No cached LeetCode statistics are available yet.'}
                </p>
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
