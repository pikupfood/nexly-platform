'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const IS: any = { width:'100%', padding:'10px 14px', background:'white', border:'1px solid #d8d5d0', borderRadius:'8px', color:'#1a1a1a', fontSize:'14px', transition:'border-color 0.15s' }
const LS: any = { display:'block', fontSize:'12px', fontWeight:'500', color:'#6b6760', marginBottom:'6px' }

export default function SettingsPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [tab, setTab] = useState<'structure'|'billing'|'account'>('structure')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  const [biz, setBiz] = useState({ business_name:'', business_type:'hotel', phone:'', website:'', welcome_message:'', primary_color:'#1a1a1a' })
  const [bill, setBill] = useState({ legal_name:'', siret:'', vat_number:'', address:'', city:'', postal_code:'', country:'FR' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/auth/login'); return }
      supabase.from('tenants').select('*').eq('user_id', session.user.id).single().then(({ data }) => {
        if (!data) { router.replace('/onboarding'); return }
        setTenant(data)
        setBiz({ business_name: data.business_name || '', business_type: data.business_type || 'hotel', phone: data.phone || '', website: data.website || '', welcome_message: data.welcome_message || '', primary_color: data.primary_color || '#1a1a1a' })
        setBill({ legal_name: data.legal_name || '', siret: data.siret || '', vat_number: data.vat_number || '', address: data.address || '', city: data.city || '', postal_code: data.postal_code || '', country: data.country || 'FR' })
      })
    })
  }, [])

  const save = async () => {
    if (!tenant) return
    setSaving(true)
    const payload = tab === 'structure' ? biz : bill
    await supabase.from('tenants').update(payload).eq('id', tenant.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const openPortal = async () => {
    if (!tenant) return
    setPortalLoading(true)
    const res = await fetch('/api/portal', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ tenantId: tenant.id }) })
    const { url } = await res.json()
    if (url) window.location.href = url
    setPortalLoading(false)
  }

  if (!tenant) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fafaf9' }}><span style={{ color:'#8a8680', fontSize:'14px' }}>Chargement...</span></div>

  const TABS = [{ key:'structure', label:'📋 Structure' }, { key:'billing', label:'🧾 Facturation' }, { key:'account', label:'👤 Compte' }]

  return (
    <main style={{ minHeight:'100vh', background:'#fafaf9' }}>
      <nav style={{ background:'white', borderBottom:'1px solid #e8e6e1', padding:'0 32px', height:'56px', display:'flex', alignItems:'center', gap:'16px', position:'sticky', top:0, zIndex:50 }}>
        <Link href="/dashboard" style={{ fontSize:'13px', color:'#6b6760' }}>← Dashboard</Link>
        <span style={{ color:'#d8d5d0' }}>|</span>
        <span style={{ fontWeight:'600', fontSize:'15px' }}>Paramètres</span>
      </nav>

      <div style={{ maxWidth:'700px', margin:'0 auto', padding:'40px 24px' }}>
        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', background:'#f0ede8', borderRadius:'10px', padding:'4px', marginBottom:'28px', width:'fit-content' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{ padding:'8px 18px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500', background: tab===t.key ? 'white' : 'transparent', color: tab===t.key ? '#1a1a1a' : '#8a8680', boxShadow: tab===t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition:'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Structure */}
        {tab === 'structure' && (
          <div className="card anim" style={{ borderRadius:'14px', padding:'28px' }}>
            <h2 style={{ fontSize:'16px', fontWeight:'600', margin:'0 0 20px' }}>Informations de votre structure</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={LS}>Nom de l'établissement</label>
                <input style={IS} value={biz.business_name} onChange={e => setBiz(p=>({...p,business_name:e.target.value}))} placeholder="Hôtel Le Grand" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={LS}>Téléphone</label>
                  <input style={IS} value={biz.phone} onChange={e => setBiz(p=>({...p,phone:e.target.value}))} />
                </div>
                <div>
                  <label style={LS}>Site web</label>
                  <input style={IS} value={biz.website} onChange={e => setBiz(p=>({...p,website:e.target.value}))} />
                </div>
              </div>
              <div>
                <label style={LS}>Message d'accueil (portail clients)</label>
                <textarea style={{ ...IS, height:'80px', resize:'vertical' }} value={biz.welcome_message} onChange={e => setBiz(p=>({...p,welcome_message:e.target.value}))} placeholder="Bienvenue chez nous ! Réservez votre séjour en quelques clics." />
              </div>
              <div>
                <label style={LS}>Couleur principale du portail</label>
                <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                  <input type="color" value={biz.primary_color} onChange={e => setBiz(p=>({...p,primary_color:e.target.value}))} style={{ width:'40px', height:'40px', borderRadius:'8px', border:'1px solid #d8d5d0', cursor:'pointer', padding:'2px' }} />
                  <input style={{ ...IS, flex:1 }} value={biz.primary_color} onChange={e => setBiz(p=>({...p,primary_color:e.target.value}))} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing */}
        {tab === 'billing' && (
          <div className="card anim" style={{ borderRadius:'14px', padding:'28px' }}>
            <h2 style={{ fontSize:'16px', fontWeight:'600', margin:'0 0 4px' }}>Informations de facturation</h2>
            <p style={{ fontSize:'13px', color:'#6b6760', margin:'0 0 20px' }}>Ces données apparaissent sur vos factures clients.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={LS}>Raison sociale</label>
                <input style={IS} value={bill.legal_name} onChange={e => setBill(p=>({...p,legal_name:e.target.value}))} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={LS}>SIRET</label>
                  <input style={IS} value={bill.siret} onChange={e => setBill(p=>({...p,siret:e.target.value}))} />
                </div>
                <div>
                  <label style={LS}>N° TVA</label>
                  <input style={IS} value={bill.vat_number} onChange={e => setBill(p=>({...p,vat_number:e.target.value}))} />
                </div>
              </div>
              <div>
                <label style={LS}>Adresse</label>
                <input style={IS} value={bill.address} onChange={e => setBill(p=>({...p,address:e.target.value}))} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px' }}>
                <div><label style={LS}>Ville</label><input style={IS} value={bill.city} onChange={e => setBill(p=>({...p,city:e.target.value}))} /></div>
                <div><label style={LS}>Code postal</label><input style={IS} value={bill.postal_code} onChange={e => setBill(p=>({...p,postal_code:e.target.value}))} /></div>
                <div>
                  <label style={LS}>Pays</label>
                  <select style={IS} value={bill.country} onChange={e => setBill(p=>({...p,country:e.target.value}))}>
                    <option value="FR">France</option><option value="BE">Belgique</option>
                    <option value="CH">Suisse</option><option value="MC">Monaco</option><option value="IT">Italie</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginTop:'20px', paddingTop:'20px', borderTop:'1px solid #e8e6e1' }}>
              <div style={{ fontSize:'13px', fontWeight:'600', marginBottom:'10px' }}>Abonnement</div>
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                <a href="/dashboard/subscription" className="btn btn-primary" style={{ fontSize:'13px', textDecoration:'none' }}>
                  💳 Gérer mon abonnement →
                </a>
                <button className="btn btn-secondary" onClick={openPortal} disabled={portalLoading} style={{ fontSize:'13px' }}>
                  {portalLoading ? '...' : '🔗 Portail Stripe'}
                </button>
              </div>
              <p style={{ fontSize:'12px', color:'#9a9690', marginTop:'8px' }}>
                Changez de plan, ajoutez des modules, passez en annuel ou annulez votre abonnement.
              </p>
            </div>
          </div>
        )}

        {/* Account */}
        {tab === 'account' && (
          <div className="anim">
            <div className="card" style={{ borderRadius:'14px', padding:'24px', marginBottom:'16px' }}>
              <h2 style={{ fontSize:'16px', fontWeight:'600', margin:'0 0 16px' }}>Mon compte</h2>
              <div style={{ fontSize:'14px', color:'#6b6760', marginBottom:'4px' }}>Email</div>
              <div style={{ fontSize:'14px', color:'#1a1a1a', fontWeight:'500', marginBottom:'16px' }}>{tenant.email}</div>
              <div style={{ fontSize:'14px', color:'#6b6760', marginBottom:'4px' }}>Compte créé le</div>
              <div style={{ fontSize:'14px', color:'#1a1a1a', marginBottom:'20px' }}>{new Date(tenant.created_at).toLocaleDateString('fr-FR')}</div>
              <div style={{ fontSize:'14px', color:'#6b6760', marginBottom:'6px' }}>🔑 Votre Tenant ID</div>
              <div style={{ background:'#f5f5f3', border:'1px solid #e0ddd8', borderRadius:'8px', padding:'10px 14px', fontSize:'12px', fontFamily:'monospace', color:'#1a1a1a', marginBottom:'6px', wordBreak:'break-all' }}>{tenant.id}</div>
              <div style={{ fontSize:'12px', color:'#9a9690', marginBottom:'16px' }}>
                Utilisez cet ID comme <code style={{ background:'#f0ede8', padding:'1px 5px', borderRadius:'3px' }}>NEXT_PUBLIC_TENANT_ID</code> dans les variables d'environnement de votre portail de réservations (nexly-booking).
              </div>
            </div>
            <div className="card" style={{ borderRadius:'14px', padding:'24px', border:'1px solid #fecaca', background:'#fef2f2' }}>
              <h2 style={{ fontSize:'16px', fontWeight:'600', margin:'0 0 8px', color:'#dc2626' }}>Zone de danger</h2>
              <p style={{ fontSize:'13px', color:'#9a3412', margin:'0 0 16px' }}>La suppression de votre compte est irréversible. Toutes vos données seront perdues.</p>
              <button className="btn btn-danger" style={{ fontSize:'13px' }} onClick={() => alert('Contactez le support pour supprimer votre compte.')}>
                Supprimer mon compte
              </button>
            </div>
          </div>
        )}

        {/* Save button */}
        {tab !== 'account' && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'20px' }}>
            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ padding:'11px 28px' }}>
              {saved ? '✓ Enregistré !' : saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
