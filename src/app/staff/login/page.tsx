'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function StaffLoginForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const [email, setEmail] = useState(sp?.get('email') || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [success, setSuccess] = useState('')

  // Se già loggato come staff → redirect diretto
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: prof } = await supabase.rpc('get_staff_profile', { p_user_id: session.user.id })
      if (prof) router.replace('/staff/dashboard')
    })
  }, [])

  const submit = async () => {
    if (!email || !password) { setError('Email e password obbligatorie'); return }
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'register') {
      // Prima verifica che l'email sia nella lista staff
      // Questo viene controllato dal trigger link_staff_to_user al signup
      const { error: signupErr } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: { first_name: firstName, last_name: lastName }
        }
      })
      if (signupErr) {
        if (signupErr.message.includes('already registered')) {
          setError('Email già registrata. Usa "Connexion" per accedere.')
        } else {
          setError(signupErr.message)
        }
        setLoading(false)
        return
      }
      setSuccess('Account creato! Controlla la tua email per confermare, poi accedi.')
      setMode('login')
      setLoading(false)
      return
    }

    // LOGIN
    const { data: authData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    })
    if (loginErr) {
      setError('Email o password non corretti')
      setLoading(false)
      return
    }

    const userId = authData.user?.id
    if (!userId) { setError('Errore di autenticazione'); setLoading(false); return }

    // Controlla se è staff
    const { data: profile, error: profErr } = await supabase.rpc('get_staff_profile', { p_user_id: userId })

    if (!profile) {
      // Potrebbe essere il proprietario — mandalo alla dashboard normale
      const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', userId).single()
      if (tenant) {
        router.replace('/dashboard')
      } else {
        await supabase.auth.signOut()
        setError('Questo account non è autorizzato come staff. Contatta il tuo responsabile.')
      }
      setLoading(false)
      return
    }

    if (!profile.is_active) {
      await supabase.auth.signOut()
      setError('Il tuo account è stato disattivato. Contatta il tuo responsabile.')
      setLoading(false)
      return
    }

    // Aggiorna last_login
    await supabase.rpc('staff_login', { p_user_id: userId })
    router.replace('/staff/dashboard')
    setLoading(false)
  }

  const IS: any = {
    width: '100%', padding: '11px 14px',
    background: '#1f2030', border: '1px solid #2a2a3a',
    borderRadius: '8px', color: '#f1f1f1', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '22px', margin: '0 auto 12px' }}>N</div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f1f1', margin: '0 0 4px' }}>Nexly Hub</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Accès équipe</p>
        </div>

        <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '28px 24px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', marginBottom: '24px', background: '#0a0a0f', borderRadius: '8px', padding: '3px', gap: '3px' }}>
            {[
              { key: 'login', label: 'Connexion' },
              { key: 'register', label: 'Créer mon compte' },
            ].map(tab => (
              <button key={tab.key} onClick={() => { setMode(tab.key as any); setError(''); setSuccess('') }}
                style={{ flex: 1, padding: '7px', background: mode === tab.key ? '#1f2030' : 'transparent', border: 'none', borderRadius: '6px', color: mode === tab.key ? '#f1f1f1' : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: mode === tab.key ? '600' : '400' }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mode === 'register' && (
              <>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Prénom</div>
                  <input style={IS} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Marie" />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Nom</div>
                  <input style={IS} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" />
                </div>
              </>
            )}

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Email *</div>
              <input style={IS} type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="staff@hotel.com" onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Mot de passe * {mode === 'register' && <span style={{ color: '#4b5563' }}>(min. 6 caractères)</span>}</div>
              <input style={IS} type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>

            {error && (
              <div style={{ padding: '10px 12px', background: '#ef444420', border: '1px solid #ef444440', borderRadius: '8px', fontSize: '13px', color: '#f87171' }}>
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div style={{ padding: '10px 12px', background: '#10b98120', border: '1px solid #10b98140', borderRadius: '8px', fontSize: '13px', color: '#34d399' }}>
                ✅ {success}
              </div>
            )}

            <button onClick={submit} disabled={loading || !email || !password}
              style={{ padding: '12px', background: email && password && !loading ? '#3b82f6' : '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: email && password ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600', marginTop: '4px', transition: 'background 0.15s' }}>
              {loading ? 'Connexion...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>

            {mode === 'register' && (
              <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', padding: '8px 12px', background: '#1a2a3a', borderRadius: '8px', lineHeight: '1.5' }}>
                📧 Utilisez l'email avec lequel votre responsable vous a invité
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#4b5563' }}>
          Propriétaire ? <a href="/" style={{ color: '#60a5fa', textDecoration: 'none' }}>Connexion principale →</a>
        </div>
      </div>
    </div>
  )
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280' }}>Chargement...</div>
      </div>
    }>
      <StaffLoginForm />
    </Suspense>
  )
}
