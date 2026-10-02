import { useState } from 'react'
import BackgroundEffects from '../components/BackgroundEffects'
import '../styles/auth.css'
import { sendMagicLink } from '../api'

export default function Login(){
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  function validateEmail(e){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  async function handleSubmit(ev){
    ev && ev.preventDefault()
    setStatus(null)
    if(!validateEmail(email)){
      setStatus({ type:'error', message:'Please enter a valid university email.' })
      return
    }
    setLoading(true)
    const res = await sendMagicLink(email)
    setLoading(false)
    if(res.ok) setStatus({ type:'success', message:res.message })
    else setStatus({ type:'error', message:res.message })
  }

  return (
    <div className="auth-page">
      <BackgroundEffects />
      <div className="auth-card">
        <h3>Sign in to CPBoard</h3>
        <p className="muted">Use your university email</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="label">UNIVERSITY EMAIL</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@university.edu" aria-label="University email" />
          <button type="submit" className="primary" disabled={loading}>{loading? 'Sending…' : 'Send Magic Link →'}</button>
        </form>

        {status && (
          <div className={`auth-note ${status.type==='error'?'error':'success'}`}>{status.message}</div>
        )}

        <p className="small muted">We verify your university through your email domain. Only registered universities are accepted.</p>
      </div>
    </div>
  )
}
