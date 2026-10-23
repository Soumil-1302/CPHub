import { useState } from 'react'
import '../styles/navbar.css'

function Icon({ name, className = '' }) {
  const icons = {
    trophy: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}><path d="M8 3h8v4a4 4 0 0 1-4 4H8V3z"></path><path d="M3 7h2a7 7 0 0 0 14 0h2"></path></svg>),
    bolt: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>),
    calendar: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>),
    grid: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"></path></svg>),
    refresh: (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}><path d="M21 2v6h-6"></path><path d="M3 22v-6h6"></path><path d="M21 8A9 9 0 1 1 12 3"></path></svg>),
    help: (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}><path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3"></path><circle cx="12" cy="19" r="1"></circle></svg>),
  }
  return icons[name] || null
}

export default function Navbar({ onNavigate, currentPath = '/' }) {
  const [open] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  function handleNavigate(path) {
    onNavigate && onNavigate(path)
  }

  return (
    <header className="cpb-nav">
      <div className="cpb-nav__inner">
        <div className="cpb-nav__left">
          <div className="cpb-logo" onClick={() => handleNavigate('/')}>CPBoard</div>
        </div>

        <nav className={`cpb-nav__center ${open ? 'open' : ''}`}>
          <button className={`cpb-nav-link ${currentPath === '/leaderboard' ? 'active' : ''}`} onClick={() => handleNavigate('/leaderboard')}> <Icon name="trophy" /> <span>Leaderboard</span></button>
          <button className={`cpb-nav-link ${currentPath === '/rankings' ? 'active' : ''}`} onClick={() => handleNavigate('/rankings')}> <Icon name="bolt" /> <span>CP Rankings</span></button>
          <button className={`cpb-nav-link ${currentPath === '/contests' ? 'active' : ''}`} onClick={() => handleNavigate('/contests')}> <Icon name="calendar" /> <span>Contests</span></button>
          <button className={`cpb-nav-link ${currentPath === '/dashboard' ? 'active' : ''}`} onClick={() => handleNavigate('/dashboard')}> <Icon name="grid" /> <span>Dashboard</span></button>
        </nav>

        <div className="cpb-nav__right">
          <button className="icon-btn" title="Refresh" onClick={(e)=>{e.currentTarget.classList.add('spin'); setTimeout(()=>e.currentTarget.classList.remove('spin'),700)}} aria-label="Refresh"><Icon name="refresh" /></button>
          <button className="icon-btn" title="Help" aria-label="Help"> <Icon name="help" /> <span className="help-tip">Need help?</span></button>

          <button className="signin-btn" onClick={()=>handleNavigate('/login')}>Sign In</button>

          <div className="profile" onMouseLeave={()=>setProfileOpen(false)}>
            <button className="profile-btn" onClick={()=>setProfileOpen(s=>!s)} aria-haspopup="true">
              <div className="avatar">H</div>
              <div className="username">honezz</div>
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <button>Profile</button>
                <button>Settings</button>
                <button>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
