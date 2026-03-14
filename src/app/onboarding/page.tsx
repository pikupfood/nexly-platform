'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, PLANS } from '@/lib/supabase'

const STEPS = ['Modules', 'Votre structure', 'Facturation', 'Abonnement']

const BUSINESS_TYPES = [
  { value:'hotel', label:'Hôtel', icon:'🏨' },
  { value:'restaurant', label:'Restaurant', icon:'🍽️' },
  { value:'resort', label:'Resort / Club', icon:'🌴' },
  { value:'spa_center', label:'Centre Spa', icon:'💆' },
  { value:'sports_center', label:'Centre sportif', icon:'🎾' },
  { value:'other', label:'Autre', icon:'🏢' },
]

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultPlan = searchParams.get('plan') || ''

  const [step, setStep] = useState(1)
  const [tenant, setTenant] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly'|'yearly'>('monthly')

  // Step 1
  const [selectedModules, setSelectedModules] = useState<string[]>(
    defaultPlan === 'all' ? ['hotel','restaurant','spa','padel'] :
    defaultPlan ? [defaultPlan] : []
  )

  // Step 2
  const [bizInfo, setBizInfo] = useState({ business_name:'', business_type:'hotel', phone:'', website:'' })

  // Step 3
  const [billing, setBilling] = useState({ legal_name:'', siret:'', vat_number:'', address:'', city:'', postal_code:'', country:'FR' })

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/auth/login'); return }
      let { data } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      
      // Se il tenant non esiste, crealo automaticamente
      if (!data) {
        const { data: newTenant } = await supabase.from('tenants').insert([{
          user_id: session.user.id,
          email: session.user.email,
          status: 'trial',
          onboarding_step: 1,
        }]).select().single()
        data = newTenant
      }

      if (data) {
          setTenant(data)
          if (data.onboarding_step >= 4) router.replace('/dashboard')
          if (data.business_name) setBizInfo(p => ({ ...p, business_name: data.business_name || '', business_type: data.business_type || 'hotel', phone: data.phone || '', website: data.website || '' }))
          if (data.legal_name) setBilling(p => ({ ...p, legal_name: data.legal_name || '', siret: data.siret || '', vat_number: data.vat_number || '', address: data.address || '', city: data.city || '', postal_code: data.postal_code || '', country: data.country || 'FR' }))
          setStep(data.onboarding_step || 1)
      } else {
        // Caso estremo — redirect al login
        router.replace('/auth/login')
      }
    })
  }, [])

  const toggleModule = (slug: string) => {
    if (slug === 'all') {
      setSelectedModules(selectedModules.length === 4 ? [] : ['hotel','restaurant','spa','padel'])
      return
    }
    setSelectedModules(prev => prev.includes(slug) ? prev.filter(m => m !== slug) : [...prev, slug])
  }

  const isAllSelected = selectedModules.length === 4

  // Calcola piano selezionato e prezzo
  const getSelectedPlan = () => {
    if (isAllSelected) return PLANS.find(p => p.slug === 'all')!
    const mods = selectedModules
    if (mods.length === 0) return null
    // Se un solo modulo, usa quel piano; se più moduli separati, calcola somma
    if (mods.length === 1) return PLANS.find(p => p.slug === mods[0]) || null
    return null // multi-moduli non-all = mostra somma
  }

  const getPrice = () => {
    if (isAllSelected) {
      const p = PLANS.find(pl => pl.slug === 'all')!
      return billingCycle === 'monthly' ? p.price_monthly : p.price_yearly / 12
    }
    return selectedModules.reduce((sum, slug) => {
      const p = PLANS.find(pl => pl.slug === slug)
      if (!p) return sum
      return sum + (billingCycle === 'monthly' ? p.price_monthly : p.price_yearly / 12)
    }, 0)
  }

  const getStripePrice = () => {
    if (isAllSelected) {
      const p = PLANS.find(pl => pl.slug === 'all')!
      return billingCycle === 'monthly' ? p.stripe_monthly : p.stripe_yearly
    }
    if (selectedModules.length === 1) {
      const p = PLANS.find(pl => pl.slug === selectedModules[0])
      return p ? (billingCycle === 'monthly' ? p.stripe_monthly : p.stripe_yearly) : ''
    }
    // Multi-modulo: usa il primo per ora (in produzione si farebbe con più line_items)
    const p = PLANS.find(pl => pl.slug === selectedModules[0])
    return p ? (billingCycle === 'monthly' ? p.stripe_monthly : p.stripe_yearly) : ''
  }

  const saveStep1 = async () => {
    if (selectedModules.length === 0) return
    setSaving(true)
    await supabase.from('tenants').update({ onboarding_step: 2 }).eq('id', tenant.id)
    // Salva moduli selezionati
    await supabase.from('tenant_modules').delete().eq('tenant_id', tenant.id)
    await supabase.from('tenant_modules').insert(selectedModules.map(m => ({ tenant_id: tenant.id, module: m })))
    setSaving(false); setStep(2)
  }

  const saveStep2 = async () => {
    if (!bizInfo.business_name) return
    setSaving(true)
    await supabase.from('tenants').update({ ...bizInfo, onboarding_step: 3 }).eq('id', tenant.id)
    setSaving(false); setStep(3)
  }

  const saveStep3 = async () => {
    setSaving(true)
    await supabase.from('tenants').update({ ...billing, onboarding_step: 4 }).eq('id', tenant.id)
    setSaving(false); setStep(4)
  }

  const goToCheckout = async () => {
    setSaving(true)
    const priceId = getStripePrice()
    if (!priceId) { setSaving(false); alert('Aucun plan sélectionné'); return }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, tenantId: tenant.id, modules: selectedModules, billingCycle }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Checkout error:', err)
        alert(`Erreur: ${err.error || 'Impossible de créer la session de paiement. Vérifiez la configuration Stripe.'}`)
        setSaving(false)
        return
      }
      const { url } = await res.json()
      if (url) window.location.href = url
      else { alert('URL de paiement manquante'); setSaving(false) }
    } catch (e) {
      console.error('Checkout fetch error:', e)
      alert('Erreur de connexion. Vérifiez les variables d\'environnement Stripe sur Vercel.')
      setSaving(false)
    }
  }

  if (!tenant) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fafaf9' }}>
      <div style={{ color:'#8a8680', fontSize:'14px' }}>Chargement...</div>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', background:'#fafaf9' }}>
      {/* Header */}
      <div style={{ borderBottom:'1px solid #e8e6e1', background:'white', padding:'0 32px', height:'56px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'26px', height:'26px', background:'#1a1a1a', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'12px', fontWeight:'700' }}>N</div>
          <span style={{ fontWeight:'600', fontSize:'15px' }}>Nexly Hub</span>
        </div>
        {/* Steps indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'4px 10px', borderRadius:'20px', background: step === i+1 ? '#1a1a1a' : step > i+1 ? '#f0fdf4' : 'transparent' }}>
                <div style={{ width:'16px', height:'16px', borderRadius:'50%', background: step > i+1 ? '#059669' : step === i+1 ? 'white' : '#d8d5d0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', color: step > i+1 ? 'white' : step === i+1 ? '#1a1a1a' : '#9a9690', fontWeight:'700' }}>
                  {step > i+1 ? '✓' : i+1}
                </div>
                <span style={{ fontSize:'12px', fontWeight:'500', color: step === i+1 ? 'white' : step > i+1 ? '#059669' : '#9a9690', display: i > 1 ? 'none' : 'block' }} className="hide-mobile">{s}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ width:'16px', height:'1px', background:'#e8e6e1' }} />}
            </div>
          ))}
        </div>
        <div style={{ width:'120px' }} />
      </div>

      <div style={{ maxWidth:'680px', margin:'0 auto', padding:'48px 24px 80px' }}>

        {/* ── STEP 1: Modules ── */}
        {step === 1 && (
          <div className="anim">
            <h2 style={{ fontSize:'22px', fontWeight:'700', margin:'0 0 6px', letterSpacing:'-0.01em' }}>Choisissez vos modules</h2>
            <p style={{ color:'#6b6760', fontSize:'14px', margin:'0 0 28px' }}>Sélectionnez les services que vous souhaitez gérer. Vous pourrez en ajouter d'autres plus tard.</p>

            {/* All Inclusive */}
            <div onClick={() => toggleModule('all')} style={{ padding:'18px 20px', borderRadius:'12px', cursor:'pointer', background:'white', border:`2px solid ${isAllSelected ? '#1a1a1a' : '#e8e6e1'}`, marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'border-color 0.15s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ fontSize:'22px' }}>⭐</span>
                <div>
                  <div style={{ fontWeight:'600', fontSize:'14px' }}>All Inclusive — tous les modules</div>
                  <div style={{ fontSize:'12px', color:'#8a8680' }}>Hôtel + Restaurant + Spa + Padel · Économisez 20%</div>
                </div>
              </div>
              <div style={{ width:'20px', height:'20px', borderRadius:'4px', border:`2px solid ${isAllSelected ? '#1a1a1a' : '#d8d5d0'}`, background: isAllSelected ? '#1a1a1a' : 'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:'white', flexShrink:0 }}>
                {isAllSelected && '✓'}
              </div>
            </div>

            <div style={{ textAlign:'center', fontSize:'12px', color:'#9a9690', margin:'8px 0' }}>— ou sélectionnez individuellement —</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'28px' }}>
              {PLANS.filter(p => p.slug !== 'all').map(plan => {
                const sel = selectedModules.includes(plan.slug)
                return (
                  <div key={plan.slug} onClick={() => toggleModule(plan.slug)} style={{ padding:'16px', borderRadius:'10px', cursor:'pointer', background:'white', border:`1.5px solid ${sel ? plan.color : '#e8e6e1'}`, transition:'border-color 0.15s', opacity: isAllSelected ? 0.5 : 1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                      <span style={{ fontSize:'20px' }}>{plan.icon}</span>
                      <div style={{ width:'18px', height:'18px', borderRadius:'4px', border:`2px solid ${sel ? plan.color : '#d8d5d0'}`, background: sel ? plan.color : 'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'white' }}>
                        {sel && '✓'}
                      </div>
                    </div>
                    <div style={{ fontWeight:'600', fontSize:'13px', marginBottom:'2px' }}>{plan.name}</div>
                    <div style={{ fontSize:'11px', color:'#8a8680', marginBottom:'8px' }}>{plan.desc}</div>
                    <div style={{ fontSize:'13px', fontWeight:'600', color: plan.color }}>€{plan.price_monthly}<span style={{ fontWeight:'400', color:'#9a9690', fontSize:'11px' }}>/mois</span></div>
                  </div>
                )
              })}
            </div>

            {selectedModules.length > 0 && !isAllSelected && (
              <div style={{ background:'#f5f5f3', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', display:'flex', justifyContent:'space-between', fontSize:'13px' }}>
                <span style={{ color:'#6b6760' }}>{selectedModules.length} module{selectedModules.length > 1 ? 's' : ''} sélectionné{selectedModules.length > 1 ? 's' : ''}</span>
                <span style={{ fontWeight:'600' }}>à partir de €{selectedModules.reduce((s, slug) => s + (PLANS.find(p=>p.slug===slug)?.price_monthly||0), 0)}/mois</span>
              </div>
            )}

            <button className="btn btn-primary" onClick={saveStep1} disabled={selectedModules.length === 0 || saving} style={{ width:'100%', padding:'13px' }}>
              {saving ? 'Enregistrement...' : 'Continuer →'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Business info ── */}
        {step === 2 && (
          <div className="anim">
            <h2 style={{ fontSize:'22px', fontWeight:'700', margin:'0 0 6px', letterSpacing:'-0.01em' }}>Votre structure</h2>
            <p style={{ color:'#6b6760', fontSize:'14px', margin:'0 0 28px' }}>Ces informations apparaîtront sur votre portail de réservation client.</p>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginBottom:'24px' }}>
              <div>
                <label className="label">Nom de l'établissement *</label>
                <input className="input" value={bizInfo.business_name} onChange={e => setBizInfo(p=>({...p,business_name:e.target.value}))} placeholder="Hôtel Le Grand" />
              </div>
              <div>
                <label className="label">Type d'établissement</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px' }}>
                  {BUSINESS_TYPES.map(bt => (
                    <div key={bt.value} onClick={() => setBizInfo(p=>({...p,business_type:bt.value}))} style={{ padding:'10px 12px', borderRadius:'8px', cursor:'pointer', textAlign:'center', background:'white', border:`1.5px solid ${bizInfo.business_type===bt.value ? '#1a1a1a' : '#e8e6e1'}`, transition:'border-color 0.15s' }}>
                      <div style={{ fontSize:'18px', marginBottom:'2px' }}>{bt.icon}</div>
                      <div style={{ fontSize:'11px', fontWeight:'500', color: bizInfo.business_type===bt.value ? '#1a1a1a' : '#6b6760' }}>{bt.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label className="label">Téléphone</label>
                  <input className="input" value={bizInfo.phone} onChange={e => setBizInfo(p=>({...p,phone:e.target.value}))} placeholder="+33 4 93 ..." />
                </div>
                <div>
                  <label className="label">Site web</label>
                  <input className="input" value={bizInfo.website} onChange={e => setBizInfo(p=>({...p,website:e.target.value}))} placeholder="www.monhotel.com" />
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Retour</button>
              <button className="btn btn-primary" onClick={saveStep2} disabled={!bizInfo.business_name || saving} style={{ flex:1, padding:'13px' }}>
                {saving ? 'Enregistrement...' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Billing info ── */}
        {step === 3 && (
          <div className="anim">
            <h2 style={{ fontSize:'22px', fontWeight:'700', margin:'0 0 6px', letterSpacing:'-0.01em' }}>Informations de facturation</h2>
            <p style={{ color:'#6b6760', fontSize:'14px', margin:'0 0 28px' }}>Ces données apparaîtront sur vos factures (normative française). Tout est optionnel sauf le nom légal.</p>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginBottom:'24px' }}>
              <div>
                <label className="label">Raison sociale / Nom légal *</label>
                <input className="input" value={billing.legal_name} onChange={e => setBilling(p=>({...p,legal_name:e.target.value}))} placeholder="SAS Hôtel Le Grand" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label className="label">SIRET</label>
                  <input className="input" value={billing.siret} onChange={e => setBilling(p=>({...p,siret:e.target.value}))} placeholder="123 456 789 00012" />
                </div>
                <div>
                  <label className="label">N° TVA Intracommunautaire</label>
                  <input className="input" value={billing.vat_number} onChange={e => setBilling(p=>({...p,vat_number:e.target.value}))} placeholder="FR12 123456789" />
                </div>
              </div>
              <div>
                <label className="label">Adresse</label>
                <input className="input" value={billing.address} onChange={e => setBilling(p=>({...p,address:e.target.value}))} placeholder="12 rue de la Mer" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px' }}>
                <div>
                  <label className="label">Ville</label>
                  <input className="input" value={billing.city} onChange={e => setBilling(p=>({...p,city:e.target.value}))} placeholder="Nice" />
                </div>
                <div>
                  <label className="label">Code postal</label>
                  <input className="input" value={billing.postal_code} onChange={e => setBilling(p=>({...p,postal_code:e.target.value}))} placeholder="06000" />
                </div>
                <div>
                  <label className="label">Pays</label>
                  <select className="input" value={billing.country} onChange={e => setBilling(p=>({...p,country:e.target.value}))}>
                    <option value="FR">France</option>
                    <option value="BE">Belgique</option>
                    <option value="CH">Suisse</option>
                    <option value="MC">Monaco</option>
                    <option value="IT">Italie</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← Retour</button>
              <button className="btn btn-primary" onClick={saveStep3} disabled={!billing.legal_name || saving} style={{ flex:1, padding:'13px' }}>
                {saving ? 'Enregistrement...' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Subscription ── */}
        {step === 4 && (
          <div className="anim">
            <h2 style={{ fontSize:'22px', fontWeight:'700', margin:'0 0 6px', letterSpacing:'-0.01em' }}>Choisissez votre abonnement</h2>
            <p style={{ color:'#6b6760', fontSize:'14px', margin:'0 0 28px' }}>14 jours gratuits, puis facturation selon votre choix. Annulez à tout moment.</p>

            {/* Billing toggle */}
            <div style={{ display:'flex', background:'#f5f5f3', borderRadius:'10px', padding:'4px', marginBottom:'24px', width:'fit-content' }}>
              {(['monthly','yearly'] as const).map(cycle => (
                <button key={cycle} onClick={() => setBillingCycle(cycle)} style={{ padding:'8px 20px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500', background: billingCycle===cycle ? 'white' : 'transparent', color: billingCycle===cycle ? '#1a1a1a' : '#8a8680', boxShadow: billingCycle===cycle ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition:'all 0.15s' }}>
                  {cycle === 'monthly' ? 'Mensuel' : 'Annuel'}{cycle === 'yearly' && <span style={{ fontSize:'10px', marginLeft:'4px', color:'#059669', fontWeight:'600' }}>-20%</span>}
                </button>
              ))}
            </div>

            {/* Modules selezionati */}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'20px' }}>
              {isAllSelected ? (
                <div className="card" style={{ borderRadius:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <span style={{ fontSize:'22px' }}>⭐</span>
                    <div>
                      <div style={{ fontWeight:'600', fontSize:'14px' }}>All Inclusive</div>
                      <div style={{ fontSize:'12px', color:'#8a8680' }}>Hôtel · Restaurant · Spa · Padel</div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:'700', fontSize:'18px' }}>€{billingCycle==='monthly' ? 129 : (1238/12).toFixed(0)}</div>
                    <div style={{ fontSize:'11px', color:'#8a8680' }}>par mois</div>
                  </div>
                </div>
              ) : (
                selectedModules.map(slug => {
                  const plan = PLANS.find(p => p.slug === slug)
                  if (!plan) return null
                  return (
                    <div key={slug} className="card" style={{ borderRadius:'12px', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <span style={{ fontSize:'20px' }}>{plan.icon}</span>
                        <div style={{ fontWeight:'500', fontSize:'14px' }}>{plan.name}</div>
                      </div>
                      <div style={{ fontWeight:'600', fontSize:'15px' }}>€{billingCycle==='monthly' ? plan.price_monthly : (plan.price_yearly/12).toFixed(0)}/mois</div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Total */}
            <div style={{ background:'#1a1a1a', borderRadius:'12px', padding:'18px 20px', marginBottom:'24px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'white' }}>
              <div>
                <div style={{ fontWeight:'600', fontSize:'14px' }}>Total après essai</div>
                <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', marginTop:'2px' }}>
                  {billingCycle === 'yearly' ? 'Facturé annuellement' : 'Facturé mensuellement'}
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'28px', fontWeight:'700', letterSpacing:'-0.02em' }}>
                  €{isAllSelected
                    ? (billingCycle === 'monthly' ? 129 : Math.round(1238/12))
                    : billingCycle === 'monthly'
                      ? selectedModules.reduce((s, slug) => s + (PLANS.find(p=>p.slug===slug)?.price_monthly||0), 0)
                      : Math.round(selectedModules.reduce((s, slug) => s + (PLANS.find(p=>p.slug===slug)?.price_yearly||0), 0) / 12)
                  }
                </div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.6)' }}>par mois</div>
              </div>
            </div>

            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', fontSize:'13px', color:'#065f46' }}>
              ✓ 14 jours gratuits — aucun débit avant la fin de l'essai · ✓ Annulable à tout moment
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(3)}>← Retour</button>
              <button className="btn btn-primary" onClick={goToCheckout} disabled={saving} style={{ flex:1, padding:'13px', fontSize:'14px' }}>
                {saving ? 'Redirection...' : '🔒 Commencer l\'essai gratuit →'}
              </button>
            </div>
            <p style={{ fontSize:'11px', color:'#9a9690', textAlign:'center', marginTop:'12px' }}>Paiement sécurisé via Stripe · Vous serez redirigé vers la page de paiement</p>
          </div>
        )}
      </div>
    </main>
  )
}

export default function OnboardingPage() {
  return <Suspense fallback={<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#fafaf9'}}><span style={{color:'#8a8680',fontSize:'14px'}}>Chargement...</span></div>}><OnboardingContent /></Suspense>
}
