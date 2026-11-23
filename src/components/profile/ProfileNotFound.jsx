import { ROUTES } from '../../constants/routes'

export default function ProfileNotFound({ identifier = '', onNavigate }) {
  return (
    <div className="profile-not-found-card" role="status">
      <div className="not-found-icon-wrap" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div className="section-eyebrow" style={{ margin: '0 auto 14px auto' }}>
        <span>Coder Record Not Found</span>
      </div>

      <h1 className="not-found-title">
        Profile Not Found for <span className="italic-serif">&ldquo;{identifier}&rdquo;</span>
      </h1>

      <p className="not-found-desc">
        We could not find a registered CPHub student profile for this username.
      </p>

      <div className="not-found-actions">
        <button
          type="button"
          className="not-found-btn-primary"
          onClick={() => onNavigate && onNavigate(ROUTES.LEADERBOARD)}
        >
          <span>← Back to Leaderboard</span>
        </button>

        <button
          type="button"
          className="not-found-btn-secondary"
          onClick={() => onNavigate && onNavigate(ROUTES.HOME)}
        >
          <span>Return to Homepage</span>
        </button>
      </div>

    </div>
  )
}
