export default function ProfileComparison({ profileData }) {
  const { student, campusRank, totalStudents, campusPercentile, lcPercent, cfPercent, badges } =
    profileData

  return (
    <section className="profile-comparison-section" aria-label="Campus Comparison & Badges">
      <div className="comparison-card">
        <div className="comparison-header">
          <div>
            <h2 className="comparison-title">Campus Benchmark &amp; Platform Distribution</h2>
            <p className="comparison-desc">
              How {student.name}&apos;s algorithmic velocity compares to the {totalStudents} active competitive programmers at DSU.
            </p>
          </div>

          <div className="percentile-badge">
            <span className="percentile-num">Top {campusPercentile}%</span>
            <span className="percentile-label">Campus Standing</span>
          </div>
        </div>

        {/* Platform Share Split */}
        <div className="distribution-block">
          <div className="distribution-header">
            <span className="dist-label">Solving Balance: LeetCode vs Codeforces</span>
            <span className="dist-values">
              <strong>{lcPercent}%</strong> LC • <strong>{cfPercent}%</strong> CF
            </span>
          </div>

          <div className="distribution-bar-track" aria-label="LeetCode vs Codeforces Distribution">
            <div
              className="dist-bar-lc"
              style={{ width: `${lcPercent}%` }}
              title={`LeetCode: ${lcPercent}%`}
            />
            <div
              className="dist-bar-cf"
              style={{ width: `${cfPercent}%` }}
              title={`Codeforces: ${cfPercent}%`}
            />
          </div>

          <div className="distribution-legend">
            <span className="legend-item">
              <span className="legend-dot dot-lc" aria-hidden="true" />
              <span>LeetCode ({student.leetcode || 0} solves)</span>
            </span>
            <span className="legend-item">
              <span className="legend-dot dot-cf" aria-hidden="true" />
              <span>Codeforces ({student.codeforces || 0} solves)</span>
            </span>
          </div>
        </div>

        {/* Campus Milestones & Badges */}
        <div className="badges-wrapper">
          <h3 className="badges-heading">Earned Campus Honors &amp; Milestones</h3>

          {badges && badges.length > 0 ? (
            <div className="badges-grid">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="campus-badge-pill"
                  style={{
                    backgroundColor: badge.bg || '#f4f4f5',
                    color: badge.color || '#18181b',
                    borderColor: badge.color || '#e4e4e7',
                  }}
                >
                  <span className="badge-icon" aria-hidden="true">{badge.icon}</span>
                  <span className="badge-label">{badge.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-badges-note">
              Participate in upcoming weekly campus sprints to unlock algorithmic achievement badges.
            </p>
          )}
        </div>

        {/* Verified Data Note */}
        <div className="comparison-footer-banner">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>
            Campus metrics are indexed directly from verified university records. Rank #{campusRank} calculated using total solved problems with standard tie-break criteria.
          </span>
        </div>
      </div>
    </section>
  )
}
