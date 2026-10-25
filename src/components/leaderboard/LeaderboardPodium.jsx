import { ROUTES } from '../../constants/routes'

export default function LeaderboardPodium({ topStudents = [], onNavigate }) {
  if (topStudents.length === 0) return null

  // Order: [Rank 2 (Silver), Rank 1 (Gold), Rank 3 (Bronze)] for podium arrangement on desktop
  const first = topStudents[0]
  const second = topStudents[1]
  const third = topStudents[2]

  const podiumList = [
    { student: second, place: 2, medal: '🥈', label: '2nd Place', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
    { student: first, place: 1, medal: '🥇', label: '1st Place', color: '#b45309', bg: '#fef3c7', border: '#fcd34d', featured: true },
    { student: third, place: 3, medal: '🥉', label: '3rd Place', color: '#c2410c', bg: '#ffedd5', border: '#fdba74' },
  ].filter((p) => p.student)

  return (
    <div className="leaderboard-podium-section" aria-label="Campus Top 3 Performers">
      <div className="podium-cards-grid">
        {podiumList.map(({ student, place, medal, label, color, bg, border, featured }) => (
          <div
            key={student.username || place}
            className={`podium-card ${featured ? 'podium-card-first' : ''}`}
            style={{ borderColor: border }}
            onClick={() => onNavigate && onNavigate(ROUTES.profile(student.username))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigate && onNavigate(ROUTES.profile(student.username))}
            aria-label={`View profile of ${student.name}, Rank ${place}`}
          >
            <div className="podium-card-header">
              <span
                className="podium-place-tag"
                style={{ backgroundColor: bg, color: color, borderColor: border }}
              >
                <span aria-hidden="true">{medal}</span> {label}
              </span>
              <span className="podium-branch-tag">{student.branchDisplay || student.branch}</span>
            </div>

            <div className="podium-avatar-wrapper">
              <div
                className="podium-avatar-ring"
                style={{ borderColor: color, backgroundColor: bg }}
              >
                <span>{(student.name || 'S').charAt(0)}</span>
              </div>
              <span className="podium-rank-pill" style={{ backgroundColor: color }}>
                #{place}
              </span>
            </div>

            <h3 className="podium-student-name">{student.name}</h3>
            <span className="podium-student-user">@{student.username}</span>

            <div className="podium-stats-row">
              <div className="podium-stat-pill">
                <img src="/lc.jpeg" alt="LeetCode" width="16" height="16" />
                <span>{(student.leetcode || 0).toLocaleString()}</span>
              </div>
              <div className="podium-stat-pill">
                <img src="/cf.jpeg" alt="Codeforces" width="16" height="16" />
                <span>{(student.codeforces || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="podium-total-box">
              <span className="podium-total-label">Total Solved</span>
              <span className="podium-total-value">{(student.total || 0).toLocaleString()}</span>
            </div>

            <button
              type="button"
              className="podium-view-btn"
              onClick={(e) => {
                e.stopPropagation()
                onNavigate && onNavigate(ROUTES.profile(student.username))
              }}
            >
              <span>View Profile</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
