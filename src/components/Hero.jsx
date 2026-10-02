/* Hero is a functional component using the automatic JSX runtime */
import Button from './Button'
import '../styles/hero.css'

export default function Hero({ onNavigate }) {
  return (
    <section className="hero-outer">
      <div className="hero-content">
        <h1 className="hero-heading">Dayananda Sagar university's
          <br />Competitive Programming
          <br /><span className="accent">leaderboard.</span>
        </h1>

        <p className="hero-desc">Track progress across Codeforces, LeetCode, AtCoder
          and CodeChef. Compete with peers. Rise through the
          ranks.</p>

        <div className="hero-ctas">
          <Button variant="primary" onClick={()=>onNavigate('/dashboard')}>Get Started →</Button>
          <Button variant="ghost" onClick={()=>onNavigate('/leaderboard')}>View Leaderboard</Button>
        </div>

        <div className="hero-stats">
          <div className="stat"><div className="stat-number">0</div><div className="stat-label">Users</div></div>
          <div className="stat"><div className="stat-number">0</div><div className="stat-label">Profiles</div></div>
          <div className="stat"><div className="stat-number">0</div><div className="stat-label">Solved</div></div>
        </div>
      </div>
    </section>
  )
}
