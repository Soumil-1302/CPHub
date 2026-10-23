export default function LeaderboardFilters({
  branchOptions = [],
  yearOptions = [],
  selectedBranch = 'ALL',
  selectedYear = 'ALL',
  searchQuery = '',
  onBranchChange,
  onYearChange,
  onSearchChange,
  onResetFilters,
  resultCount = 0,
  totalCount = 0,
}) {
  const isFiltered = selectedBranch !== 'ALL' || selectedYear !== 'ALL' || searchQuery.trim() !== '';

  return (
    <section className="leaderboard-controls" aria-label="Leaderboard Filters">
      <div className="leaderboard-filters">
        {/* Branch Filter */}
        <div className="filter-group">
          <label htmlFor="branch-filter" className="filter-label">Branch</label>
          <div className="filter-select-wrapper">
            <select
              id="branch-filter"
              className="filter-select"
              value={selectedBranch}
              onChange={(e) => onBranchChange(e.target.value)}
              aria-label="Filter students by branch"
            >
              <option value="ALL">All Branches</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
            <span className="filter-select-arrow" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </div>
        </div>

        {/* Year Filter */}
        <div className="filter-group">
          <label htmlFor="year-filter" className="filter-label">Graduation Year</label>
          <div className="filter-select-wrapper">
            <select
              id="year-filter"
              className="filter-select"
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
              aria-label="Filter students by graduation year"
            >
              <option value="ALL">All Years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <span className="filter-select-arrow" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="filter-group">
          <label htmlFor="student-search" className="filter-label">Search</label>
          <div className="filter-search-wrapper">
            <span className="filter-search-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="student-search"
              type="text"
              className="filter-search-input"
              placeholder="Search coder or name..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search by username or name"
            />
          </div>
        </div>
      </div>

      <div className="leaderboard-actions">
        <span className="results-counter">
          Showing <strong>{resultCount}</strong> of {totalCount} students
        </span>

        {isFiltered && (
          <button
            type="button"
            className="reset-filters-btn"
            onClick={onResetFilters}
            aria-label="Reset all filters"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Reset</span>
          </button>
        )}
      </div>
    </section>
  )
}
