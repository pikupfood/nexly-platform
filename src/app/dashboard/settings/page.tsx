'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'

const IS: any = { width:'100%', padding:'9px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }
const LS: any = { display:'block', fontSize:'11px', fontWeight:500, color:'#64748b', marginBottom:'4px' }
const SECTION: any = { background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'20px 24px', marginBottom:'16px' }

export default function SettingsPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    business_name:'', phone:'', website:'', email:'', welcome_message:'',
    legal_name:'', siret:'', vat_number:'', address:'', city:'', postal_code:'', country:'FR',
    primary_color:'#1a1a1a', facebook_url:'', instagram_url:'', google_maps_url:'',
  })

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      if (tn) {
        setTenant(tn)
        setForm({
          business_name: tn.business_name||'',
          phone: tn.phone||'',
          website: tn.website||'',
          email: tn.email||session.user.email||'',
          welcome_message: tn.welcome_message||'',
          legal_name: tn.legal_name||'',
          siret: tn.siret||'',
          vat_number: tn.vat_number||'',
          address: tn.address||'',
          city: tn.city||'',
          postal_code: tn.postal_code||'',
          country: tn.country||'FR',
          primary_color: tn.primary_color||'#1a1a1a',
          facebook_url: tn.facebook_url||'',
          instagram_url: tn.instagram_url||'',
          google_maps_url: tn.google_maps_url||'',
        })
      }
      setLoading(false)
    })
  }, [])

  const save = async () => {
    if (!tenant) return
    setSaving(true)
    const { error } = await supabase.from('tenants').update(form).eq('id', tenant.id)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(()=>setSaved(false), 2500) }
    else alert('Erreur: ' + error.message)
  }

  const f = (k: string) => (form as any)[k]
  const u = (k: string) => (e: any) => setForm(p => ({...p, [k]: e.target.value}))

  const actions = (
    <button onClick={save} disabled={saving||loading} style={{ padding:'7px 20px', background:saved?'#059669':'#2563eb', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600', transition:'background 0.2s' }}>
      {saved ? '✓ Enregistré' : saving ? '...' : '💾 Enregistrer'}
    </button>
  )

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#94a3b8' }}>Chargement...</div>
    </div>
  )

  return (
    <AppShell title="Paramètres" subtitle="Configuration de l'établissement" actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'20px 24px', maxWidth:'720px' }}>

        <div style={SECTION}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'16px' }}>🏢 Votre établissement</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={LS}>Nom de l'établissement *</label>
              <input style={IS} value={f('business_name')} onChange={u('business_name')} placeholder="Hôtel Le Grand" />
            </div>
            <div><label style={LS}>Téléphone</label><input style={IS} value={f('phone')} onChange={u('phone')} placeholder="+33 4 93..." /></div>
            <div><label style={LS}>Email contact</label><input style={IS} value={f('email')} onChange={u('email')} placeholder="contact@hotel.fr" /></div>
            <div><label style={LS}>Site web</label><input style={IS} value={f('website')} onChange={u('website')} placeholder="https://..." /></div>
            <div><label style={LS}>Adresse</label><input style={IS} value={f('address')} onChange={u('address')} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'8px' }}>
              <div><label style={LS}>Ville</label><input style={IS} value={f('city')} onChange={u('city')} /></div>
              <div><label style={LS}>Code postal</label><input style={IS} value={f('postal_code')} onChange={u('postal_code')} /></div>
            </div>
            <div><label style={LS}>Pays</label>
              <select style={IS} value={f('country')} onChange={u('country')}>
                {[['FR','France'],['BE','Belgique'],['CH','Suisse'],['IT','Italie'],['MC','Monaco']].map(([v,l])=>(
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={LS}>Message d'accueil (portail réservation)</label>
              <textarea style={{ ...IS, height:'72px', resize:'vertical' }} value={f('welcome_message')} onChange={u('welcome_message')} placeholder="Bienvenue ! Réservez votre séjour en ligne..." />
            </div>
          </div>
        </div>

        <div style={SECTION}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'16px' }}>🧾 Informations de facturation</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div style={{ gridColumn:'1 / -1' }}><label style={LS}>Raison sociale</label><input style={IS} value={f('legal_name')} onChange={u('legal_name')} /></div>
            <div><label style={LS}>SIRET</label><input style={IS} value={f('siret')} onChange={u('siret')} /></div>
            <div><label style={LS}>N° TVA</label><input style={IS} value={f('vat_number')} onChange={u('vat_number')} /></div>
          </div>
        </div>

        <div style={SECTION}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'16px' }}>🎨 Portail de réservation</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
            <div>
              <label style={LS}>Couleur principale du portail</label>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <input type="color" value={f('primary_color')} onChange={u('primary_color')} style={{ width:'38px', height:'34px', borderRadius:'6px', border:'1px solid #e2e8f0', cursor:'pointer', padding:'2px' }} />
                <input style={{ ...IS, flex:1 }} value={f('primary_color')} onChange={u('primary_color')} />
              </div>
            </div>
            <div><label style={LS}>Facebook</label><input style={IS} value={f('facebook_url')} onChange={u('facebook_url')} placeholder="https://facebook.com/..." /></div>
            <div><label style={LS}>Instagram</label><input style={IS} value={f('instagram_url')} onChange={u('instagram_url')} placeholder="https://instagram.com/..." /></div>
            <div><label style={LS}>Google Maps</label><input style={IS} value={f('google_maps_url')} onChange={u('google_maps_url')} placeholder="https://maps.google.com/..." /></div>
          </div>
          {tenant?.slug && (
            <div style={{ padding:'10px 14px', background:'#f0f9ff', borderRadius:'8px', border:'1px solid #bae6fd', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'11px', color:'#0284c7', marginBottom:'2px', fontWeight:'600' }}>URL de votre portail de réservation</div>
                <code style={{ fontSize:'12px', color:'#0369a1' }}>nexly-booking.vercel.app/{tenant.slug}</code>
              </div>
              <button onClick={()=>navigator.clipboard?.writeText(`https://nexly-booking.vercel.app/${tenant.slug}`)}
                style={{ padding:'5px 10px', background:'white', border:'1px solid #bae6fd', borderRadius:'6px', cursor:'pointer', fontSize:'11px', color:'#0284c7', fontWeight:'600' }}>
                📋 Copier
              </button>
            </div>
          )}
        </div>

        <div style={SECTION}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>👤 Compte</div>
          <div style={{ padding:'10px 14px', background:'#f8fafc', borderRadius:'8px', border:'1px solid #e2e8f0' }}>
            <div style={{ fontSize:'11px', color:'#94a3b8' }}>Email de connexion</div>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginTop:'2px' }}>{user?.email}</div>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
