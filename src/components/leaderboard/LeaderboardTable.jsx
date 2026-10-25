import { useState, useMemo } from 'react'
import LeaderboardRow from './LeaderboardRow'

export default function LeaderboardTable({
  students = [],
  sortBy = 'total',
  sortOrder = 'desc',
  onSortChange,
  onResetFilters,
  onNavigate,
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [prevFilterKey, setPrevFilterKey] = useState(`${students.length}-${sortBy}-${sortOrder}`)
  const currentFilterKey = `${students.length}-${sortBy}-${sortOrder}`

  // Adjust page to 1 during render whenever student list length or sort changes
  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey)
    setCurrentPage(1)
  }

  const pageSize = 20

  const maxTotal = useMemo(() => {
    if (students.length === 0) return 1200
    return Math.max(...students.map((s) => s.total || 0), 100)
  }, [students])

  const totalPages = Math.ceil(students.length / pageSize) || 1
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return students.slice(start, start + pageSize)
  }, [students, currentPage])

  if (students.length === 0) {
    return (
      <div className="leaderboard-table-card">
        <div className="leaderboard-empty-state" role="status">
          <div className="empty-state-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <h2 className="empty-state-title">No matching students found</h2>
          <p className="empty-state-desc">
            Try adjusting your search query, or clear your department and batch filters to see more results.
          </p>
          {onResetFilters && (
            <button
              type="button"
              className="empty-state-reset-btn"
              onClick={onResetFilters}
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderSortIndicator = (columnKey) => {
    if (sortBy !== columnKey) return null
    return (
      <span className="sort-arrow-indicator" aria-hidden="true">
        {sortOrder === 'desc' ? ' ↓' : ' ↑'}
      </span>
    )
  }

  const handleHeaderClick = (columnKey) => {
    if (onSortChange) {
      onSortChange(columnKey)
    }
  }

  const startEntry = (currentPage - 1) * pageSize + 1
  const endEntry = Math.min(currentPage * pageSize, students.length)

  return (
    <div className="leaderboard-table-card">
      <div className="leaderboard-table-wrapper">
        <table className="leaderboard-table" aria-label="University Competitive Programming Leaderboard">
          <thead>
            <tr>
              <th
                scope="col"
                className="th-rank sortable"
                onClick={() => handleHeaderClick('rank')}
                title="Sort by Rank"
              >
                <span>Rank</span>
                {renderSortIndicator('rank')}
              </th>
              <th
                scope="col"
                className="th-username sortable"
                onClick={() => handleHeaderClick('name')}
                title="Sort by Coder Name"
              >
                <span>Coder</span>
                {renderSortIndicator('name')}
              </th>
              <th scope="col" className="th-name">
                <span>Name &amp; USN</span>
              </th>
              <th scope="col" className="th-branch">
                <span>Department</span>
              </th>
              <th
                scope="col"
                className="th-platform sortable"
                onClick={() => handleHeaderClick('leetcode')}
                title="Sort by LeetCode Solves"
              >
                <span>LeetCode</span>
                {renderSortIndicator('leetcode')}
              </th>
              <th
                scope="col"
                className="th-platform sortable"
                onClick={() => handleHeaderClick('codeforces')}
                title="Sort by Codeforces Solves"
              >
                <span>Codeforces</span>
                {renderSortIndicator('codeforces')}
              </th>
              <th
                scope="col"
                className="th-total sortable"
                onClick={() => handleHeaderClick('total')}
                title="Sort by Total Solved"
              >
                <span>Total Solved</span>
                {renderSortIndicator('total')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.map((student) => (
              <LeaderboardRow
                key={student.username || student.rank || student.usn}
                student={student}
                maxTotal={maxTotal}
                onNavigate={onNavigate}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <footer className="table-pagination-footer" aria-label="Leaderboard Pagination">
        <div className="pagination-info">
          Showing <strong>{startEntry}–{endEntry}</strong> of {students.length} students
        </div>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              ← Prev
            </button>

            <div className="pagination-pages-list">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`pagination-page-btn ${pageNum === currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                  aria-label={`Go to page ${pageNum}`}
                  aria-current={pageNum === currentPage ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
