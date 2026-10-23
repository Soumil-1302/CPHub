import LeaderboardRow from './LeaderboardRow'

export default function LeaderboardTable({ students = [], onResetFilters }) {
  if (students.length === 0) {
    return (
      <div className="leaderboard-card">
        <div className="leaderboard-empty" role="status">
          <div className="leaderboard-empty__icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <h2 className="leaderboard-empty__title">No students found</h2>
          <p className="leaderboard-empty__desc">
            Try changing your branch or year filters.
          </p>
          {onResetFilters && (
            <button
              type="button"
              className="reset-filters-btn"
              onClick={onResetFilters}
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="leaderboard-card">
      <div className="leaderboard-table-wrapper">
        <table className="leaderboard-table" aria-label="Competitive Programming Leaderboard">
          <thead>
            <tr>
              <th scope="col" className="th-rank">Rank</th>
              <th scope="col" className="th-username">Username</th>
              <th scope="col" className="th-name">Name</th>
              <th scope="col" className="th-branch">Branch</th>
              <th scope="col" className="th-platform">LeetCode</th>
              <th scope="col" className="th-platform">Codeforces</th>
              <th scope="col" className="th-total">Total Solved</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <LeaderboardRow
                key={student.username || student.rank}
                student={student}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
