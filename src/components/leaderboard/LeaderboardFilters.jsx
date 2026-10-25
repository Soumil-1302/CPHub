export default function LeaderboardFilters({
  branchOptions = [],
  yearOptions = [],
  selectedBranch = 'ALL',
  selectedYear = 'ALL',
  searchQuery = '',
  sortBy = 'total',
  sortOrder = 'desc',
  onBranchChange,
  onYearChange,
  onSearchChange,
  onSortByChange,
  onToggleSortOrder,
  onResetFilters,
  resultCount = 0,
  totalCount = 0,
}) {
  const isFiltered =
    selectedBranch !== 'ALL' ||
    selectedYear !== 'ALL' ||
    searchQuery.trim() !== '' ||
    sortBy !== 'total' ||
    sortOrder !== 'desc'

  return (
    <section className="leaderboard-controls-card" aria-label="Leaderboard Filters">
      <div className="filters-main-row">
        {/* Search */}
        <div className="filter-item filter-item-search">
          <label htmlFor="student-search" className="filter-label">Search Coder</label>
          <div className="filter-input-wrap">
            <span className="filter-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="student-search"
              type="text"
              className="filter-text-input"
              placeholder="Search by name, handle, or USN..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search by username, name, or USN"
            />
            {searchQuery && (
              <button
                type="button"
                className="filter-clear-btn"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Branch Filter */}
        <div className="filter-item">
          <label htmlFor="branch-filter" className="filter-label">Department</label>
          <div className="filter-select-wrap">
            <select
              id="branch-filter"
              className="filter-select"
              value={selectedBranch}
              onChange={(e) => onBranchChange(e.target.value)}
              aria-label="Filter students by branch"
            >
              <option value="ALL">All Departments</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Year Filter */}
        <div className="filter-item">
          <label htmlFor="year-filter" className="filter-label">Batch / Year</label>
          <div className="filter-select-wrap">
            <select
              id="year-filter"
              className="filter-select"
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
              aria-label="Filter students by graduation batch"
            >
              <option value="ALL">All Batches</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort Criterion */}
        <div className="filter-item">
          <label htmlFor="sort-filter" className="filter-label">Sort Metric</label>
          <div className="filter-sort-wrap">
            <select
              id="sort-filter"
              className="filter-select"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              aria-label="Sort students by metric"
            >
              <option value="total">Total Questions Solved</option>
              <option value="leetcode">LeetCode Solved</option>
              <option value="codeforces">Codeforces Solved</option>
              <option value="name">Student Name (A-Z)</option>
              <option value="rank">Campus Rank</option>
            </select>

            <button
              type="button"
              className="sort-direction-btn"
              onClick={onToggleSortOrder}
              title={`Sorting: ${sortOrder === 'desc' ? 'Highest first' : 'Lowest first'}`}
              aria-label={`Toggle sort order, current: ${sortOrder}`}
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>
      </div>

      {/* Results & Reset Bar */}
      <div className="filters-status-row">
        <span className="results-count-badge">
          Showing <strong>{resultCount}</strong> of {totalCount} students
        </span>

        {isFiltered && (
          <button
            type="button"
            className="filter-reset-action"
            onClick={onResetFilters}
            aria-label="Reset all filters to defaults"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </section>
  )
}
