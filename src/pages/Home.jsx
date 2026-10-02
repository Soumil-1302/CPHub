/* Home page uses automatic JSX runtime; no React import required */
import Navbar from '../components/Navbar'
import BackgroundEffects from '../components/BackgroundEffects'
import Hero from '../components/Hero'
import '../styles/home.css'

export default function Home({ navigate }) {
  return (
    <div className="home-page">
      <Navbar onNavigate={navigate} />
      <BackgroundEffects />
      <main className="home-main">
        <Hero onNavigate={navigate} />
      </main>
    </div>
  )
}
