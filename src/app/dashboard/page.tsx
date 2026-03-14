'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'

const MODULES = [
  { key:'hotel',       label:'Hôtel',         icon:'🏨', href:'/dashboard/hotel',       color:'#3b82f6' },
  { key:'restaurant',  label:'Restaurant',     icon:'🍽️', href:'/dashboard/ristorante',  color:'#10b981' },
  { key:'spa',         label:'Spa',            icon:'💆', href:'/dashboard/spa',          color:'#8b5cf6' },
  { key:'padel',       label:'Padel',          icon:'🎾', href:'/dashboard/padel',        color:'#f59e0b' },
  { key:'clients',     label:'Clients',        icon:'👥', href:'/dashboard/clienti',      color:'#ec4899' },
  { key:'invoices',    label:'Factures',       icon:'🧾', href:'/dashboard/fatture',      color:'#ef4444' },
  { key:'agenda',      label:'Agenda',         icon:'📆', href:'/dashboard/agenda',       color:'#f43f5e' },
  { key:'reports',     label:'Rapports',       icon:'📊', href:'/dashboard/report',       color:'#a855f7' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isNewTenant, setIsNewTenant] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)

      // Cerca o crea tenant
      let { data: t } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()

      if (!t) {
        const { data: newTenant } = await supabase.from('tenants').insert([{
          user_id: session.user.id,
          email: session.user.email,
          status: 'active',
          onboarding_step: 5,
        }]).select().single()
        t = newTenant
        setIsNewTenant(true)
      }

      setTenant(t)
      setLoading(false)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#6b7280', fontSize:'14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', fontFamily:'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom:'1px solid #1f2030', padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'32px', height:'32px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'700', fontSize:'16px' }}>N</div>
          <div>
            <div style={{ fontSize:'15px', fontWeight:'600', color:'#f1f1f1' }}>
              {tenant?.business_name || 'Nexly Hub'}
            </div>
            <div style={{ fontSize:'11px', color:'#6b7280' }}>{user?.email}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <Link href="/dashboard/settings" style={{ fontSize:'13px', color:'#6b7280', textDecoration:'none' }}>⚙️ Paramètres</Link>
          <button onClick={handleLogout} style={{ fontSize:'13px', color:'#6b7280', background:'none', border:'none', cursor:'pointer' }}>Déconnexion</button>
        </div>
      </div>

      <div style={{ padding:'32px', maxWidth:'1000px', margin:'0 auto' }}>

        {/* Banner nouveau tenant */}
        {isNewTenant && (
          <div style={{ background:'#1a2a3a', border:'1px solid #2a4a6a', borderRadius:'12px', padding:'20px 24px', marginBottom:'28px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'15px', fontWeight:'600', color:'#60a5fa', marginBottom:'4px' }}>👋 Bienvenue sur Nexly Hub !</div>
              <div style={{ fontSize:'13px', color:'#6b7280' }}>Commencez par configurer votre structure dans les paramètres.</div>
            </div>
            <Link href="/dashboard/settings" style={{ padding:'8px 18px', background:'#3b82f6', color:'white', borderRadius:'8px', fontSize:'13px', fontWeight:'500', textDecoration:'none' }}>
              Configurer →
            </Link>
          </div>
        )}

        {/* Bienvenue */}
        <div style={{ marginBottom:'32px' }}>
          <h1 style={{ fontSize:'20px', fontWeight:'600', color:'#f1f1f1', margin:'0 0 4px' }}>
            Bonjour{tenant?.business_name ? `, ${tenant.business_name}` : ''} 👋
          </h1>
          <p style={{ color:'#6b7280', fontSize:'14px', margin:0 }}>Gérez votre établissement depuis ce tableau de bord.</p>
        </div>

        {/* Modules grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'14px' }}>
          {MODULES.map(m => (
            <Link key={m.key} href={m.href} style={{ textDecoration:'none' }}>
              <div style={{
                background:'#111118',
                border:'1px solid #1f2030',
                borderRadius:'14px',
                padding:'24px 20px',
                cursor:'pointer',
                transition:'border-color 0.15s, transform 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2030'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ fontSize:'28px', marginBottom:'12px' }}>{m.icon}</div>
                <div style={{ fontWeight:'600', fontSize:'15px', color:'#f1f1f1', marginBottom:'4px' }}>{m.label}</div>
                <div style={{ fontSize:'12px', color: m.color, display:'flex', alignItems:'center', gap:'4px' }}>
                  Accéder →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info structure */}
        {tenant && (
          <div style={{ marginTop:'32px', background:'#111118', border:'1px solid #1f2030', borderRadius:'14px', padding:'20px 24px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#6b7280', marginBottom:'12px', letterSpacing:'0.05em' }}>VOTRE PORTAIL DE RÉSERVATION</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
              <div style={{ background:'#0a0a0f', border:'1px solid #2a2a3a', borderRadius:'8px', padding:'8px 14px', fontSize:'12px', fontFamily:'monospace', color:'#9ca3af', flex:1 }}>
                {tenant.booking_url || `https://nexly-booking.vercel.app/${tenant.slug || '...'}`}
              </div>
              <button onClick={() => navigator.clipboard?.writeText(tenant.booking_url || '')} style={{ padding:'8px 16px', background:'#1f2030', color:'#9ca3af', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', whiteSpace:'nowrap' as const }}>
                📋 Copier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
