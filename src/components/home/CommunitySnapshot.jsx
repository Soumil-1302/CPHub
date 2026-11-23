export default function CommunitySnapshot({
  totalStudents = 0,
  totalSolved = 0,
  branches = [],
  showEmptyState = false,
}) {

  return (
    <section id="snapshot" className="cphub-snapshot-section" aria-label="Community Snapshot">
      <div className="cphub-container">
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 48px auto' }}>

          <h2 className="section-heading-editorial">
            Built for people who love <span className="italic-serif">solving problems.</span>
          </h2>
          <p className="section-desc-editorial" style={{ margin: '0 auto' }}>
            A verified look at campus coding momentum across Dayananda Sagar university,
            powered directly by live student submissions.
          </p>
        </div>

        {/* Asymmetrical Grid */}
        <div className="cphub-snapshot-grid">
          {/* Card 1: Featured Large Card (Problems Solved with platform breakdown) */}
          <div className="snapshot-card snapshot-card-featured">
            <div>
              <div className="snapshot-header-row">
                <span className="snapshot-label">LeetCode Problems Solved</span>
                <span className="snapshot-badge">Cached LeetCode Stats</span>
              </div>
              <div className="snapshot-stat-number snapshot-stat-number-lg">
                {totalSolved.toLocaleString()}
              </div>
              <p className="snapshot-desc">
                LeetCode problems in successfully refreshed student profiles.
              </p>
            </div>
          </div>

          {/* Card 2: Active Coders */}
          <div className="snapshot-card">
            <div>
              <div className="snapshot-header-row">
                <span className="snapshot-label">Active Coders</span>
                <span className="snapshot-badge">Completed profiles</span>
              </div>
              <div className="snapshot-stat-number">{totalStudents}</div>
              <p className="snapshot-desc">
                Students who have completed their CPHub profiles.
              </p>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cphub-text-muted)' }}>
              {totalStudents > 0 ? 'Based on registered CPHub student profiles.' : 'No completed student profiles yet.'}
            </div>
          </div>

          {/* Card 3: Engineering Branches (Dark editorial accent card) */}
          <div className="snapshot-card snapshot-card-dark">
            <div>
              <div className="snapshot-header-row">
                <span className="snapshot-label">Departments</span>
                <span className="section-eyebrow section-eyebrow-dark">From Profiles</span>
              </div>
              <div className="snapshot-stat-number">{branches.length}</div>
              <p className="snapshot-desc">
                Departments represented by students with completed profiles.
              </p>
            </div>
            <div className="snapshot-branch-pills">
              {branches.slice(0, 6).map((branch) => (
                <span key={branch} className="branch-mini-pill" style={{ background: 'rgba(255,255,255,0.08)', color: '#e4e4e7' }}>
                  {branch}
                </span>
              ))}
              {branches.length > 6 && (
                <span className="branch-mini-pill" style={{ background: 'rgba(255,255,255,0.08)', color: '#e4e4e7' }}>
                  +{branches.length - 6} more
                </span>
              )}
            </div>
          </div>

          {showEmptyState && (
            <div className="snapshot-card" role="status" style={{ gridColumn: '1 / -1' }}>
              <strong>No students have completed their profiles yet.</strong>
              <p className="snapshot-desc">
                Campus statistics and leaderboard results will appear here as students join CPHub.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
