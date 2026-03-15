'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

export default function SitoPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [tenant, setTenant] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(tn)
      setForm({ business_name:tn?.business_name||'', welcome_message:tn?.welcome_message||'', about_text:tn?.about_text||'', address:tn?.address||'', city:tn?.city||'', phone:tn?.phone||'', email:tn?.email||'', website_enabled:tn?.website_enabled||false, facebook_url:tn?.facebook_url||'', instagram_url:tn?.instagram_url||'', google_maps_url:tn?.google_maps_url||'', primary_color:tn?.primary_color||'#1a1a1a' })
    })
  }, [])

  const save = async () => {
    if (!tenant) return
    setSaving(true)
    const { error } = await supabase.from('tenants').update(form).eq('id', tenant.id)
    if (!error) { setSaved(true); setTimeout(()=>setSaved(false),2500) }
    setSaving(false)
  }

  const IS: any = { padding:'8px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box', width:'100%' }

  if (!form) return null

  const previewUrl = `https://nexly-booking.vercel.app/${tenant?.slug||'...'}`

  const actions = (
    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
      {saved&&<span style={{ color:'#059669', fontSize:'12px', fontWeight:'600' }}>✓ Sauvegardé</span>}
      <a href={previewUrl} target="_blank" rel="noreferrer" style={{ padding:'7px 14px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:'8px', textDecoration:'none', fontSize:'12px', fontWeight:'600' }}>↗ Aperçu</a>
      <button onClick={save} disabled={saving} style={{ padding:'7px 14px', background:'#6366f1', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
        {saving?'...':'💾 Enregistrer'}
      </button>
    </div>
  )

  return (
    <AppShell title="Site Web & Portail" subtitle="Configuration publique" actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'20px 24px', maxWidth:'800px' }}>

        {/* Activation */}
        <div style={{ background:form.website_enabled?'#f0fdf4':'#f8fafc', border:`1px solid ${form.website_enabled?'#86efac':'#e2e8f0'}`, borderRadius:'12px', padding:'14px 18px', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:'600', color:form.website_enabled?'#059669':'#0f172a' }}>
              {form.website_enabled?'✅ Portail actif':'⏸ Portail désactivé'}
            </div>
            <div style={{ fontSize:'11px', color:'#64748b', marginTop:'2px' }}>{previewUrl}</div>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
            <span style={{ fontSize:'12px', color:'#64748b' }}>{form.website_enabled?'Actif':'Inactif'}</span>
            <div onClick={()=>setForm((p:any)=>({...p,website_enabled:!p.website_enabled}))}
              style={{ width:'44px', height:'24px', borderRadius:'12px', background:form.website_enabled?'#059669':'#cbd5e1', transition:'background 0.2s', cursor:'pointer', position:'relative' }}>
              <div style={{ position:'absolute', top:'2px', left:form.website_enabled?'22px':'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </label>
        </div>

        {/* Informazioni struttura */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'18px 20px', marginBottom:'16px' }}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'14px' }}>🏢 Informations de l'établissement</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            {[{k:'business_name',l:'Nom établissement'},{k:'city',l:'Ville'},{k:'address',l:'Adresse'},{k:'phone',l:'Téléphone'},{k:'email',l:'Email contact'}].map(f=>(
              <div key={f.k} style={{ gridColumn:f.k==='address'?'1/-1':'auto' }}>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'4px' }}>{f.l}</div>
                <input style={IS} value={form[f.k]||''} onChange={e=>setForm((p:any)=>({...p,[f.k]:e.target.value}))} />
              </div>
            ))}
          </div>
        </div>

        {/* Contenuto portale */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'18px 20px', marginBottom:'16px' }}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'14px' }}>✍️ Contenu du portail de réservation</div>
          <div style={{ marginBottom:'12px' }}>
            <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'4px' }}>Message de bienvenue</div>
            <input style={IS} value={form.welcome_message||''} onChange={e=>setForm((p:any)=>({...p,welcome_message:e.target.value}))} placeholder="Bienvenue à l'Hôtel Les Oliviers..." />
          </div>
          <div>
            <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'4px' }}>À propos (optionnel)</div>
            <textarea value={form.about_text||''} onChange={e=>setForm((p:any)=>({...p,about_text:e.target.value}))} style={{ ...IS, height:'80px', resize:'vertical' }} placeholder="Présentation de votre établissement..." />
          </div>
        </div>

        {/* Couleur et réseaux */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'18px 20px' }}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'14px' }}>🎨 Personnalisation & Réseaux</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'12px' }}>
            <div>
              <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'4px' }}>Couleur principale</div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <input type="color" value={form.primary_color||'#1a1a1a'} onChange={e=>setForm((p:any)=>({...p,primary_color:e.target.value}))} style={{ width:'40px', height:'32px', border:'1px solid #e2e8f0', borderRadius:'6px', cursor:'pointer' }} />
                <input style={{ ...IS, flex:1 }} value={form.primary_color||''} onChange={e=>setForm((p:any)=>({...p,primary_color:e.target.value}))} />
              </div>
            </div>
            {[{k:'facebook_url',l:'Facebook URL',p:'https://facebook.com/...'},{k:'instagram_url',l:'Instagram URL',p:'https://instagram.com/...'},{k:'google_maps_url',l:'Google Maps URL',p:'https://maps.google.com/...'}].map(f=>(
              <div key={f.k}>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'4px' }}>{f.l}</div>
                <input style={IS} value={form[f.k]||''} onChange={e=>setForm((p:any)=>({...p,[f.k]:e.target.value}))} placeholder={f.p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
