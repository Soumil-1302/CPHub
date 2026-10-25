export async function sendMagicLink(email){
  // Preserve backend endpoint expectations. If your backend uses a different
  // path, update this function only. Returns { ok, message }
  try{
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    if(!res.ok){
      const err = await res.json().catch(()=>({message:'Request failed'}))
      return { ok:false, message: err.message || 'Failed to send' }
    }
    const data = await res.json().catch(()=>({message:'Link sent'}))
    return { ok:true, message: data.message || 'Magic link sent' }
  }catch(e){
    return { ok:false, message: e.message || 'Network error' }
  }
}
