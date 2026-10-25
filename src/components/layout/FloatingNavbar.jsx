import { useState } from 'react'

export default function FloatingNavbar({ onNavigate, currentPath = '/' }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLinkClick = (path) => {
    setMobileMenuOpen(false)
    if (path.startsWith('#')) {
      const el = document.querySelector(path)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
      return
    }
    if (onNavigate) {
      onNavigate(path)
    }
  }

  return (
    <div className="cphub-floating-nav-wrapper">
      <header className="cphub-floating-nav" aria-label="Main Navigation">
        {/* Brand */}
        <button
          className="cphub-nav-brand"
          onClick={() => handleLinkClick('/')}
          aria-label="CPHub Home"
        >
          <div className="cphub-nav-logo-badge" aria-hidden="true">CP</div>
          <div>
            <span className="cphub-nav-brand-text">CPHub</span>
            <span className="cphub-nav-brand-sub">DSU</span>
          </div>
        </button>

        {/* Desktop Links */}
        <nav className="cphub-nav-links" aria-label="Primary Links">
          <button
            className={`cphub-pill-link ${currentPath === '/' || currentPath === '/home' ? 'active' : ''}`}
            onClick={() => handleLinkClick('/')}
          >
            Home
          </button>
          <button
            className={`cphub-pill-link ${currentPath === '/leaderboard' ? 'active' : ''}`}
            onClick={() => handleLinkClick('/leaderboard')}
          >
            Leaderboard
          </button>
          <button
            className={`cphub-pill-link ${currentPath === '/contests' ? 'active' : ''}`}
            onClick={() => handleLinkClick('/contests')}
          >
            Contests
          </button>
          <button
            className="cphub-pill-link"
            onClick={() => handleLinkClick('#community')}
          >
            Community
          </button>
        </nav>

        {/* Actions */}
        <div className="cphub-nav-actions">
          <button
            className="cphub-btn-pill-ghost"
            onClick={() => handleLinkClick('/login')}
          >
            Sign In
          </button>
          <button
            className="cphub-btn-pill-primary"
            onClick={() => handleLinkClick('/leaderboard')}
          >
            <span>Explore Leaderboard</span>
            <span aria-hidden="true">→</span>
          </button>

          {/* Mobile Hamburger */}
          <button
            className="cphub-mobile-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <nav className="cphub-mobile-drawer" aria-label="Mobile Navigation">
            <button
              className={`cphub-pill-link ${currentPath === '/' ? 'active' : ''}`}
              onClick={() => handleLinkClick('/')}
            >
              Home
            </button>
            <button
              className={`cphub-pill-link ${currentPath === '/leaderboard' ? 'active' : ''}`}
              onClick={() => handleLinkClick('/leaderboard')}
            >
              Leaderboard
            </button>
            <button
              className={`cphub-pill-link ${currentPath === '/contests' ? 'active' : ''}`}
              onClick={() => handleLinkClick('/contests')}
            >
              Contests
            </button>
            <button
              className="cphub-pill-link"
              onClick={() => handleLinkClick('#community')}
            >
              Community
            </button>
            <button
              className="cphub-pill-link"
              onClick={() => handleLinkClick('/login')}
            >
              Sign In
            </button>
          </nav>
        )}
      </header>
    </div>
  )
}
