/* Background effects are purely presentational; no React default import needed */
import '../styles/background.css'

export default function BackgroundEffects() {
  return (
    <div className="bg-effects" aria-hidden>
      <div className="bg-shape shape-1" />
      <div className="bg-shape shape-2" />
      <div className="bg-shape shape-3" />
      <div className="bg-overlay" />
    </div>
  )
}
