import { useEffect, useState } from 'react'
import { ROUTES } from '../../constants/routes'
import { getLeaderboard } from '../../services/leaderboardApi'
import { getApiErrorMessage } from '../../services/api'

export default function LeaderboardPreview({ onNavigate }) {
  const [selectedBranch, setSelectedBranch] = useState('ALL')
  const [result, setResult] = useState(null)
  const loading = result?.branch !== selectedBranch
  const students = loading ? [] : result.students
  const error = loading ? '' : result.error
  const filterTabs = ['ALL', ...(result?.branches || [])]

  useEffect(() => {
    let active = true
    getLeaderboard({
      limit: 6,
      branch: selectedBranch,
      sortBy: 'total_solved',
      sortOrder: 'desc',
    })
      .then((data) => {
        if (active) {
          setResult({
            branch: selectedBranch,
            students: data.students || [],
            branches: data.summary?.available_branches || [],
            totalStudents: data.summary?.total_students || 0,
            error: '',
          })
        }
      })
      .catch((requestError) => {
        if (active) {
          setResult({
            branch: selectedBranch,
            students: [],
            branches: [],
            totalStudents: 0,
            error: getApiErrorMessage(requestError, 'Unable to load the leaderboard preview.'),
          })
        }
      })
    return () => {
      active = false
    }
  }, [selectedBranch])

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
            Preview of campus students ranked by LeetCode problems solved.
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
              {loading ? 'Loading performers…' : `Showing top ${students.length} performers`}
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
                  <th scope="col" style={{ width: '130px' }}>LeetCode Solved</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
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
                  </tr>
                ))}
                {!loading && !error && students.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      {result.totalStudents
                        ? 'No students found for this branch.'
                        : 'No students have completed their profiles yet.'}
                    </td>
                  </tr>
                )}
                {error && <tr><td colSpan="5" role="alert">{error}</td></tr>}
                {loading && <tr><td colSpan="5" role="status">Loading leaderboard…</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Full View CTA */}
          <div className="preview-footer">
            <span className="preview-footer-note">
              Rankings are based on LeetCode solve counts. Click any student to view their profile.
            </span>
            <button
              className="btn-preview-cta"
              onClick={() => onNavigate && onNavigate(ROUTES.LEADERBOARD)}
            >
              <span>View Full Leaderboard</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
