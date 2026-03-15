'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email o password non corretti.')
      setLoading(false)
      return
    }

    if (data.session) {
      // Controlla se il tenant esiste, altrimenti crealo
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, onboarding_step')
        .eq('user_id', data.session.user.id)
        .single()

      if (!tenant) {
        // Crea tenant automaticamente al primo login
        await supabase.from('tenants').insert([{
          user_id: data.session.user.id,
          email: data.session.user.email,
          status: 'active',
          onboarding_step: 5,
        }])
      }

      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:'system-ui, sans-serif' }}>
      <div style={{ width:'100%', maxWidth:'380px' }}>
        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <div style={{ width:'56px', height:'56px', background:'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', fontWeight:'700', color:'white', margin:'0 auto 16px' }}>N</div>
          <h1 style={{ fontSize:'22px', fontWeight:'600', color:'#f1f1f1' }}>Nexly Hub</h1>
          <p style={{ fontSize:'14px', color:'#6b7280', marginTop:'4px' }}>Tableau de bord de gestion</p>
        </div>

        <div style={{ background:'#111118', border:'1px solid #1f2030', borderRadius:'16px', padding:'32px' }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontSize:'13px', color:'#9ca3af', marginBottom:'6px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="votre@email.com"
                style={{ width:'100%', padding:'10px 14px', background:'#0a0a0f', border:'1px solid #2a2a3a', borderRadius:'8px', color:'#f1f1f1', fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:'24px' }}>
              <label style={{ display:'block', fontSize:'13px', color:'#9ca3af', marginBottom:'6px' }}>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                style={{ width:'100%', padding:'10px 14px', background:'#0a0a0f', border:'1px solid #2a2a3a', borderRadius:'8px', color:'#f1f1f1', fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
            </div>
            {error && <div style={{ background:'#1a0a0a', border:'1px solid #5a1a1a', borderRadius:'8px', padding:'12px', fontSize:'13px', color:'#f87171', marginBottom:'16px' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width:'100%', padding:'12px', background: loading ? '#1e3a5f' : 'linear-gradient(135deg, #3b82f6, #2563eb)', border:'none', borderRadius:'8px', color:'white', fontSize:'14px', fontWeight:'600', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', fontSize:'12px', color:'#374151', marginTop:'16px' }}>
          Propulsé par <a href="https://nexlyhub.com" target="_blank" rel="noopener" style={{ color:'#6b7280' }}>Nexly Hub</a>
        </p>
      </div>
    </div>
  )
}
