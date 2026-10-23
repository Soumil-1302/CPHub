export default function ContestsCommunity({ onNavigate }) {
  const communityPillars = [
    {
      title: 'Weekly Virtual Contests',
      desc: 'Simulated 2-hour contests matching Div. 3 and Div. 2 difficulty. Practice speed and time management under pressure.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      action: 'View Contests',
      route: '/contests',
    },
    {
      title: 'Rating Milestones',
      desc: 'Celebrating peers breaking past 1400+ Specialist and 1600+ Expert. Peer guidance on transitioning between difficulty plateaus.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
          <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      ),
      action: 'Explore Standings',
      route: '/leaderboard',
    },
    {
      title: 'Editorial & Solution Sync',
      desc: 'Unpack tricky edge cases and explore multiple solutions for Dynamic Programming, segment trees, and binary search.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
      action: 'Join Discussion',
      route: '/dashboard',
    },
    {
      title: 'Department Cups',
      desc: 'Friendly cross-branch competitions across CST, CSE, AI&ML, CYBER, and core engineering batches.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      action: 'Check Branches',
      route: '/leaderboard',
    },
  ]

  const quotes = [
    'Let me be your CSS to your HTML.',
    'Behind every successfully compiled code, there is a frustrated programmer.',
    'Every programmer loves and hates coding at the same time.',
    'Programming requires clear thinking, not fast fingers.',
    'Am I testing my code or is it testing me?',
  ]

  return (
    <section id="community" className="cphub-community-section" aria-label="Contests and Community">
      <div className="cphub-container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 52px auto' }}>
          <div className="section-eyebrow">
            <span>Community Dynamics</span>
          </div>
          <h2 className="section-heading-editorial">
            A culture of shared debugging and <span className="italic-serif">friendly rivalry.</span>
          </h2>
          <p className="section-desc-editorial" style={{ margin: '0 auto' }}>
            From late-night contest debriefs to peer code reviews, here is how Dayananda Sagar
            engineers practice algorithms and build unstoppable momentum together.
          </p>
        </div>

        {/* 4 Feature Cards */}
        <div className="community-cards-row">
          {communityPillars.map((item) => (
            <div key={item.title} className="community-feature-card">
              <div>
                <div className="comm-icon-box">{item.icon}</div>
                <h3 className="comm-card-title">{item.title}</h3>
                <p className="comm-card-desc">{item.desc}</p>
              </div>

              <button
                className="platform-action-btn"
                style={{ marginTop: '24px' }}
                onClick={() => onNavigate && onNavigate(item.route)}
              >
                <span>{item.action}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quote Marquee Ribbon */}
      <div className="quotes-marquee-container" aria-label="Campus Dev Mindset Quotes">
        <div className="quotes-track">
          {/* First set */}
          {quotes.map((q, i) => (
            <div key={`q1-${i}`} className="quote-pill-card">
              <span className="quote-pill-dot" />
              <span>&ldquo;{q}&rdquo;</span>
            </div>
          ))}
          {/* Duplicate set for infinite seamless scroll */}
          {quotes.map((q, i) => (
            <div key={`q2-${i}`} className="quote-pill-card">
              <span className="quote-pill-dot" />
              <span>&ldquo;{q}&rdquo;</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
