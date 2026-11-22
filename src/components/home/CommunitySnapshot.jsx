export default function CommunitySnapshot({
  totalStudents = 100,
  totalSolved = 43099,
  branches = ['CST', 'CSE', 'AI&ML', 'CYBER', 'AI&DS', 'DataSci', 'ECE', 'ROBOTICS', 'AEROSPACE', 'MECH'],
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
                <span className="snapshot-badge">Campus Dataset</span>
              </div>
              <div className="snapshot-stat-number snapshot-stat-number-lg">
                {totalSolved.toLocaleString()}
              </div>
              <p className="snapshot-desc">
                LeetCode problems recorded across university batches.
              </p>
            </div>
          </div>

          {/* Card 2: Active Coders */}
          <div className="snapshot-card">
            <div>
              <div className="snapshot-header-row">
                <span className="snapshot-label">Active Coders</span>
                <span className="snapshot-badge">4 Batches</span>
              </div>
              <div className="snapshot-stat-number">{totalStudents}</div>
              <p className="snapshot-desc">
                University students practicing algorithms and climbing the campus LeetCode rankings.
              </p>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cphub-text-muted)' }}>
              From 2022 senior cohorts to incoming 2025 freshmen.
            </div>
          </div>

          {/* Card 3: Engineering Branches (Dark editorial accent card) */}
          <div className="snapshot-card snapshot-card-dark">
            <div>
              <div className="snapshot-header-row">
                <span className="snapshot-label">Departments</span>
                <span className="section-eyebrow section-eyebrow-dark">Cross-Campus</span>
              </div>
              <div className="snapshot-stat-number">{branches.length}</div>
              <p className="snapshot-desc">
                Engineering departments represented with branch-wise standings and friendly rivalry.
              </p>
            </div>
            <div className="snapshot-branch-pills">
              {branches.slice(0, 6).map((branch) => (
                <span key={branch} className="branch-mini-pill" style={{ background: 'rgba(255,255,255,0.08)', color: '#e4e4e7' }}>
                  {branch}
                </span>
              ))}
              <span className="branch-mini-pill" style={{ background: 'rgba(255,255,255,0.08)', color: '#e4e4e7' }}>
                +{branches.length - 6} more
              </span>
            </div>
          </div>

          {/* Card 4: Top Leading Batch */}
          <div className="snapshot-card" style={{ gridColumn: '2 / 4' }}>
            <div className="snapshot-header-row">
              <span className="snapshot-label">Competitive Milestone</span>
              <span className="snapshot-badge">Top Batch: 2024–2028</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--cphub-text-main)', marginBottom: '6px' }}>
                  High-Velocity Growth
                </div>
                <p className="snapshot-desc" style={{ marginBottom: 0, maxWidth: '440px' }}>
                  Sophomore and junior batches lead current daily submission volume, averaging over 450+ problems solved per student.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '36px', fontWeight: '800', color: 'var(--cphub-accent)' }}>#1 CST</span>
                <div style={{ fontSize: '12px', color: 'var(--cphub-text-muted)' }}>Department Leaderboard Position</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
