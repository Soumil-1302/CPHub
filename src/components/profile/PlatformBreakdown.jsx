export default function PlatformBreakdown({ profileData }) {
  const { student, lcTotal, lcEasy, lcMedium, lcHard } = profileData

  const username = student.username || ''
  const leetcodeUrl = `https://leetcode.com/u/${username}`

  const lcEasyPct = lcTotal > 0 ? Math.round((lcEasy / lcTotal) * 100) : 0
  const lcMedPct = lcTotal > 0 ? Math.round((lcMedium / lcTotal) * 100) : 0
  const lcHardPct = lcTotal > 0 ? Math.max(0, 100 - lcEasyPct - lcMedPct) : 0

  return (
    <section className="profile-platforms-section" aria-label="LeetCode Statistics">
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
              LeetCode solve count recorded in the campus student dataset.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
