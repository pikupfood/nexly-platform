'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, PLANS } from '@/lib/supabase'

export default function DashboardPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [modules, setModules] = useState<any[]>([])
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/auth/login'); return }
      Promise.all([
        supabase.from('tenants').select('*').eq('user_id', session.user.id).single(),
        supabase.from('tenant_modules').select('*').eq('tenant_id', (async () => {
          const { data } = await supabase.from('tenants').select('id').eq('user_id', session.user.id).single()
          return data?.id
        })()),
      ]).then(async ([tenantRes]) => {
        const t = tenantRes.data
        if (!t) { router.replace('/onboarding'); return }
        if (t.onboarding_step < 4) { router.replace('/onboarding'); return }
        setTenant(t)

        const [modRes, subRes] = await Promise.all([
          supabase.from('tenant_modules').select('*').eq('tenant_id', t.id),
          supabase.from('subscriptions').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false }).limit(1).single(),
        ])
        setModules(modRes.data || [])
        setSubscription(subRes.data)
        setLoading(false)
      })
    })
  }, [])

  const openPortal = async () => {
    if (!tenant) return
    setPortalLoading(true)
    const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: tenant.id }) })
    const { url } = await res.json()
    if (url) window.location.href = url
    setPortalLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fafaf9' }}>
      <div style={{ color:'#8a8680', fontSize:'14px' }}>Chargement...</div>
    </div>
  )

  const activeModules = modules.filter(m => m.is_active)
  const trialEnd = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null
  const isTrialing = tenant?.status === 'trial' || subscription?.status === 'trialing'
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0
  const isTrial = isTrialing && daysLeft > 0

  const MODULE_LINKS: Record<string, string> = {
    hotel: 'https://nexly-hub-2.vercel.app/dashboard/hotel',
    restaurant: 'https://nexly-hub-2.vercel.app/dashboard/ristorante',
    spa: 'https://nexly-hub-2.vercel.app/dashboard/spa',
    padel: 'https://nexly-hub-2.vercel.app/dashboard/padel',
  }

  return (
    <main style={{ minHeight:'100vh', background:'#fafaf9' }}>
      {/* Nav */}
      <nav style={{ background:'white', borderBottom:'1px solid #e8e6e1', padding:'0 32px', height:'56px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'26px', height:'26px', background:'#1a1a1a', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'12px', fontWeight:'700' }}>N</div>
          <span style={{ fontWeight:'600', fontSize:'15px' }}>Nexly Hub</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <Link href="/dashboard/settings" style={{ fontSize:'13px', color:'#6b6760' }}>⚙️ Paramètres</Link>
          <button onClick={handleLogout} style={{ fontSize:'13px', color:'#6b6760', background:'none', border:'none', cursor:'pointer' }}>Déconnexion</button>
        </div>
      </nav>

      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'40px 24px' }}>

        {/* Trial banner */}
        {isTrial && (
          <div className="anim" style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'10px', padding:'14px 18px', marginBottom:'24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <span style={{ fontSize:'14px', fontWeight:'500', color:'#c2410c' }}>⏳ Essai gratuit — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</span>
              <p style={{ margin:'4px 0 0', fontSize:'12px', color:'#9a3412' }}>Activez votre abonnement pour continuer après l'essai.</p>
            </div>
            <button className="btn btn-primary" onClick={openPortal} disabled={portalLoading} style={{ fontSize:'12px', padding:'8px 16px', background:'#ea580c', flexShrink:0 }}>
              {portalLoading ? '...' : 'Activer →'}
            </button>
          </div>
        )}

        {/* Welcome */}
        <div className="anim" style={{ marginBottom:'32px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', margin:'0 0 4px', letterSpacing:'-0.01em' }}>
            Bonjour {tenant?.business_name || tenant?.email} 👋
          </h1>
          <p style={{ color:'#6b6760', fontSize:'14px', margin:0 }}>
            Gérez vos modules et accédez à votre tableau de bord opérationnel.
          </p>
        </div>

        {/* Status card */}
        <div className="card anim-2" style={{ borderRadius:'14px', padding:'20px 24px', marginBottom:'24px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
          <div style={{ display:'flex', gap:'24px', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:'11px', fontWeight:'500', color:'#8a8680', marginBottom:'4px' }}>STATUT</div>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: tenant?.status === 'active' || isTrial ? '#059669' : tenant?.status === 'cancelled' ? '#dc2626' : '#f59e0b' }} />
                <span style={{ fontSize:'14px', fontWeight:'500' }}>
                  {isTrial ? `Essai (${daysLeft}j)` : tenant?.status === 'active' ? 'Actif' : tenant?.status === 'cancelled' ? 'Annulé' : tenant?.status || 'N/A'}
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize:'11px', fontWeight:'500', color:'#8a8680', marginBottom:'4px' }}>MODULES ACTIFS</div>
              <div style={{ fontSize:'14px', fontWeight:'500' }}>{activeModules.length} / 4</div>
            </div>
            {subscription && (
              <div>
                <div style={{ fontSize:'11px', fontWeight:'500', color:'#8a8680', marginBottom:'4px' }}>PROCHAINE FACTURATION</div>
                <div style={{ fontSize:'14px', fontWeight:'500' }}>
                  {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}
                </div>
              </div>
            )}
          </div>
          <button className="btn btn-secondary" onClick={openPortal} disabled={portalLoading} style={{ fontSize:'12px', padding:'8px 16px' }}>
            {portalLoading ? '...' : '💳 Gérer l\'abonnement'}
          </button>
        </div>

        {/* Active modules */}
        <div className="anim-3" style={{ marginBottom:'32px' }}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#8a8680', letterSpacing:'0.05em', marginBottom:'14px' }}>VOS MODULES</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:'12px' }}>
            {PLANS.filter(p => p.slug !== 'all').map(plan => {
              const isActive = activeModules.some(m => m.module === plan.slug || m.module === plan.slug.replace('restaurant','restaurant'))
              return (
                <div key={plan.slug} className="card" style={{ borderRadius:'12px', padding:'18px', opacity: isActive ? 1 : 0.5, position:'relative', border: isActive ? `1px solid ${plan.color}30` : '1px solid #e8e6e1' }}>
                  <div style={{ fontSize:'22px', marginBottom:'8px' }}>{plan.icon}</div>
                  <div style={{ fontWeight:'600', fontSize:'14px', marginBottom:'4px' }}>{plan.name}</div>
                  <div style={{ fontSize:'11px', color:'#8a8680', marginBottom:'12px' }}>{plan.desc}</div>
                  {isActive ? (
                    <a href={MODULE_LINKS[plan.slug]} target="_blank" rel="noopener" className="btn btn-primary" style={{ fontSize:'12px', padding:'7px 14px', display:'inline-flex', alignItems:'center', gap:'4px' }}>
                      Ouvrir → 
                    </a>
                  ) : (
                    <button onClick={openPortal} style={{ fontSize:'12px', color:'#8a8680', background:'none', border:'1px solid #e8e6e1', borderRadius:'6px', padding:'6px 12px', cursor:'pointer' }}>
                      + Activer
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Booking portal link */}
        <div className="card anim-4" style={{ borderRadius:'14px', background:'#1a1a1a', color:'white', padding:'24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
            <div>
              <div style={{ fontWeight:'600', fontSize:'15px', marginBottom:'6px' }}>🌐 Portail de réservations clients</div>
              <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.6)', marginBottom:'8px' }}>
                Partagez ce lien avec vos clients pour les réservations en ligne.
              </div>
              <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:'6px', padding:'8px 12px', fontSize:'12px', fontFamily:'monospace', color:'rgba(255,255,255,0.8)' }}>
                https://nexly-booking.vercel.app
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              <a href="https://nexly-booking.vercel.app" target="_blank" rel="noopener" className="btn" style={{ background:'white', color:'#1a1a1a', fontSize:'13px', padding:'9px 18px' }}>
                Voir le portail →
              </a>
              <button onClick={() => navigator.clipboard?.writeText('https://nexly-booking.vercel.app')} className="btn" style={{ background:'rgba(255,255,255,0.1)', color:'white', fontSize:'13px', padding:'9px 18px', border:'none' }}>
                📋 Copier
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
