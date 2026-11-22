import { useState, useMemo } from 'react'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import ClosingCTA from '../components/layout/ClosingCTA'
import ResourceCard from '../components/resources/ResourceCard'
import CategoryFilter from '../components/resources/CategoryFilter'
import { RESOURCES, RESOURCE_CATEGORIES, DIFFICULTY_LEVELS } from '../data/resources'
import '../styles/resources.css'

export default function Resources({ navigate }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeDifficulty, setActiveDifficulty] = useState('all')

  // Featured resources — always unfiltered
  const featuredResources = useMemo(() => {
    return RESOURCES.filter((r) => r.featured)
  }, [])

  // Recently added — sorted by dateAdded descending, take top 6
  const recentResources = useMemo(() => {
    return [...RESOURCES]
      .filter((r) => r.dateAdded)
      .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
      .slice(0, 6)
  }, [])

  // Filtered resources
  const filteredResources = useMemo(() => {
    let results = [...RESOURCES]

    // Category filter
    if (activeCategory !== 'all') {
      results = results.filter((r) => r.category === activeCategory)
    }

    // Difficulty filter
    if (activeDifficulty !== 'all') {
      results = results.filter((r) => r.difficulty === activeDifficulty)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      results = results.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.platform.toLowerCase().includes(query) ||
          (r.category && r.category.replace(/-/g, ' ').toLowerCase().includes(query))
      )
    }

    return results
  }, [activeCategory, activeDifficulty, searchQuery])

  const hasActiveFilters =
    activeCategory !== 'all' || activeDifficulty !== 'all' || searchQuery.trim().length > 0

  const handleResetFilters = () => {
    setSearchQuery('')
    setActiveCategory('all')
    setActiveDifficulty('all')
  }

  // Show featured and recent sections only when no active filters
  const showFeaturedSection = !hasActiveFilters && featuredResources.length > 0
  const showRecentSection = !hasActiveFilters && recentResources.length > 0

  return (
    <div className="resources-page">
      <FloatingNavbar onNavigate={navigate} currentPath="/resources" />

      <main className="resources-main">
        <div className="cphub-container">
          {/* ── Page Header ── */}
          <header className="resources-header">
            <div className="section-eyebrow">
              <span>Resources</span>
            </div>
            <h1 className="resources-heading">
              Learning <span className="italic-serif">Resources</span>
            </h1>
            <p className="resources-subtitle">
              Everything you need to master Data Structures, Algorithms, and Competitive Programming.
            </p>

            {/* Search Bar */}
            <div className="resources-search-wrapper">
              <div className="resources-search-box">
                <svg
                  className="resources-search-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="resources-search-input"
                  placeholder="Search resources by name, topic, or category…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search resources"
                />
                {searchQuery && (
                  <button
                    className="resources-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* ── Filters Row ── */}
          <section className="resources-filters-section">
            <CategoryFilter
              categories={RESOURCE_CATEGORIES}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />

            <div className="resources-secondary-filters">
              <div className="resources-difficulty-filter">
                <label className="resources-filter-label" htmlFor="difficulty-select">
                  Difficulty
                </label>
                <select
                  id="difficulty-select"
                  className="resources-filter-select"
                  value={activeDifficulty}
                  onChange={(e) => setActiveDifficulty(e.target.value)}
                >
                  {DIFFICULTY_LEVELS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="resources-results-meta">
                <span className="resources-results-count">
                  <strong>{filteredResources.length}</strong> of{' '}
                  <strong>{RESOURCES.length}</strong> resources
                </span>
                {hasActiveFilters && (
                  <button className="resources-reset-btn" onClick={handleResetFilters}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── Featured Resources ── */}
          {showFeaturedSection && (
            <section className="resources-section" aria-label="Featured Resources">
              <div className="resources-section-header">
                <h2 className="resources-section-title">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                    style={{ color: 'var(--cphub-accent, #d9383a)' }}
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                  </svg>
                  <span>Featured Resources</span>
                </h2>
                <p className="resources-section-desc">
                  Handpicked top resources to accelerate your learning journey.
                </p>
              </div>
              <div className="resources-grid resources-grid-featured">
                {featuredResources.map((resource, index) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    style={{ animationDelay: `${index * 60}ms` }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Recently Added ── */}
          {showRecentSection && (
            <section className="resources-section" aria-label="Recently Added">
              <div className="resources-section-header">
                <h2 className="resources-section-title">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Recently Added</span>
                </h2>
                <p className="resources-section-desc">
                  The newest additions to the CPHub resource library.
                </p>
              </div>
              <div className="resources-grid">
                {recentResources.map((resource, index) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    style={{ animationDelay: `${index * 60}ms` }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── All / Filtered Resources ── */}
          <section className="resources-section" aria-label="All Resources">
            {hasActiveFilters && (
              <div className="resources-section-header">
                <h2 className="resources-section-title">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  <span>Filtered Results</span>
                </h2>
              </div>
            )}

            {!hasActiveFilters && (
              <div className="resources-section-header">
                <h2 className="resources-section-title">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>All Resources</span>
                </h2>
                <p className="resources-section-desc">
                  Browse the complete collection of learning materials, platforms, and tools.
                </p>
              </div>
            )}

            {filteredResources.length > 0 ? (
              <div className="resources-grid" id="resources-grid" role="tabpanel">
                {filteredResources.map((resource, index) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    style={{ animationDelay: `${index * 40}ms` }}
                  />
                ))}
              </div>
            ) : (
              /* ── Empty State ── */
              <div className="resources-empty-state">
                <div className="resources-empty-icon">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>
                <h3 className="resources-empty-title">No resources found</h3>
                <p className="resources-empty-desc">
                  We couldn't find any resources matching your current filters.
                  Try broadening your search or resetting the filters.
                </p>
                <button className="resources-empty-reset-btn" onClick={handleResetFilters}>
                  Reset All Filters
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      <ClosingCTA onNavigate={navigate} />
    </div>
  )
}

