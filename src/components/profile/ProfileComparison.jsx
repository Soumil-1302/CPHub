export default function ProfileComparison({ profileData }) {
  const { student, campusRank, totalStudents, campusPercentile, badges } =
    profileData

  return (
    <section className="profile-comparison-section" aria-label="Campus Comparison & Badges">
      <div className="comparison-card">
        <div className="comparison-header">
          <div>
            <h2 className="comparison-title">Campus LeetCode Benchmark</h2>
            <p className="comparison-desc">
              {totalStudents
                ? `How ${student.name}'s LeetCode solve count compares with ${totalStudents} students.`
                : 'Campus ranking data is not available yet. Cached LeetCode statistics are shown above.'}
            </p>
          </div>

          <div className="percentile-badge">
            <span className="percentile-num">{campusPercentile ? `Top ${campusPercentile}%` : '—'}</span>
            <span className="percentile-label">Campus Standing</span>
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
            {campusRank
              ? `Campus rank #${campusRank} is calculated from cached LeetCode solve counts.`
              : 'Campus ranking is not available for this profile yet.'}
          </span>
        </div>
      </div>
    </section>
  )
}
