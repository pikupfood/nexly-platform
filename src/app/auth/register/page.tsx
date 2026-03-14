'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planSlug = searchParams.get('plan') || ''

  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.email || !form.password || !form.first_name) { setError('Remplissez tous les champs obligatoires'); return }
    if (form.password.length < 8) { setError('Mot de passe trop court (min. 8 caractères)'); return }
    setLoading(true); setError('')

    const { data, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { first_name: form.first_name, last_name: form.last_name } }
    })

    if (authErr) { setError(authErr.message); setLoading(false); return }

    // Crea tenant
    if (data.user) {
      await supabase.from('tenants').insert([{
        user_id: data.user.id,
        email: form.email,
        onboarding_step: 1,
        status: 'trial',
      }])
    }

    router.push(`/onboarding${planSlug ? `?plan=${planSlug}` : ''}`)
  }

  return (
    <main style={{ minHeight:'100vh', background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'440px' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:'8px', marginBottom:'24px' }}>
            <div style={{ width:'32px', height:'32px', background:'#1a1a1a', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'700' }}>N</div>
            <span style={{ fontWeight:'600', fontSize:'16px' }}>Nexly Hub</span>
          </Link>
          <h1 style={{ fontSize:'24px', fontWeight:'700', margin:'0 0 8px', letterSpacing:'-0.02em' }}>Créez votre compte</h1>
          <p style={{ color:'#6b6760', fontSize:'14px', margin:0 }}>14 jours gratuits · Sans carte bancaire</p>
        </div>

        <div className="card" style={{ borderRadius:'16px', padding:'28px' }}>
          {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#dc2626', marginBottom:'16px' }}>{error}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <div>
              <label className="label">Prénom *</label>
              <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Jean" />
            </div>
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Dupont" />
            </div>
          </div>
          <div style={{ marginBottom:'12px' }}>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jean@monhotel.com" />
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label className="label">Mot de passe * (min. 8 caractères)</label>
            <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
          </div>

          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width:'100%', padding:'12px', fontSize:'14px' }}>
            {loading ? 'Création du compte...' : 'Créer mon compte gratuit →'}
          </button>

          <p style={{ textAlign:'center', fontSize:'12px', color:'#9a9690', marginTop:'16px', marginBottom:0 }}>
            En vous inscrivant, vous acceptez nos <a href="#" style={{ color:'#6b6760', textDecoration:'underline' }}>CGU</a>
          </p>
        </div>

        <p style={{ textAlign:'center', fontSize:'14px', color:'#6b6760', marginTop:'20px' }}>
          Déjà un compte ? <Link href="/auth/login" style={{ color:'#1a1a1a', fontWeight:'500' }}>Se connecter</Link>
        </p>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>
}
