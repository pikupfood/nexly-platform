'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, PLANS } from '@/lib/supabase'

const MOD_CFG: Record<string, { icon: string; color: string; name: string }> = {
  hotel:      { icon: '🏨', color: '#4a7fa5', name: 'Hôtel' },
  restaurant: { icon: '🍽️', color: '#4a9070', name: 'Restaurant' },
  spa:        { icon: '💆', color: '#7a6fa5', name: 'Spa & Wellness' },
  padel:      { icon: '🎾', color: '#a07a30', name: 'Padel' },
}

function SubscriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tenant, setTenant] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [pendingModules, setPendingModules] = useState<string[]>([]) // moduli da aggiungere/rimuovere
  const [hasChanges, setHasChanges] = useState(false)
  const successMsg = searchParams.get('success')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/auth/login'); return }

      const { data: t } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      if (!t) { router.replace('/dashboard'); return }
      setTenant(t)

      const [subRes, modRes] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('tenant_modules').select('module').eq('tenant_id', t.id).eq('is_active', true),
      ])
      setSubscription(subRes.data)
      const mods = modRes.data?.map((m: any) => m.module) || []
      setActiveModules(mods)
      setPendingModules([...mods]) // copia iniziale
      if (subRes.data?.billing_cycle) setBillingCycle(subRes.data.billing_cycle)
      setLoading(false)
    })
  }, [])

  // Traccia modifiche ai moduli
  useEffect(() => {
    if (activeModules.length === 0 && pendingModules.length === 0) return
    const added = pendingModules.filter(m => !activeModules.includes(m))
    const removed = activeModules.filter(m => !pendingModules.includes(m))
    setHasChanges(added.length > 0 || removed.length > 0)
  }, [pendingModules, activeModules])

  const toggleModule = (mod: string) => {
    setPendingModules(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    )
  }

  // Apre Stripe Billing Portal (con auto-creazione customer)
  const openPortal = async (returnPath?: string) => {
    if (!tenant) return
    setActionLoading('portal')
    const res = await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenant.id,
        returnUrl: `${window.location.origin}${returnPath || '/dashboard/subscription'}`,
      }),
    })
    const { url, error, stripe_error } = await res.json()
    if (url) {
      window.location.href = url
    } else {
      if (stripe_error) {
        alert('⚠️ ' + error + '\n\nURL: https://dashboard.stripe.com/settings/billing/portal')
      } else {
        alert('Erreur: ' + error)
      }
      setActionLoading(null)
    }
  }

  // Applica le modifiche ai moduli → checkout Stripe con i nuovi moduli
  const applyModuleChanges = async () => {
    if (!tenant || !hasChanges) return
    setActionLoading('apply_modules')

    const isAll = ['hotel', 'restaurant', 'spa', 'padel'].every(m => pendingModules.includes(m))
    const slug = isAll ? 'all' : pendingModules.length === 1 ? pendingModules[0] : pendingModules[0]
    const plan = PLANS.find(p => p.slug === slug)
    if (!plan) { setActionLoading(null); return }

    // Se sta solo rimuovendo moduli (senza aggiungerne) → aggiorna direttamente nel DB
    const added = pendingModules.filter(m => !activeModules.includes(m))
    const removed = activeModules.filter(m => !pendingModules.includes(m))

    if (added.length === 0 && removed.length > 0 && pendingModules.length > 0) {
      // Solo rimozione — aggiorna moduli nel DB e nel portale Stripe
      await supabase.from('tenant_modules').delete().eq('tenant_id', tenant.id)
      if (pendingModules.length > 0) {
        await supabase.from('tenant_modules').insert(
          pendingModules.map(m => ({ tenant_id: tenant.id, module: m, is_active: true }))
        )
      }
      setActiveModules([...pendingModules])
      setHasChanges(false)
      setActionLoading(null)
      alert(`✅ Modules mis à jour. Les modules retirés (${removed.join(', ')}) sont désactivés.\n\nPour ajuster votre facturation, utilisez le portail Stripe.`)
      return
    }

    if (pendingModules.length === 0) {
      // Vuole annullare tutto → redirect al portale per cancellazione
      setActionLoading(null)
      openPortal('/dashboard/subscription')
      return
    }

    // Ha aggiunto moduli → nuovo checkout
    const priceId = billingCycle === 'monthly' ? plan.stripe_monthly : plan.stripe_yearly
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        tenantId: tenant.id,
        tenantEmail: tenant.email,
        modules: pendingModules,
        billingCycle,
        mode: 'add_module',
      }),
    })
    const { url, error } = await res.json()
    if (url) window.location.href = url
    else { alert('Erreur: ' + error); setActionLoading(null) }
  }

  // Cambia ciclo mensile ↔ annuale
  const switchCycle = async (newCycle: 'monthly' | 'yearly') => {
    if (!tenant || billingCycle === newCycle) return
    setActionLoading('switch_' + newCycle)
    const isAll = ['hotel','restaurant','spa','padel'].every(m => pendingModules.includes(m))
    const slug = isAll ? 'all' : pendingModules[0] || 'hotel'
    const plan = PLANS.find(p => p.slug === slug)
    if (!plan) { setActionLoading(null); return }

    const priceId = newCycle === 'monthly' ? plan.stripe_monthly : plan.stripe_yearly
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, tenantId: tenant.id, tenantEmail: tenant.email, modules: pendingModules, billingCycle: newCycle }),
    })
    const { url, error } = await res.json()
    if (url) window.location.href = url
    else { alert('Erreur: ' + error); setActionLoading(null) }
  }

  const allMods = ['hotel', 'restaurant', 'spa', 'padel']
  const isAllActive = allMods.every(m => pendingModules.includes(m))

  // Calcola prezzo in base ai moduli pending
  const calcPrice = (cycle: 'monthly' | 'yearly') => {
    if (isAllActive) {
      const p = PLANS.find(pl => pl.slug === 'all')!
      return cycle === 'monthly' ? p.price_monthly : Math.round(p.price_yearly / 12)
    }
    return pendingModules.reduce((s, slug) => {
      const p = PLANS.find(pl => pl.slug === slug)
      return s + (cycle === 'monthly' ? (p?.price_monthly || 0) : Math.round((p?.price_yearly || 0) / 12))
    }, 0)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#8a8680', fontSize: '14px' }}>Chargement...</span>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf9' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #e8e6e1', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 50 }}>
        <Link href="/dashboard/settings" style={{ fontSize: '13px', color: '#6b6760', textDecoration: 'none' }}>← Paramètres</Link>
        <span style={{ color: '#d8d5d0' }}>|</span>
        <span style={{ fontWeight: '600', fontSize: '15px' }}>💳 Gestion de l'abonnement</span>
      </nav>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Successo */}
        {successMsg && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', fontSize: '14px', color: '#065f46' }}>
            ✅ Abonnement mis à jour avec succès !
          </div>
        )}

        {/* ── Statut ── */}
        <div className="card anim" style={{ borderRadius: '16px', marginBottom: '20px', padding: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#8a8680', letterSpacing: '0.05em', marginBottom: '10px' }}>STATUT DE L'ABONNEMENT</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: subscription?.status === 'active' || subscription?.status === 'trialing' ? '#059669' : tenant?.status === 'trial' ? '#f59e0b' : '#d1d5db' }} />
              <span style={{ fontSize: '15px', fontWeight: '600' }}>
                {subscription?.status === 'trialing' ? '🎁 Période d\'essai' :
                 subscription?.status === 'active' ? '✅ Actif' :
                 subscription?.status === 'past_due' ? '⚠️ Paiement en retard' :
                 subscription?.status === 'canceled' ? '❌ Annulé' :
                 tenant?.status === 'trial' ? '🎁 Essai gratuit' : '— Sans abonnement actif'}
              </span>
            </div>
            {subscription?.current_period_end && (
              <div style={{ fontSize: '12px', color: '#8a8680' }}>
                {subscription.cancel_at_period_end ? '⚠️ Expire le ' : 'Renouvellement : '}
                <strong>{new Date(subscription.current_period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
              </div>
            )}
          </div>
        </div>

        {/* ── Sélection modules ── */}
        <div className="card anim-2" style={{ borderRadius: '16px', marginBottom: '20px', padding: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#8a8680', letterSpacing: '0.05em', marginBottom: '6px' }}>MODULES</div>
          <p style={{ fontSize: '13px', color: '#6b6760', margin: '0 0 18px' }}>
            Cochez les modules que vous souhaitez activer. Décochez pour désactiver.
          </p>

          {/* All Inclusive toggle */}
          <div onClick={() => setPendingModules(isAllActive ? [] : [...allMods])}
            style={{ padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', border: `2px solid ${isAllActive ? '#c9a030' : '#e8e6e1'}`, background: isAllActive ? '#fffbf0' : 'white', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>⭐</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>All Inclusive — tous les modules</div>
                <div style={{ fontSize: '12px', color: '#8a8680' }}>€129/mois · ou €103/mois en annuel — économisez 20%</div>
              </div>
            </div>
            <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${isAllActive ? '#c9a030' : '#d8d5d0'}`, background: isAllActive ? '#c9a030' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white', flexShrink: 0 }}>
              {isAllActive && '✓'}
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '12px', color: '#9a9690', margin: '8px 0' }}>— ou choisissez individuellement —</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '10px', marginBottom: '20px' }}>
            {allMods.map(mod => {
              const cfg = MOD_CFG[mod]
              const plan = PLANS.find(p => p.slug === mod)
              const active = pendingModules.includes(mod)
              const wasActive = activeModules.includes(mod)
              const isAdded = active && !wasActive
              const isRemoved = !active && wasActive
              return (
                <div key={mod} onClick={() => !isAllActive && toggleModule(mod)}
                  style={{ padding: '14px', borderRadius: '10px', cursor: isAllActive ? 'default' : 'pointer', border: `1.5px solid ${active ? cfg.color : '#e8e6e1'}`, background: active ? cfg.color + '10' : 'white', opacity: isAllActive ? 0.6 : 1, position: 'relative', transition: 'all 0.15s' }}>
                  {isAdded && <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#059669', color: 'white', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px' }}>+NOUVEAU</div>}
                  {isRemoved && <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#dc2626', color: 'white', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px' }}>−RETIRER</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span style={{ fontSize: '22px' }}>{cfg.icon}</span>
                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${active ? cfg.color : '#d8d5d0'}`, background: active ? cfg.color : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>
                      {active && '✓'}
                    </div>
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '2px' }}>{cfg.name}</div>
                  <div style={{ fontSize: '11px', color: '#8a8680' }}>€{plan?.price_monthly}/mois</div>
                </div>
              )
            })}
          </div>

          {/* Riepilogo prezzo pending */}
          {pendingModules.length > 0 && (
            <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                {isAllActive ? '⭐ All Inclusive' : `${pendingModules.length} module${pendingModules.length > 1 ? 's' : ''}`}
              </div>
              <div>
                <span style={{ fontSize: '22px', fontWeight: '700' }}>€{calcPrice(billingCycle)}</span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginLeft: '4px' }}>/mois</span>
              </div>
            </div>
          )}

          {pendingModules.length === 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
              ⚠️ Aucun module sélectionné — cela annulera votre abonnement.
            </div>
          )}

          {/* Bouton appliquer changements */}
          {hasChanges && (
            <button onClick={applyModuleChanges} disabled={!!actionLoading}
              style={{ width: '100%', padding: '12px', background: pendingModules.length === 0 ? '#dc2626' : '#1a1a1a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              {actionLoading === 'apply_modules' ? 'Application en cours...' :
               pendingModules.length === 0 ? '❌ Annuler l\'abonnement' :
               `✓ Appliquer les modifications`}
            </button>
          )}
          {!hasChanges && (
            <div style={{ fontSize: '12px', color: '#9a9690', textAlign: 'center', padding: '4px' }}>Aucune modification en attente</div>
          )}
        </div>

        {/* ── Cycle de facturation ── */}
        <div className="card anim-3" style={{ borderRadius: '16px', marginBottom: '20px', padding: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#8a8680', letterSpacing: '0.05em', marginBottom: '16px' }}>FRÉQUENCE DE FACTURATION</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div onClick={() => setBillingCycle('monthly')}
              style={{ padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', border: `2px solid ${billingCycle === 'monthly' ? '#1a1a1a' : '#e8e6e1'}`, background: billingCycle === 'monthly' ? '#f5f5f3' : 'white', transition: 'all 0.15s' }}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>📅 Mensuel</div>
              <div style={{ fontSize: '12px', color: '#6b6760' }}>Flexibilité maximale</div>
              {billingCycle === 'monthly' && <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: '600' }}>✓ Plan actuel</div>}
            </div>
            <div onClick={() => setBillingCycle('yearly')}
              style={{ padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', border: `2px solid ${billingCycle === 'yearly' ? '#059669' : '#e8e6e1'}`, background: billingCycle === 'yearly' ? '#f0fdf4' : 'white', transition: 'all 0.15s' }}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                📆 Annuel <span style={{ background: '#f0fdf4', color: '#059669', fontSize: '11px', padding: '1px 5px', borderRadius: '8px', fontWeight: '700' }}>−20%</span>
              </div>
              <div style={{ fontSize: '12px', color: '#6b6760' }}>€{calcPrice('yearly')}/mois · Facturé annuellement</div>
              {billingCycle === 'yearly' && <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: '600' }}>✓ Plan actuel</div>}
            </div>
          </div>
          {subscription?.billing_cycle !== billingCycle && pendingModules.length > 0 && (
            <button onClick={() => switchCycle(billingCycle)} disabled={!!actionLoading}
              style={{ padding: '10px 20px', background: billingCycle === 'yearly' ? '#059669' : '#1a1a1a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {actionLoading?.startsWith('switch_') ? 'Redirection...' : `Passer en ${billingCycle === 'yearly' ? 'annuel −20%' : 'mensuel'} →`}
            </button>
          )}
        </div>

        {/* ── Portail Stripe ── */}
        <div className="card anim-4" style={{ borderRadius: '16px', marginBottom: '20px', padding: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#8a8680', letterSpacing: '0.05em', marginBottom: '8px' }}>PORTAIL DE FACTURATION STRIPE</div>
          <p style={{ fontSize: '13px', color: '#6b6760', margin: '0 0 14px', lineHeight: 1.6 }}>
            Accédez au portail sécurisé Stripe pour gérer votre carte bancaire, télécharger vos factures et voir l'historique des paiements.
          </p>
          <button onClick={() => openPortal()} disabled={!!actionLoading}
            className="btn btn-secondary" style={{ fontSize: '13px' }}>
            {actionLoading === 'portal' ? 'Ouverture...' : '💳 Ouvrir le portail Stripe →'}
          </button>
        </div>

        {/* ── Annuler ── */}
        <div className="card anim-5" style={{ borderRadius: '16px', padding: '24px', border: '1px solid #fecaca', background: '#fef2f2' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#dc2626', marginBottom: '8px' }}>⚠️ Annuler l'abonnement</div>
          <p style={{ fontSize: '13px', color: '#9a3412', margin: '0 0 14px', lineHeight: 1.6 }}>
            L'accès reste actif jusqu'à la fin de la période payée. Gérez l'annulation via le portail Stripe sécurisé.
          </p>
          <button onClick={() => openPortal('/dashboard/subscription')} disabled={!!actionLoading}
            style={{ padding: '9px 18px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
            {actionLoading === 'portal' ? '...' : '🚪 Annuler via Stripe →'}
          </button>
        </div>

      </div>
    </main>
  )
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#8a8680', fontSize: '14px' }}>Chargement...</span></div>}>
      <SubscriptionContent />
    </Suspense>
  )
}
