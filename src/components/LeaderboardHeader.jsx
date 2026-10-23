export default function LeaderboardHeader({ totalStudents = 0, totalSolved = 0, activeBranchCount = 0 }) {
  return (
    <header className="leaderboard-header">
      <div className="leaderboard-badge">
        <span className="leaderboard-badge__dot" aria-hidden="true" />
        <span>Live Campus Rankings</span>
      </div>

      <h1 className="leaderboard-title">
        CPHub <span className="accent">Leaderboard</span>
      </h1>

      <p className="leaderboard-subtitle">
        Competitive Programming Rankings across LeetCode & Codeforces. Track progress,
        celebrate milestones, and compare standing among university peers.
      </p>

      <div className="leaderboard-metrics">
        <div className="metric-pill">
          <span className="metric-pill__num">{totalStudents}</span>
          <span className="metric-pill__label">Active Coders</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill__num">{totalSolved.toLocaleString()}</span>
          <span className="metric-pill__label">Problems Solved</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill__num">{activeBranchCount}</span>
          <span className="metric-pill__label">Branches Represented</span>
        </div>
      </div>
    </header>
  )
}
