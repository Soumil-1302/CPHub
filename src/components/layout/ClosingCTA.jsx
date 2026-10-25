export default function ClosingCTA({ onNavigate }) {
  return (
    <>
      {/* Spacious Closing Section */}
      <section className="cphub-closing-section" aria-label="Closing Call to Action">
        <div className="cphub-container">
          <div className="closing-box">
            <div className="section-eyebrow" style={{ marginBottom: '20px' }}>
              <span>Join the Community</span>
            </div>

            <h2 className="closing-headline">
              Your next milestone <span className="italic-serif">starts here.</span>
            </h2>

            <p className="closing-desc">
              Track your progress, challenge yourself, and grow with your university&apos;s
              competitive-programming community.
            </p>

            <div className="closing-ctas">
              <button
                className="cphub-btn-hero-primary"
                onClick={() => onNavigate && onNavigate('/leaderboard')}
              >
                <span>Explore Leaderboard</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                className="cphub-btn-hero-secondary"
                onClick={() => onNavigate && onNavigate('/login')}
              >
                Sign In with University Email
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Understated Editorial Footer */}
      <footer className="cphub-footer" aria-label="Footer">
        <div className="cphub-container">
          <div className="footer-top">
            <div className="footer-brand-col">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div className="cphub-nav-logo-badge" aria-hidden="true">CP</div>
                <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>CPHub</span>
              </div>
              <p className="footer-brand-desc">
                The competitive programming network for Dayananda Sagar University.
                Empowering students to build problem-solving velocity across LeetCode &amp; Codeforces.
              </p>
            </div>

            <div className="footer-links-group">
              <div>
                <h4 className="footer-col-title">Navigation</h4>
                <div className="footer-col-links">
                  <button className="footer-link" onClick={() => onNavigate && onNavigate('/')}>Home</button>
                  <button className="footer-link" onClick={() => onNavigate && onNavigate('/leaderboard')}>Leaderboard</button>
                  <button className="footer-link" onClick={() => onNavigate && onNavigate('/contests')}>Contests</button>
                  <button className="footer-link" onClick={() => onNavigate && onNavigate('/dashboard')}>Dashboard</button>
                </div>
              </div>

              <div>
                <h4 className="footer-col-title">Platforms</h4>
                <div className="footer-col-links">
                  <button className="footer-link" onClick={() => onNavigate && onNavigate('/leaderboard')}>LeetCode Rankings</button>
                  <button className="footer-link" onClick={() => onNavigate && onNavigate('/leaderboard')}>Codeforces Standings</button>
                  <button className="footer-link" onClick={() => onNavigate && onNavigate('/rankings')}>Batch Analytics</button>
                </div>
              </div>

              <div>
                <h4 className="footer-col-title">Account</h4>
                <div className="footer-col-links">
                  <button className="footer-link" onClick={() => onNavigate && onNavigate('/login')}>University Sign In</button>
                  <button className="footer-link" onClick={() => onNavigate && onNavigate('/leaderboard')}>Browse Anonymous</button>
                </div>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <div>
              &copy; {new Date().getFullYear()} CPHub · Dayananda Sagar University CP Community.
            </div>
            <div>
              Built with precision for university problem solvers.
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
