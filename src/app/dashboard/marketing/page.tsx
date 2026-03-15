'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

const STATUS_COLOR: Record<string,{label:string;color:string}> = {
  draft:     {label:'Brouillon', color:'#94a3b8'},
  scheduled: {label:'Planifiée', color:'#d97706'},
  sent:      {label:'Envoyée',   color:'#2563eb'},
  completed: {label:'Terminée', color:'#059669'},
  paused:    {label:'En pause',  color:'#f59e0b'},
}
const SEGMENT_LABELS: Record<string,string> = { all:'Tous', vip:'VIP', newsletter:'Newsletter', inactive:'Inactifs', birthday:'Anniversaires', new_leads:'Nouveaux leads' }

export default function MarketingPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', type:'email', subject:'', content:'', segment:'all', scheduled_at:'' })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(tn); setTenantId(tn?.id||null)
      const { data } = await supabase.from('marketing_campaigns').select('*').order('created_at', { ascending:false })
      setCampaigns(data||[]); setLoading(false)
    })
  }, [])

  const generateWithAI = async () => {
    if (!aiPrompt) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/support', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          messages:[{ role:'user', content:`Génère un email marketing professionnel pour un hôtel/établissement. Objectif: ${aiPrompt}. Retourne UNIQUEMENT: SUJET: [sujet]\n\nCONTENU: [contenu HTML simple en français, 150-200 mots]` }],
          tenantId, type:'support'
        })
      })
      const data = await res.json()
      const text = data.response||''
      const subjectMatch = text.match(/SUJET:\s*(.+)/i)
      const contentMatch = text.match(/CONTENU:\s*([\s\S]+)/i)
      if (subjectMatch) setForm(p=>({...p, subject:subjectMatch[1].trim()}))
      if (contentMatch) setForm(p=>({...p, content:contentMatch[1].trim()}))
    } catch {}
    setAiLoading(false)
  }

  const sendCampaign = async (id: string) => {
    // Conta i destinatari basandosi sul segmento
    const { data: contacts } = await supabase.from('crm_contacts').select('id,email', { count:'exact' })
      .neq('email', null).neq('email', '')
    const count = contacts?.length || 0
    await supabase.from('marketing_campaigns').update({
      status:'sent', sent_at:new Date().toISOString(), recipients_count:count
    }).eq('id', id)
    setCampaigns(p=>p.map(c=>c.id===id?{...c,status:'sent',recipients_count:count}:c))
    alert(`✅ Campagne marquée comme envoyée à ${count} contacts. Configurez votre service d'envoi (SendGrid, Mailchimp...) dans Paramètres pour l'envoi réel.`)
  }

  const save = async () => {
    if (!form.name||!tenantId) return
    setSaving(true)
    const { data, error } = await supabase.from('marketing_campaigns').insert([{ ...form, tenant_id:tenantId, status:'draft' }]).select().single()
    if (!error&&data) { setCampaigns(prev=>[data,...prev]); setShowForm(false); setForm({ name:'', type:'email', subject:'', content:'', segment:'all', scheduled_at:'' }) }
    setSaving(false)
  }

  const IS: any = { padding:'7px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'12px', outline:'none', boxSizing:'border-box' }

  const actions = (
    <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'7px 14px', background:'#e11d48', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
      + Campagne
    </button>
  )

  return (
    <AppShell title="Email Marketing" subtitle={`${campaigns.length} campagnes`} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'16px 20px' }}>
        {showForm&&(
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'18px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'14px' }}>Nouvelle campagne</div>

            {/* AI Generator */}
            <div style={{ background:'linear-gradient(135deg,#faf5ff,#f0f9ff)', border:'1px solid #e9d5ff', borderRadius:'10px', padding:'12px 14px', marginBottom:'14px' }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:'#7c3aed', marginBottom:'6px' }}>🤖 Générer avec NexlyAI</div>
              <div style={{ display:'flex', gap:'8px' }}>
                <input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="Ex: Promotion weekend spa, -20% pour les abonnés newsletter..."
                  style={{ ...IS, flex:1 }} onKeyDown={e=>e.key==='Enter'&&generateWithAI()} />
                <button onClick={generateWithAI} disabled={!aiPrompt||aiLoading} style={{ padding:'7px 14px', background:'#7c3aed', color:'white', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>
                  {aiLoading?'Génération...':'✨ Générer'}
                </button>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'10px', marginBottom:'12px' }}>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Nom campagne *</div>
                <input style={{ ...IS, width:'100%' }} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Promo Été 2026" />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Type</div>
                <select style={{ ...IS, width:'100%' }} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                  <option value="email">📧 Email</option>
                  <option value="sms">📱 SMS</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Segment</div>
                <select style={{ ...IS, width:'100%' }} value={form.segment} onChange={e=>setForm(p=>({...p,segment:e.target.value}))}>
                  {Object.entries(SEGMENT_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Planifier</div>
                <input type="datetime-local" style={{ ...IS, width:'100%' }} value={form.scheduled_at} onChange={e=>setForm(p=>({...p,scheduled_at:e.target.value}))} />
              </div>
            </div>
            <div style={{ marginBottom:'10px' }}>
              <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Objet email</div>
              <input style={{ ...IS, width:'100%' }} value={form.subject} onChange={e=>setForm(p=>({...p,subject:e.target.value}))} placeholder="🎁 Offre exclusive pour nos clients..." />
            </div>
            <div style={{ marginBottom:'14px' }}>
              <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Contenu</div>
              <textarea value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} style={{ ...IS, width:'100%', height:'100px', resize:'vertical' }} placeholder="Contenu de l'email..." />
            </div>
            <button onClick={()=>save()} disabled={!form.name||saving} style={{ padding:'8px 18px', background:form.name?'#e11d48':'#94a3b8', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
              {saving?'...':'💾 Enregistrer brouillon'}
            </button>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'12px' }}>
          {campaigns.length===0?(
            <div style={{ gridColumn:'1 / -1', background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'60px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>
              Aucune campagne. Créez votre première campagne marketing !
            </div>
          ):campaigns.map(c=>{
            const sc = STATUS_COLOR[c.status]||STATUS_COLOR.draft
            return (
              <div key={c.id} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a' }}>{c.name}</div>
                    <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>{c.type==='email'?'📧':'📱'} {SEGMENT_LABELS[c.segment]||c.segment}</div>
                  </div>
                  <span style={{ background:`${sc.color}15`, color:sc.color, padding:'3px 9px', borderRadius:'8px', fontSize:'10px', fontWeight:'700' }}>{sc.label}</span>
                </div>
                {c.subject&&<div style={{ fontSize:'12px', color:'#475569', marginBottom:'8px', fontStyle:'italic' }}>"{c.subject}"</div>}
                {c.recipients_count>0&&(
                  <div style={{ display:'flex', gap:'12px', fontSize:'11px', color:'#94a3b8' }}>
                    <span>📤 {c.recipients_count} envois</span>
                    {c.opens_count>0&&<span>👁️ {Math.round(c.opens_count/c.recipients_count*100)}% ouvertures</span>}
                  </div>
                )}
                {/* Boutons d'action */}
                <div style={{ display:'flex', gap:'6px', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #f1f5f9' }}>
                  {(c.status==='draft'||c.status==='scheduled') && (
                    <button onClick={()=>sendCampaign(c.id)} style={{ flex:1, padding:'7px', background:'#e11d48', color:'white', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'12px', fontWeight:'700' }}>
                      🚀 Envoyer maintenant
                    </button>
                  )}
                  {c.status==='sent'&&<div style={{ fontSize:'11px', color:'#059669', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px' }}>✅ Envoyée le {c.sent_at?new Date(c.sent_at).toLocaleDateString('fr-FR'):'—'}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
