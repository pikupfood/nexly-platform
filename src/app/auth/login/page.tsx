'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true); setError('')
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (authErr) { setError('Email ou mot de passe incorrect'); setLoading(false); return }

    // Check onboarding status
    const { data: tenant } = await supabase.from('tenants').select('onboarding_step').eq('user_id', data.user.id).single()
    if (!tenant || tenant.onboarding_step < 4) {
      router.push('/onboarding')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <main style={{ minHeight:'100vh', background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:'8px', marginBottom:'24px' }}>
            <div style={{ width:'32px', height:'32px', background:'#1a1a1a', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'700' }}>N</div>
            <span style={{ fontWeight:'600', fontSize:'16px' }}>Nexly Hub</span>
          </Link>
          <h1 style={{ fontSize:'24px', fontWeight:'700', margin:'0 0 8px', letterSpacing:'-0.02em' }}>Connexion</h1>
          <p style={{ color:'#6b6760', fontSize:'14px', margin:0 }}>Accédez à votre espace de gestion</p>
        </div>

        <div className="card" style={{ borderRadius:'16px', padding:'28px' }}>
          {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#dc2626', marginBottom:'16px' }}>{error}</div>}
          <div style={{ marginBottom:'12px' }}>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="jean@monhotel.com" />
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label className="label">Mot de passe</label>
            <input className="input" type="password" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width:'100%', padding:'12px', fontSize:'14px' }}>
            {loading ? 'Connexion...' : 'Se connecter →'}
          </button>
        </div>

        <p style={{ textAlign:'center', fontSize:'14px', color:'#6b6760', marginTop:'20px' }}>
          Pas encore de compte ? <Link href="/auth/register" style={{ color:'#1a1a1a', fontWeight:'500' }}>Créer un compte</Link>
        </p>
      </div>
    </main>
  )
}
