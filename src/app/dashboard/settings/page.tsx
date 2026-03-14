'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const IS: any = { width:'100%', padding:'10px 14px', background:'#0a0a0f', border:'1px solid #2a2a3a', borderRadius:'8px', color:'#f1f1f1', fontSize:'14px', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }
const LS: any = { display:'block', fontSize:'12px', fontWeight:500, color:'#9ca3af', marginBottom:'6px' }

export default function SettingsPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    business_name: '', phone: '', website: '', welcome_message: '',
    legal_name: '', siret: '', vat_number: '', address: '', city: '', postal_code: '', country: 'FR'
  })

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      const { data: t } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      if (t) {
        setTenant(t)
        setForm({
          business_name: t.business_name || '',
          phone: t.phone || '',
          website: t.website || '',
          welcome_message: t.welcome_message || '',
          legal_name: t.legal_name || '',
          siret: t.siret || '',
          vat_number: t.vat_number || '',
          address: t.address || '',
          city: t.city || '',
          postal_code: t.postal_code || '',
          country: t.country || 'FR',
        })
      }
    })
  }, [])

  const save = async () => {
    if (!tenant) return
    setSaving(true)
    await supabase.from('tenants').update(form).eq('id', tenant.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!tenant) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#6b7280', fontSize:'14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ borderBottom:'1px solid #1f2030', padding:'16px 32px', display:'flex', alignItems:'center', gap:'16px' }}>
        <Link href="/dashboard" style={{ fontSize:'13px', color:'#6b7280', textDecoration:'none' }}>← Dashboard</Link>
        <span style={{ color:'#2a2a3a' }}>|</span>
        <span style={{ fontSize:'16px', fontWeight:'600', color:'#f1f1f1' }}>⚙️ Paramètres</span>
      </div>

      <div style={{ maxWidth:'680px', margin:'0 auto', padding:'40px 24px 80px' }}>

        {/* Structure */}
        <div style={{ background:'#111118', border:'1px solid #1f2030', borderRadius:'16px', padding:'28px', marginBottom:'20px' }}>
          <div style={{ fontSize:'15px', fontWeight:'600', color:'#f1f1f1', marginBottom:'20px' }}>🏢 Votre structure</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div><label style={LS}>Nom de l'établissement *</label><input style={IS} value={form.business_name} onChange={e => setForm(p=>({...p,business_name:e.target.value}))} placeholder="Hôtel Le Grand" /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={LS}>Téléphone</label><input style={IS} value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))} /></div>
              <div><label style={LS}>Site web</label><input style={IS} value={form.website} onChange={e => setForm(p=>({...p,website:e.target.value}))} /></div>
            </div>
            <div><label style={LS}>Message d'accueil (portail clients)</label><textarea style={{ ...IS, height:'80px', resize:'vertical' as const }} value={form.welcome_message} onChange={e => setForm(p=>({...p,welcome_message:e.target.value}))} placeholder="Bienvenue ! Réservez en ligne..." /></div>
          </div>
        </div>

        {/* Facturation */}
        <div style={{ background:'#111118', border:'1px solid #1f2030', borderRadius:'16px', padding:'28px', marginBottom:'20px' }}>
          <div style={{ fontSize:'15px', fontWeight:'600', color:'#f1f1f1', marginBottom:'20px' }}>🧾 Informations de facturation</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div><label style={LS}>Raison sociale *</label><input style={IS} value={form.legal_name} onChange={e => setForm(p=>({...p,legal_name:e.target.value}))} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={LS}>SIRET</label><input style={IS} value={form.siret} onChange={e => setForm(p=>({...p,siret:e.target.value}))} /></div>
              <div><label style={LS}>N° TVA</label><input style={IS} value={form.vat_number} onChange={e => setForm(p=>({...p,vat_number:e.target.value}))} /></div>
            </div>
            <div><label style={LS}>Adresse</label><input style={IS} value={form.address} onChange={e => setForm(p=>({...p,address:e.target.value}))} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px' }}>
              <div><label style={LS}>Ville</label><input style={IS} value={form.city} onChange={e => setForm(p=>({...p,city:e.target.value}))} /></div>
              <div><label style={LS}>Code postal</label><input style={IS} value={form.postal_code} onChange={e => setForm(p=>({...p,postal_code:e.target.value}))} /></div>
              <div><label style={LS}>Pays</label>
                <select style={IS} value={form.country} onChange={e => setForm(p=>({...p,country:e.target.value}))}>
                  <option value="FR">France</option><option value="BE">Belgique</option>
                  <option value="CH">Suisse</option><option value="MC">Monaco</option><option value="IT">Italie</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Portail */}
        {tenant.booking_url && (
          <div style={{ background:'#111118', border:'1px solid #1f2030', borderRadius:'16px', padding:'24px', marginBottom:'20px' }}>
            <div style={{ fontSize:'15px', fontWeight:'600', color:'#f1f1f1', marginBottom:'12px' }}>🌐 Portail de réservation</div>
            <div style={{ background:'#0a0a0f', border:'1px solid #2a2a3a', borderRadius:'8px', padding:'10px 14px', fontSize:'12px', fontFamily:'monospace', color:'#9ca3af', marginBottom:'12px' }}>{tenant.booking_url}</div>
            <button onClick={() => navigator.clipboard?.writeText(tenant.booking_url)} style={{ padding:'8px 16px', background:'#1f2030', color:'#9ca3af', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>📋 Copier le lien</button>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={save} disabled={saving} style={{ padding:'12px 32px', background: saved ? '#059669' : '#3b82f6', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>
            {saved ? '✓ Enregistré !' : saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
