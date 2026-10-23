import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import Leaderboard from './pages/Leaderboard'
import './styles/global.css'

function PagePlaceholder({ title, navigate }) {
  return (
    <div style={{padding:40}}>
      <button onClick={()=>navigate('/')} style={{marginBottom:16}}>← Back</button>
      <h2>{title}</h2>
      <p>This is a placeholder page for <strong>{title}</strong>.</p>
    </div>
  )
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname || '/')

  useEffect(()=>{
    const onPop = ()=> setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return ()=> window.removeEventListener('popstate', onPop)
  },[])

  function navigate(to){
    if(window.location.pathname !== to){
      window.history.pushState({},'',to)
      setPath(to)
      window.scrollTo({top:0,behavior:'smooth'})
    }
  }

  if(path === '/' || path === '/home'){
    return <Home navigate={navigate} />
  }

  if(path === '/login') return <Login navigate={navigate} />

  if(path === '/leaderboard') return <Leaderboard navigate={navigate} />
  if(path === '/dashboard') return <PagePlaceholder title="Dashboard" navigate={navigate} />
  if(path === '/contests') return <PagePlaceholder title="Contests" navigate={navigate} />
  if(path === '/rankings') return <PagePlaceholder title="CP Rankings" navigate={navigate} />

  return <PagePlaceholder title="Not Found" navigate={navigate} />
}
