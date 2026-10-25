import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import MagicCursor from './components/cursor/MagicCursor'
import CursorController from './components/cursor/CursorController'
import { ROUTES } from './constants/routes'
import './styles/global.css'
import './styles/cursor.css'

function PagePlaceholder({ title, navigate }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <button
        onClick={() => navigate(ROUTES.HOME)}
        style={{
          marginBottom: 16,
          background: 'none',
          border: '1px solid rgba(0,0,0,0.1)',
          padding: '8px 16px',
          borderRadius: '9999px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        ← Back to Homepage
      </button>
      <h2 style={{ fontSize: '28px', margin: '0 0 8px 0' }}>{title}</h2>
      <p style={{ color: '#71717a', maxWidth: '400px' }}>
        This module is currently in development for the next CPHub semester release.
      </p>
    </div>
  )
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname || ROUTES.HOME)
  const [cursorActive, setCursorActive] = useState(true)
  const [cursorColor, setCursorColor] = useState('#10a09cff')
  const [enableGlow, setEnableGlow] = useState(true)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function navigate(to) {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to)
      setPath(to)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  let content
  if (path === ROUTES.HOME || path === ROUTES.HOME_ALIAS) {
    content = <Home navigate={navigate} />
  } else if (path === ROUTES.LOGIN || path === ROUTES.SIGNIN) {
    content = <Login navigate={navigate} />
  } else if (path === ROUTES.LEADERBOARD) {
    content = <Leaderboard navigate={navigate} />
  } else if (path.startsWith(ROUTES.PROFILE_BASE + '/') || path === ROUTES.PROFILE_BASE) {
    const rawUsername = path.startsWith(ROUTES.PROFILE_BASE + '/')
      ? path.slice((ROUTES.PROFILE_BASE + '/').length)
      : ''
    const username = decodeURIComponent(rawUsername).replace(/^\/+|\/+$/g, '')
    content = <Profile username={username} navigate={navigate} />
  } else if (path === ROUTES.DASHBOARD) {
    content = <PagePlaceholder title="Dashboard" navigate={navigate} />
  } else if (path === ROUTES.CONTESTS) {
    content = <PagePlaceholder title="Contests" navigate={navigate} />
  } else if (path === ROUTES.RANKINGS) {
    content = <PagePlaceholder title="CP Rankings" navigate={navigate} />
  } else {
    content = <PagePlaceholder title="Page Not Found" navigate={navigate} />
  }

  return (
    <>
      <MagicCursor
        active={cursorActive}
        label={false}
        cursorSize={32}
        fillColor={cursorColor}
        enableStretch={true}
        enableGlow={enableGlow}
        glowColor={cursorColor}
        glowIntensity={50}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 999999,
        }}
      />

      <CursorController
        active={cursorActive}
        onToggle={() => setCursorActive((prev) => !prev)}
        color={cursorColor}
        onChangeColor={setCursorColor}
        glow={enableGlow}
        onToggleGlow={() => setEnableGlow((prev) => !prev)}
      />

      {content}
    </>
  )
}
