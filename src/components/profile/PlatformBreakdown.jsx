export default function PlatformBreakdown({ profileData }) {
  const { student, lcTotal, lcEasy, lcMedium, lcHard, cfTotal, cfTier, cfColor, cfRating } =
    profileData

  const username = student.username || ''
  const leetcodeUrl = `https://leetcode.com/u/${username}`
  const codeforcesUrl = `https://codeforces.com/profile/${username}`

  const lcEasyPct = lcTotal > 0 ? Math.round((lcEasy / lcTotal) * 100) : 0
  const lcMedPct = lcTotal > 0 ? Math.round((lcMedium / lcTotal) * 100) : 0
  const lcHardPct = lcTotal > 0 ? Math.max(0, 100 - lcEasyPct - lcMedPct) : 0

  return (
    <section className="profile-platforms-section" aria-label="Competitive Programming Platforms">
      <div className="profile-platforms-grid">
        {/* 1. LeetCode Section Card */}
        <div className="platform-detail-card lc-detail-card">
          <div className="platform-card-top">
            <div className="platform-meta">
              <img
                src="/lc.jpeg"
                alt="LeetCode Logo"
                className="platform-logo-img"
                width="36"
                height="36"
              />
              <div>
                <h2 className="platform-title">LeetCode</h2>
                <span className="platform-handle">@{username}</span>
              </div>
            </div>

            <a
              href={leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="platform-external-btn"
              title={`Open LeetCode profile for @${username}`}
              aria-label={`Open LeetCode profile for ${username}`}
            >
              <span>Profile</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="platform-headline-metric">
            <span className="headline-num">{(lcTotal || 0).toLocaleString()}</span>
            <span className="headline-label">Problems Solved</span>
          </div>

          {/* Difficulty Bar */}
          <div className="difficulty-visual-track" aria-label="Difficulty Breakdown Bar">
            <div
              className="diff-bar diff-bar-easy"
              style={{ width: `${lcEasyPct}%` }}
              title={`Easy: ${lcEasy} (${lcEasyPct}%)`}
            />
            <div
              className="diff-bar diff-bar-med"
              style={{ width: `${lcMedPct}%` }}
              title={`Medium: ${lcMedium} (${lcMedPct}%)`}
            />
            <div
              className="diff-bar diff-bar-hard"
              style={{ width: `${lcHardPct}%` }}
              title={`Hard: ${lcHard} (${lcHardPct}%)`}
            />
          </div>

          {/* Difficulty Metric Chips */}
          <div className="difficulty-chips-grid">
            <div className="difficulty-chip chip-easy">
              <span className="diff-dot dot-easy" aria-hidden="true" />
              <div className="diff-meta">
                <span className="diff-title">Easy</span>
                <span className="diff-count">{lcEasy}</span>
              </div>
              <span className="diff-pct">{lcEasyPct}%</span>
            </div>

            <div className="difficulty-chip chip-medium">
              <span className="diff-dot dot-medium" aria-hidden="true" />
              <div className="diff-meta">
                <span className="diff-title">Medium</span>
                <span className="diff-count">{lcMedium}</span>
              </div>
              <span className="diff-pct">{lcMedPct}%</span>
            </div>

            <div className="difficulty-chip chip-hard">
              <span className="diff-dot dot-hard" aria-hidden="true" />
              <div className="diff-meta">
                <span className="diff-title">Hard</span>
                <span className="diff-count">{lcHard}</span>
              </div>
              <span className="diff-pct">{lcHardPct}%</span>
            </div>
          </div>

          <div className="platform-card-footer">
            <span className="platform-footer-tip">
              Verified algorithmic solutions synced from university contest tracker.
            </span>
          </div>
        </div>

        {/* 2. Codeforces Section Card */}
        <div className="platform-detail-card cf-detail-card">
          <div className="platform-card-top">
            <div className="platform-meta">
              <img
                src="/cf.jpeg"
                alt="Codeforces Logo"
                className="platform-logo-img"
                width="36"
                height="36"
              />
              <div>
                <h2 className="platform-title">Codeforces</h2>
                <span className="platform-handle">@{username}</span>
              </div>
            </div>

            <a
              href={codeforcesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="platform-external-btn"
              title={`Open Codeforces profile for @${username}`}
              aria-label={`Open Codeforces profile for ${username}`}
            >
              <span>Profile</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="platform-headline-metric">
            <span className="headline-num">{(cfTotal || 0).toLocaleString()}</span>
            <span className="headline-label">Problems Solved</span>
          </div>

          {/* Rating & Rank Block */}
          <div className="cf-rank-showcase">
            <div className="cf-tier-pill" style={{ borderColor: cfColor, color: cfColor }}>
              <span className="cf-tier-circle" style={{ backgroundColor: cfColor }} aria-hidden="true" />
              <span>{cfTier}</span>
            </div>

            <div className="cf-rating-box">
              <span className="cf-rating-label">Contest Rating Estimate</span>
              <span className="cf-rating-val" style={{ color: cfColor }}>
                {cfRating}
              </span>
            </div>
          </div>

          <div className="cf-stats-list">
            <div className="cf-stat-row">
              <span className="cf-stat-name">Active Competitor Status</span>
              <span className="cf-stat-val text-positive">✓ Active Division Rated</span>
            </div>
            <div className="cf-stat-row">
              <span className="cf-stat-name">Rank Category</span>
              <span className="cf-stat-val" style={{ color: cfColor, fontWeight: 700 }}>
                {cfTier}
              </span>
            </div>
            <div className="cf-stat-row">
              <span className="cf-stat-name">Campus Solves Share</span>
              <span className="cf-stat-val">
                {cfTotal > 0 ? `${Math.round((cfTotal / (student.totalSolved || 1)) * 100)}% of total` : '0%'}
              </span>
            </div>
          </div>

          <div className="platform-card-footer">
            <span className="platform-footer-tip">
              Division contest problems and competitive problem-set archive submissions.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
