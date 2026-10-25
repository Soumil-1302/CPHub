export default function HeroSection({ onNavigate }) {
  const handleScrollToSection = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="cphub-hero" aria-label="CPHub Hero">
      <div className="cphub-container">
        {/* Centered Main Stage */}
        <div className="cphub-hero-stage">
          {/* Eyebrow */}
          <div className="cphub-hero-eyebrow">
            <span>Meet Beyond your Circlr</span>
          </div>

          {/* Headline */}
          <h1 className="cphub-hero-headline">
            Compete <span className="serif-word">Improve</span> <span className="dot">·</span> Network
          </h1>

          {/* Supporting Text */}
          <p className="cphub-hero-supporting">
            One community for problem solvers. Track your progress, discover fellow coders,
            and climb your university&apos;s competitive-programming leaderboard.
          </p>

          {/* CTAs */}
          <div className="cphub-hero-ctas">
            <button
              className="cphub-btn-hero-primary"
              onClick={() => onNavigate && onNavigate('/leaderboard')}
            >
              <span>Explore Leaderboard</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="cphub-btn-hero-secondary"
              onClick={() => handleScrollToSection('snapshot')}
            >
              Discover CPHub
            </button>
          </div>
        </div>

        {/* Floating Cards Layer (Desktop) */}
        <div className="cphub-hero-floating-container" aria-hidden="true">
          {/* Card 1: Top-Left LeetCode Streak */}
          <div className="hero-float-card card-pos-top-left">
            <div className="float-card-header">
              <img
                src="/lc.jpeg"
                alt=""
                className="float-card-icon"
                width="22"
                height="22"
              />
              <span className="float-card-tag">LeetCode Daily</span>
            </div>
            <p className="float-card-text">Daily Streak Active 🔥</p>
            <span className="float-card-sub">@priya_algo · Rank #2</span>
          </div>

          {/* Card 2: Top-Right Dev Mindset Quote 1 */}
          <div className="hero-float-card card-pos-top-right">
            <p className="float-card-quote">
              &ldquo;Programming requires clear thinking, not fast fingers.&rdquo;
            </p>
            <span className="float-card-sub">— Campus Dev Mindset</span>
          </div>

          {/* Card 3: Mid-Left Codeforces Rating */}
          <div className="hero-float-card card-pos-mid-left">
            <div className="float-card-header">
              <img
                src="/cf.jpeg"
                alt=""
                className="float-card-icon"
                width="22"
                height="22"
              />
              <span className="float-card-tag">Codeforces</span>
            </div>
            <p className="float-card-text">Specialist 1420 ▲ +86</p>
            <span className="float-card-sub">@akhil_codes · Rank #1</span>
          </div>

          {/* Card 4: Mid-Right Humor Quote 2 */}
          <div className="hero-float-card card-pos-mid-right">
            <p className="float-card-quote">
              &ldquo;Let me be your CSS to your HTML.&rdquo;
            </p>

          </div>

          {/* Card 5: Bottom Floating Snippet */}
          <div className="hero-float-card card-pos-bottom-pill">
            <p className="float-card-quote">
              &ldquo;Behind every compiled code, there is a frustrated programmer.&rdquo;
            </p>
          </div>
        </div>

        {/* Mobile Horizontal Cards Strip (Reflow without collision) */}
        <div className="hero-mobile-cards-strip" aria-label="Community Highlights">
          <div className="hero-float-card" style={{ display: 'block', minWidth: '220px' }}>
            <div className="float-card-header">
              <img src="/lc.jpeg" alt="" className="float-card-icon" width="20" height="20" />
              <span className="float-card-tag">LeetCode</span>
            </div>
            <p className="float-card-text">43,000+ Solved</p>
            <span className="float-card-sub">Across campus batches</span>
          </div>

          <div className="hero-float-card" style={{ display: 'block', minWidth: '220px' }}>
            <div className="float-card-header">
              <img src="/cf.jpeg" alt="" className="float-card-icon" width="20" height="20" />
              <span className="float-card-tag">Codeforces</span>
            </div>
            <p className="float-card-text">38,600+ Questions</p>
            <span className="float-card-sub">Rated contest debriefs</span>
          </div>

          <div className="hero-float-card" style={{ display: 'block', minWidth: '240px' }}>
            <p className="float-card-quote">
              &ldquo;Programming requires clear thinking, not fast fingers.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
