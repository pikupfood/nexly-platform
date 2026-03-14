'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, PLANS } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────
type BillingCycle = 'monthly' | 'yearly'

const MODULE_DETAILS: Record<string, { icon: string; color: string; desc: string }> = {
  hotel:      { icon: '🏨', color: '#4a7fa5', desc: 'Chambres, réservations, check-in/out' },
  restaurant: { icon: '🍽️', color: '#4a9070', desc: 'Tables, menu, ordres, réservations' },
  spa:        { icon: '💆', color: '#7a6fa5', desc: 'Soins, piscine, jacuzzi, agenda' },
  padel:      { icon: '🎾', color: '#a07a30', desc: 'Terrains, créneaux, réservations' },
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showAddModule, setShowAddModule] = useState(false)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [selectedNewModules, setSelectedNewModules] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/auth/login'); return }
      const [tenantRes, subRes, modRes] = await Promise.all([
        supabase.from('tenants').select('*').eq('user_id', session.user.id).single(),
        supabase.from('subscriptions').select('*').eq('tenant_id',
          (await supabase.from('tenants').select('id').eq('user_id', session.user.id).single()).data?.id
        ).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('tenant_modules').select('module').eq('is_active', true).eq('tenant_id',
          (await supabase.from('tenants').select('id').eq('user_id', session.user.id).single()).data?.id
        ),
      ])
      setTenant(tenantRes.data)
      setSubscription(subRes.data)
      setActiveModules(modRes.data?.map((m: any) => m.module) || [])
      if (subRes.data?.billing_cycle) setBillingCycle(subRes.data.billing_cycle)
      setLoading(false)
    })
  }, [])

  // Apre il Stripe Billing Portal
  const openPortal = async (action?: string) => {
    if (!tenant) return
    setActionLoading(action || 'portal')
    const res = await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, returnUrl: `${window.location.origin}/dashboard/settings?tab=subscription` }),
    })
    const { url, error } = await res.json()
    if (url) window.location.href = url
    else { alert(`Erreur: ${error || 'Impossible d\'accéder au portail'}`); setActionLoading(null) }
  }

  // Checkout per aggiungere moduli
  const checkoutNewModules = async () => {
    if (!tenant || selectedNewModules.length === 0) return
    setActionLoading('add_modules')

    // Se stanno prendendo tutti i moduli → All Inclusive
    const allMods = [...activeModules, ...selectedNewModules]
    const isAll = ['hotel','restaurant','spa','padel'].every(m => allMods.includes(m))
    const planSlug = isAll ? 'all' : selectedNewModules[0]
    const plan = PLANS.find(p => p.slug === planSlug)
    if (!plan) { setActionLoading(null); return }

    const priceId = billingCycle === 'monthly' ? plan.stripe_monthly : plan.stripe_yearly
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        tenantId: tenant.id,
        modules: allMods,
        billingCycle,
        mode: 'add_module',
      }),
    })
    const { url, error } = await res.json()
    if (url) window.location.href = url
    else { alert(`Erreur: ${error || 'Impossible de créer la session'}`); setActionLoading(null) }
  }

  // Checkout per cambiare piano (mensile ↔ annuale)
  const switchBillingCycle = async (newCycle: BillingCycle) => {
    if (!tenant) return
    setActionLoading('switch_cycle')

    // Determina piano attuale
    const isAll = ['hotel','restaurant','spa','padel'].every(m => activeModules.includes(m))
    const planSlug = isAll ? 'all' : activeModules[0] || 'hotel'
    const plan = PLANS.find(p => p.slug === planSlug)
    if (!plan) { setActionLoading(null); return }

    const priceId = newCycle === 'monthly' ? plan.stripe_monthly : plan.stripe_yearly
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, tenantId: tenant.id, modules: activeModules, billingCycle: newCycle }),
    })
    const { url, error } = await res.json()
    if (url) window.location.href = url
    else { alert(`Erreur: ${error}`); setActionLoading(null) }
  }

  const availableToAdd = ['hotel','restaurant','spa','padel'].filter(m => !activeModules.includes(m))
  const isAllInclusive = ['hotel','restaurant','spa','padel'].every(m => activeModules.includes(m))

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#8a8680', fontSize:'14px' }}>Chargement...</div>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', background:'#fafaf9' }}>
      <nav style={{ background:'white', borderBottom:'1px solid #e8e6e1', padding:'0 32px', height:'56px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:50 }}>
        <Link href="/dashboard/settings" style={{ fontSize:'13px', color:'#6b6760', textDecoration:'none' }}>← Paramètres</Link>
        <span style={{ color:'#d8d5d0' }}>|</span>
        <span style={{ fontWeight:'600', fontSize:'15px', color:'#1a1a1a' }}>💳 Gestion de l'abonnement</span>
      </nav>

      <div style={{ maxWidth:'760px', margin:'0 auto', padding:'40px 24px 80px' }}>

        {/* Statut actuel */}
        <div className="card anim" style={{ borderRadius:'16px', marginBottom:'20px', padding:'24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px', marginBottom:'20px' }}>
            <div>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'#8a8680', letterSpacing:'0.05em', marginBottom:'6px' }}>ABONNEMENT ACTUEL</div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: subscription?.status === 'active' || subscription?.status === 'trialing' ? '#059669' : '#f59e0b' }} />
                <span style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a1a' }}>
                  {subscription?.status === 'trialing' ? '🎁 Période d\'essai' :
                   subscription?.status === 'active' ? '✅ Actif' :
                   subscription?.status === 'past_due' ? '⚠️ Paiement en retard' :
                   subscription?.status === 'canceled' ? '❌ Annulé' :
                   tenant?.status === 'trial' ? '🎁 Essai gratuit' : '— Sans abonnement'}
                </span>
              </div>
              {subscription?.current_period_end && (
                <div style={{ fontSize:'12px', color:'#8a8680', marginTop:'4px' }}>
                  {subscription.cancel_at_period_end ? '⚠️ Se termine le ' : 'Prochain renouvellement : '}
                  {new Date(subscription.current_period_end).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}
                </div>
              )}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'13px', color:'#8a8680', marginBottom:'4px' }}>Facturation</div>
              <div style={{ display:'flex', gap:'6px' }}>
                <span style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'600', background: subscription?.billing_cycle === 'monthly' || !subscription ? '#f5f5f3' : 'transparent', color:'#1a1a1a' }}>Mensuel</span>
                <span style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'600', background: subscription?.billing_cycle === 'yearly' ? '#f0fdf4' : 'transparent', color: subscription?.billing_cycle === 'yearly' ? '#059669' : '#9a9690' }}>
                  Annuel {subscription?.billing_cycle === 'yearly' && '(−20%)'}
                </span>
              </div>
            </div>
          </div>

          {/* Modules actifs */}
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#8a8680', marginBottom:'10px' }}>MODULES ACTIFS</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'8px', marginBottom:'20px' }}>
            {activeModules.length === 0 && (
              <div style={{ color:'#9a9690', fontSize:'13px', gridColumn:'1/-1' }}>Aucun module actif</div>
            )}
            {activeModules.map(mod => {
              const cfg = MODULE_DETAILS[mod]
              if (!cfg) return null
              return (
                <div key={mod} style={{ padding:'12px 14px', borderRadius:'10px', background:'#f5f5f3', border:`1px solid ${cfg.color}30`, display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'18px' }}>{cfg.icon}</span>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'600', color:'#1a1a1a', textTransform:'capitalize' }}>{mod === 'restaurant' ? 'Restaurant' : mod.charAt(0).toUpperCase() + mod.slice(1)}</div>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#059669', marginTop:'2px' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions rapides */}
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            <button onClick={() => openPortal('portal')} disabled={!!actionLoading} className="btn btn-secondary" style={{ fontSize:'13px' }}>
              {actionLoading === 'portal' ? 'Ouverture...' : '💳 Portail de facturation Stripe'}
            </button>
          </div>
        </div>

        {/* Changer cycle mensuel ↔ annuel */}
        <div className="card anim-2" style={{ borderRadius:'16px', marginBottom:'20px', padding:'24px' }}>
          <div style={{ fontWeight:'600', fontSize:'15px', marginBottom:'6px' }}>🔄 Changer la fréquence de facturation</div>
          <p style={{ fontSize:'13px', color:'#6b6760', margin:'0 0 18px' }}>
            Passez en facturation annuelle et économisez <strong style={{ color:'#059669' }}>20%</strong> par rapport au tarif mensuel.
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            {/* Mensuel */}
            <div style={{ padding:'16px', borderRadius:'12px', border:`2px solid ${subscription?.billing_cycle !== 'yearly' ? '#1a1a1a' : '#e8e6e1'}`, background: subscription?.billing_cycle !== 'yearly' ? '#f5f5f3' : 'white' }}>
              <div style={{ fontWeight:'600', fontSize:'14px', marginBottom:'4px' }}>📅 Mensuel</div>
              <div style={{ fontSize:'13px', color:'#6b6760' }}>Flexibilité maximale, sans engagement</div>
              {subscription?.billing_cycle !== 'yearly' && <div style={{ fontSize:'11px', color:'#059669', marginTop:'6px', fontWeight:'600' }}>✓ Plan actuel</div>}
            </div>
            {/* Annuel */}
            <div style={{ padding:'16px', borderRadius:'12px', border:`2px solid ${subscription?.billing_cycle === 'yearly' ? '#059669' : '#e8e6e1'}`, background: subscription?.billing_cycle === 'yearly' ? '#f0fdf4' : 'white' }}>
              <div style={{ fontWeight:'600', fontSize:'14px', marginBottom:'4px' }}>📆 Annuel <span style={{ background:'#f0fdf4', color:'#059669', fontSize:'11px', padding:'2px 6px', borderRadius:'10px', fontWeight:'600' }}>−20%</span></div>
              <div style={{ fontSize:'13px', color:'#6b6760' }}>Facturé une fois par an, meilleure économie</div>
              {subscription?.billing_cycle === 'yearly' && <div style={{ fontSize:'11px', color:'#059669', marginTop:'6px', fontWeight:'600' }}>✓ Plan actuel</div>}
            </div>
          </div>

          {subscription?.billing_cycle !== 'yearly' ? (
            <button onClick={() => switchBillingCycle('yearly')} disabled={!!actionLoading} className="btn btn-primary" style={{ fontSize:'13px' }}>
              {actionLoading === 'switch_cycle' ? 'Redirection...' : '📆 Passer en facturation annuelle (−20%) →'}
            </button>
          ) : (
            <button onClick={() => openPortal('switch_monthly')} disabled={!!actionLoading} className="btn btn-secondary" style={{ fontSize:'13px' }}>
              {actionLoading === 'switch_monthly' ? 'Ouverture...' : '📅 Passer en facturation mensuelle'}
            </button>
          )}
        </div>

        {/* Ajouter des modules */}
        {!isAllInclusive && availableToAdd.length > 0 && (
          <div className="card anim-3" style={{ borderRadius:'16px', marginBottom:'20px', padding:'24px' }}>
            <div style={{ fontWeight:'600', fontSize:'15px', marginBottom:'6px' }}>➕ Ajouter des modules</div>
            <p style={{ fontSize:'13px', color:'#6b6760', margin:'0 0 18px' }}>
              Activez de nouveaux services pour votre établissement.
            </p>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'10px', marginBottom:'18px' }}>
              {availableToAdd.map(mod => {
                const cfg = MODULE_DETAILS[mod]
                const plan = PLANS.find(p => p.slug === mod)
                const sel = selectedNewModules.includes(mod)
                return (
                  <div key={mod} onClick={() => setSelectedNewModules(prev => sel ? prev.filter(m=>m!==mod) : [...prev, mod])}
                    style={{ padding:'14px', borderRadius:'10px', cursor:'pointer', border:`1.5px solid ${sel ? cfg.color : '#e8e6e1'}`, background: sel ? cfg.color + '10' : 'white', transition:'all 0.15s' }}>
                    <span style={{ fontSize:'22px' }}>{cfg.icon}</span>
                    <div style={{ fontWeight:'600', fontSize:'13px', marginTop:'6px', marginBottom:'2px' }}>{mod === 'restaurant' ? 'Restaurant' : mod.charAt(0).toUpperCase() + mod.slice(1)}</div>
                    <div style={{ fontSize:'11px', color:'#8a8680' }}>
                      à partir de €{plan?.price_monthly}/mois
                    </div>
                    <div style={{ width:'18px', height:'18px', borderRadius:'4px', border:`2px solid ${sel ? cfg.color : '#d8d5d0'}`, background: sel ? cfg.color : 'white', display:'flex', alignItems:'center', justifyContent:'center', marginTop:'8px', fontSize:'11px', color:'white' }}>
                      {sel && '✓'}
                    </div>
                  </div>
                )
              })}
            </div>

            {selectedNewModules.length > 0 && (
              <>
                {/* Cycle de facturation pour les nouveaux modules */}
                <div style={{ background:'#f5f5f3', borderRadius:'10px', padding:'14px', marginBottom:'14px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'600', color:'#8a8680', marginBottom:'8px' }}>FACTURATION POUR LES NOUVEAUX MODULES</div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {(['monthly','yearly'] as const).map(c => (
                      <button key={c} onClick={() => setBillingCycle(c)} style={{ padding:'8px 16px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500', background: billingCycle===c ? '#1a1a1a' : '#fff', color: billingCycle===c ? 'white' : '#6b6760', boxShadow: billingCycle===c ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                        {c === 'monthly' ? 'Mensuel' : 'Annuel −20%'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Récap prix */}
                <div style={{ background:'#1a1a1a', borderRadius:'10px', padding:'14px 18px', marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'white' }}>
                  <div style={{ fontSize:'13px' }}>
                    {selectedNewModules.map(m => MODULE_DETAILS[m]?.icon).join(' ')} {selectedNewModules.length} nouveau{selectedNewModules.length > 1 ? 'x' : ''} module{selectedNewModules.length > 1 ? 's' : ''}
                  </div>
                  <div>
                    <span style={{ fontSize:'20px', fontWeight:'700' }}>
                      €{selectedNewModules.reduce((s,m) => {
                        const plan = PLANS.find(p => p.slug === m)
                        return s + (billingCycle === 'monthly' ? (plan?.price_monthly || 0) : Math.round((plan?.price_yearly || 0)/12))
                      }, 0)}
                    </span>
                    <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.6)', marginLeft:'4px' }}>/mois</span>
                  </div>
                </div>

                <button onClick={checkoutNewModules} disabled={!!actionLoading} className="btn btn-primary" style={{ fontSize:'13px' }}>
                  {actionLoading === 'add_modules' ? 'Redirection...' : `➕ Activer ${selectedNewModules.length} module${selectedNewModules.length > 1 ? 's' : ''} →`}
                </button>
              </>
            )}
          </div>
        )}

        {/* Passer en All Inclusive */}
        {!isAllInclusive && (
          <div className="card anim-4" style={{ borderRadius:'16px', marginBottom:'20px', padding:'24px', border:'1px solid #c9a030', background:'#fffbf0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <div style={{ fontWeight:'600', fontSize:'15px', marginBottom:'4px' }}>⭐ All Inclusive — tous les modules</div>
                <div style={{ fontSize:'13px', color:'#6b6760' }}>Hôtel + Restaurant + Spa + Padel à un prix réduit</div>
                <div style={{ fontSize:'13px', fontWeight:'600', color:'#a07a30', marginTop:'6px' }}>
                  €129/mois · ou €103/mois en annuel (€1238/an)
                </div>
              </div>
              <button onClick={() => {
                setSelectedNewModules(availableToAdd)
                const plan = PLANS.find(p => p.slug === 'all')!
                const priceId = billingCycle === 'monthly' ? plan.stripe_monthly : plan.stripe_yearly
                setActionLoading('all_inclusive')
                fetch('/api/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ priceId, tenantId: tenant?.id, modules: ['hotel','restaurant','spa','padel'], billingCycle }),
                }).then(r => r.json()).then(({ url, error }) => {
                  if (url) window.location.href = url
                  else { alert(error); setActionLoading(null) }
                })
              }} disabled={!!actionLoading} className="btn" style={{ background:'#a07a30', color:'white', fontSize:'13px', padding:'10px 20px', border:'none' }}>
                {actionLoading === 'all_inclusive' ? 'Redirection...' : '⭐ Passer en All Inclusive →'}
              </button>
            </div>
          </div>
        )}

        {/* Annuler / Gérer */}
        <div className="card anim-5" style={{ borderRadius:'16px', padding:'24px', border:'1px solid #fecaca', background:'#fef2f2' }}>
          <div style={{ fontWeight:'600', fontSize:'15px', color:'#dc2626', marginBottom:'8px' }}>⚠️ Annuler l'abonnement</div>
          <p style={{ fontSize:'13px', color:'#9a3412', margin:'0 0 16px', lineHeight:1.6 }}>
            L'annulation prend effet à la fin de la période en cours. Vous continuez à avoir accès jusqu'à cette date.
            Pour annuler, utilisez le portail Stripe sécurisé ci-dessous.
          </p>
          <button onClick={() => openPortal('cancel')} disabled={!!actionLoading} className="btn" style={{ background:'#fee2e2', color:'#dc2626', fontSize:'13px', padding:'10px 20px', border:'1px solid #fecaca', borderRadius:'8px', cursor:'pointer' }}>
            {actionLoading === 'cancel' ? 'Ouverture...' : '🚪 Gérer / Annuler via Stripe →'}
          </button>
        </div>

      </div>
    </main>
  )
}
