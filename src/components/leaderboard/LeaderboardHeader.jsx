export default function LeaderboardHeader({
  totalStudents = 0,
  totalSolved = 0,
  totalLc = 0,
  totalCf = 0,
  activeBranchCount = 0,
}) {
  return (
    <header className="leaderboard-header">
      <div className="section-eyebrow">
        <span>Verified Campus Standings</span>
      </div>

      <h1 className="section-heading-editorial">
        University <span className="italic-serif">Leaderboard</span>
      </h1>

      <p className="section-desc-editorial" style={{ margin: '0 auto 36px auto' }}>
        Track real-time algorithmic solving velocity across LeetCode &amp; Codeforces.
        Compare performance with peers across engineering cohorts and celebrate campus milestones.
      </p>

      {/* Summary Metrics Bar */}
      <div className="leaderboard-metrics-bar">
        <div className="metric-box">
          <span className="metric-box__num">{totalStudents}</span>
          <span className="metric-box__label">Active Students</span>
        </div>
        <div className="metric-box-divider" aria-hidden="true" />
        <div className="metric-box">
          <span className="metric-box__num">{totalSolved.toLocaleString()}</span>
          <span className="metric-box__label">Total Problems Solved</span>
        </div>
        <div className="metric-box-divider" aria-hidden="true" />
        <div className="metric-box">
          <span className="metric-box__num">{totalLc.toLocaleString()}</span>
          <span className="metric-box__label">LeetCode Solves</span>
        </div>
        <div className="metric-box-divider" aria-hidden="true" />
        <div className="metric-box">
          <span className="metric-box__num">{totalCf.toLocaleString()}</span>
          <span className="metric-box__label">Codeforces Solves</span>
        </div>
        <div className="metric-box-divider" aria-hidden="true" />
        <div className="metric-box">
          <span className="metric-box__num">{activeBranchCount}</span>
          <span className="metric-box__label">Departments</span>
        </div>
      </div>
    </header>
  )
}
