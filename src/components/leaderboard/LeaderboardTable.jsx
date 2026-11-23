import LeaderboardRow from './LeaderboardRow'

export default function LeaderboardTable({
  students = [],
  sortBy = 'total_solved',
  sortOrder = 'desc',
  currentPage = 1,
  pageSize = 20,
  totalCount = 0,
  onPageChange,
  onSortChange,
  onResetFilters,
  onNavigate,
}) {
  const totalPages = Math.ceil(totalCount / pageSize) || 1

  if (totalCount === 0) {
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
    const activeSort = columnKey === 'rank' || columnKey === 'leetcode'
      ? 'total_solved'
      : columnKey
    if (sortBy !== activeSort) return null
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
  const endEntry = Math.min((currentPage - 1) * pageSize + students.length, totalCount)

  return (
    <div className="leaderboard-table-card">
      <div className="leaderboard-table-wrapper">
        <table className="leaderboard-table" aria-label="University LeetCode Leaderboard">
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
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <LeaderboardRow
                key={student.username || student.rank || student.usn}
                student={student}
                onNavigate={onNavigate}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <footer className="table-pagination-footer" aria-label="Leaderboard Pagination">
        <div className="pagination-info">
          Showing <strong>{startEntry}–{endEntry}</strong> of {totalCount} students
        </div>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => onPageChange?.((page) => Math.max(1, page - 1))}
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
                  onClick={() => onPageChange?.(pageNum)}
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
              onClick={() => onPageChange?.((page) => Math.min(totalPages, page + 1))}
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
