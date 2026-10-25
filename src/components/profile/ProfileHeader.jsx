import { ROUTES } from '../../constants/routes'

export default function ProfileHeader({ profileData, onNavigate }) {
  const { student, campusRank, totalStudents, deptRank, deptTotal, batchRank, batchTotal } =
    profileData

  const isRank1 = campusRank === 1
  const isRank2 = campusRank === 2
  const isRank3 = campusRank === 3

  const rankBadgeStyle = isRank1
    ? { background: '#fef08a', color: '#854d0e', border: '1px solid #facc15' }
    : isRank2
    ? { background: '#e2e8f0', color: '#334155', border: '1px solid #cbd5e1' }
    : isRank3
    ? { background: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa' }
    : { background: '#18181b', color: '#ffffff' }

  return (
    <header className="profile-header-card">
      {/* Navigation Breadcrumb */}
      <div className="profile-nav-bar">
        <button
          type="button"
          className="profile-back-btn"
          onClick={() => onNavigate && onNavigate(ROUTES.LEADERBOARD)}
          aria-label="Back to Leaderboard"
        >
          <span aria-hidden="true">←</span>
          <span>Back to Leaderboard</span>
        </button>

        <span className="profile-status-badge">
          <span className="live-pulse-dot" aria-hidden="true" />
          <span>Active University Record</span>
        </span>
      </div>

      {/* Main Student Identity Row */}
      <div className="profile-identity-row">
        <div className="profile-avatar-wrapper">
          <div className="profile-large-avatar" aria-hidden="true">
            {(student.name || 'S').charAt(0)}
          </div>
          <span
            className="profile-rank-chip"
            style={rankBadgeStyle}
            title={`Campus Rank #${campusRank}`}
          >
            #{campusRank}
          </span>
        </div>

        <div className="profile-info-block">
          <div className="profile-title-row">
            <h1 className="profile-student-name">{student.name}</h1>
            <span className="profile-username-tag">@{student.username}</span>
          </div>

          <p className="profile-affiliation-line">
            <span className="affiliation-org">Dayananda Sagar University</span>
            <span className="bullet-sep" aria-hidden="true">•</span>
            <span className="affiliation-usn">{student.usn}</span>
          </p>

          <div className="profile-tags-row">
            <span className="profile-pill-tag tag-branch">
              <strong>Department:</strong> {student.branchDisplay || student.branch}
            </span>
            <span className="profile-pill-tag tag-batch">
              <strong>Batch:</strong> {student.year || 'N/A'}
            </span>
            <span className="profile-pill-tag tag-verified">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Verified CPHub Coder</span>
            </span>
          </div>
        </div>
      </div>

      {/* Campus Standing Stat Cards Grid */}
      <div className="profile-quick-stats-grid">
        <div className="quick-stat-box">
          <span className="stat-box-label">Campus Standing</span>
          <div className="stat-box-val-row">
            <span className="stat-box-val">#{campusRank}</span>
            <span className="stat-box-sub">of {totalStudents} coders</span>
          </div>
        </div>

        <div className="quick-stat-box">
          <span className="stat-box-label">Department Rank</span>
          <div className="stat-box-val-row">
            <span className="stat-box-val">#{deptRank}</span>
            <span className="stat-box-sub">of {deptTotal} in {student.branchDisplay || 'Dept'}</span>
          </div>
        </div>

        <div className="quick-stat-box">
          <span className="stat-box-label">Batch Rank</span>
          <div className="stat-box-val-row">
            <span className="stat-box-val">#{batchRank}</span>
            <span className="stat-box-sub">of {batchTotal} in {student.year || 'Batch'}</span>
          </div>
        </div>

        <div className="quick-stat-box quick-stat-box-highlight">
          <span className="stat-box-label">Total Problems Solved</span>
          <div className="stat-box-val-row">
            <span className="stat-box-val stat-val-accent">
              {(student.totalSolved || 0).toLocaleString()}
            </span>
            <span className="stat-box-sub">Across All Platforms</span>
          </div>
        </div>
      </div>
    </header>
  )
}
