import { useState, useMemo } from 'react'
import { ROUTES } from '../../constants/routes'

export default function LeaderboardPreview({ students = [], onNavigate }) {
  const [selectedBranch, setSelectedBranch] = useState('ALL')

  // Top branch options for quick preview tabs
  const filterTabs = ['ALL', 'CST', 'CSE', 'AI&ML', 'CYBER', 'AI&DS']

  // Filter and sort students descending by total
  const filteredPreview = useMemo(() => {
    let list = students
    if (selectedBranch !== 'ALL') {
      list = list.filter((s) => (s.branch || '').toUpperCase() === selectedBranch)
    }

    // Sort descending by total
    const sorted = [...list].sort((a, b) => {
      const aTotal = Number.isFinite(a.total) ? a.total : (Number(a.leetcode) || 0) + (Number(a.codeforces) || 0)
      const bTotal = Number.isFinite(b.total) ? b.total : (Number(b.leetcode) || 0) + (Number(b.codeforces) || 0)
      return bTotal - aTotal
    })

    // Take top 6 for the preview
    return sorted.slice(0, 6).map((student, idx) => ({
      ...student,
      rank: idx + 1,
      totalSolved: Number.isFinite(student.total) ? student.total : (Number(student.leetcode) || 0) + (Number(student.codeforces) || 0),
    }))
  }, [students, selectedBranch])

  return (
    <section className="cphub-preview-section" aria-label="Leaderboard Preview">
      <div className="cphub-container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 40px auto' }}>
          <div className="section-eyebrow">
            <span>Campus Leaderboard</span>
          </div>
          <h2 className="section-heading-editorial">
            The University <span className="italic-serif">CP Standings.</span>
          </h2>
          <p className="section-desc-editorial" style={{ margin: '0 auto' }}>
            Live preview of top problem solvers across campus. Ranked by verified total solves across LeetCode and Codeforces.
          </p>
        </div>

        {/* Table Card */}
        <div className="cphub-preview-card">
          {/* Toolbar */}
          <div className="preview-toolbar">
            <div className="preview-branch-tabs" role="tablist" aria-label="Filter leaderboard by branch">
              {filterTabs.map((branch) => (
                <button
                  key={branch}
                  role="tab"
                  aria-selected={selectedBranch === branch}
                  className={`preview-tab-btn ${selectedBranch === branch ? 'active' : ''}`}
                  onClick={() => setSelectedBranch(branch)}
                >
                  {branch === 'ALL' ? 'All Branches' : branch}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '13px', color: 'var(--cphub-text-muted)' }}>
              Showing top {filteredPreview.length} performers
            </div>
          </div>

          {/* Table */}
          <div className="preview-table-wrapper">
            <table className="preview-table" aria-label="Top Leaderboard Preview">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                  <th scope="col" style={{ minWidth: '150px' }}>Username</th>
                  <th scope="col" style={{ minWidth: '170px' }}>Name</th>
                  <th scope="col" style={{ width: '110px', textAlign: 'center' }}>Branch</th>
                  <th scope="col" style={{ width: '130px' }}>LeetCode</th>
                  <th scope="col" style={{ width: '130px' }}>Codeforces</th>
                  <th scope="col" style={{ width: '120px', textAlign: 'right' }}>Total Solved</th>
                </tr>
              </thead>
              <tbody>
                {filteredPreview.map((student) => (
                  <tr
                    key={student.username || student.rank}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onNavigate && onNavigate(ROUTES.profile(student.username))}
                    title={`View profile of ${student.name} (@${student.username})`}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`preview-rank-badge ${
                          student.rank === 1
                            ? 'preview-rank-1'
                            : student.rank === 2
                            ? 'preview-rank-2'
                            : student.rank === 3
                            ? 'preview-rank-3'
                            : ''
                        }`}
                      >
                        {student.rank === 1 ? '🥇 1' : student.rank === 2 ? '🥈 2' : student.rank === 3 ? '🥉 3' : student.rank}
                      </span>
                    </td>
                    <td>
                      <span className="preview-username">@{student.username}</span>
                    </td>
                    <td>
                      <strong style={{ fontWeight: 600 }}>{student.name}</strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="preview-branch-tag">{student.branch}</span>
                    </td>
                    <td>
                      <div className="preview-stat-cell">
                        <img
                          src="/lc.jpeg"
                          alt="LeetCode"
                          className="preview-platform-icon"
                          width="18"
                          height="18"
                        />
                        <span>{(student.leetcode || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td>
                      <div className="preview-stat-cell">
                        <img
                          src="/cf.jpeg"
                          alt="Codeforces"
                          className="preview-platform-icon"
                          width="18"
                          height="18"
                        />
                        <span>{(student.codeforces || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="preview-total-badge">
                        {student.totalSolved.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Full View CTA */}
          <div className="preview-footer">
            <span className="preview-footer-note">
              Rankings recalculate instantly on new problem solves and verified contest ratings. Click any student to view their detailed profile.
            </span>
            <button
              className="btn-preview-cta"
              onClick={() => onNavigate && onNavigate(ROUTES.LEADERBOARD)}
            >
              <span>View Full 100+ Leaderboard</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
