'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

export default function SondagesPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [surveys, setSurveys] = useState<any[]>([])
  const [responses, setResponses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', type:'satisfaction', description:'', status:'draft' })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)
  const [selected, setSelected] = useState<string|null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(tn); setTenantId(tn?.id||null)
      const { data } = await supabase.from('surveys').select('*').order('created_at', { ascending:false })
      setSurveys(data||[]); setLoading(false)
    })
  }, [])

  const loadResponses = async (surveyId: string) => {
    setSelected(surveyId)
    const { data } = await supabase.from('survey_responses').select('*').eq('survey_id', surveyId).order('created_at', { ascending:false })
    setResponses(data||[])
  }

  const save = async () => {
    if (!form.title||!tenantId) return
    setSaving(true)
    const { data, error } = await supabase.from('surveys').insert([{ ...form, tenant_id:tenantId }]).select().single()
    if (!error&&data) { setSurveys(p=>[data,...p]); setShowForm(false) }
    setSaving(false)
  }

  const toggle = async (id: string, currentStatus: string) => {
    const ns = currentStatus==='active'?'closed':'active'
    await supabase.from('surveys').update({ status:ns }).eq('id', id)
    setSurveys(p=>p.map(s=>s.id===id?{...s,status:ns}:s))
  }

  const avgNPS = responses.filter(r=>r.score!=null).length > 0
    ? (responses.reduce((s,r)=>s+Number(r.score||0),0)/responses.filter(r=>r.score!=null).length).toFixed(1)
    : null

  const IS: any = { padding:'8px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }

  const actions = (
    <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'7px 14px', background:'#059669', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
      + Sondage
    </button>
  )

  const TYPE_ICON: Record<string,string> = { satisfaction:'😊', nps:'⭐', custom:'📝', checkout:'🏨' }
  const ST_COLOR: Record<string,string> = { draft:'#94a3b8', active:'#059669', closed:'#64748b' }

  return (
    <AppShell title="Sondages & Satisfaction" subtitle={`${surveys.length} sondages`} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:selected?'1fr 1fr':'1fr', gap:'16px' }}>
        <div>
          {showForm && (
            <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>Nouveau sondage</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <div><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Titre *</div><input style={{ ...IS, width:'100%' }} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Satisfaction client — Mai 2026" /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  <div><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Type</div>
                    <select style={{ ...IS, width:'100%' }} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                      <option value="satisfaction">😊 Satisfaction</option>
                      <option value="nps">⭐ NPS</option>
                      <option value="checkout">🏨 Post check-out</option>
                      <option value="custom">📝 Personnalisé</option>
                    </select>
                  </div>
                </div>
                <div><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Description</div><input style={{ ...IS, width:'100%' }} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Évaluez votre séjour..." /></div>
              </div>
              <button onClick={save} disabled={!form.title||saving} style={{ marginTop:'12px', padding:'8px 18px', background:form.title?'#059669':'#94a3b8', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                {saving?'...':'✓ Créer'}
              </button>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {surveys.length===0?(
              <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>
                Créez votre premier sondage pour recueillir des avis clients.
              </div>
            ):surveys.map(s=>{
              const sc = ST_COLOR[s.status]||'#94a3b8'
              return (
                <div key={s.id} style={{ background:'white', border:`1px solid ${selected===s.id?'#059669':'#e2e8f0'}`, borderRadius:'12px', padding:'14px 18px', cursor:'pointer', transition:'border-color 0.15s' }}
                  onClick={()=>loadResponses(s.id)}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a' }}>{TYPE_ICON[s.type]} {s.title}</div>
                      {s.description&&<div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>{s.description}</div>}
                      <div style={{ display:'flex', gap:'10px', marginTop:'8px', fontSize:'11px', color:'#94a3b8' }}>
                        <span>📬 {s.responses_count||0} réponses</span>
                        {s.avg_score&&<span>⭐ {Number(s.avg_score).toFixed(1)}/10</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <span style={{ background:`${sc}15`, color:sc, padding:'3px 8px', borderRadius:'8px', fontSize:'10px', fontWeight:'700' }}>{s.status}</span>
                      <button onClick={e=>{e.stopPropagation();toggle(s.id,s.status)}} style={{ padding:'4px 10px', background:s.status==='active'?'#fef2f2':'#f0fdf4', color:s.status==='active'?'#dc2626':'#059669', border:`1px solid ${s.status==='active'?'#fecaca':'#86efac'}`, borderRadius:'6px', cursor:'pointer', fontSize:'10px', fontWeight:'600' }}>
                        {s.status==='active'?'⏸ Fermer':'▶ Activer'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Réponses */}
        {selected && (
          <div>
            <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>Réponses ({responses.length})</div>
                {avgNPS && <span style={{ fontSize:'16px', fontWeight:'800', color:'#059669' }}>Moy. {avgNPS}/10</span>}
              </div>
              {responses.length===0 ? (
                <div style={{ textAlign:'center', color:'#cbd5e1', fontSize:'13px', padding:'30px 0' }}>Aucune réponse pour ce sondage.</div>
              ) : responses.map(r=>(
                <div key={r.id} style={{ padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <div style={{ fontSize:'12px', fontWeight:'600', color:'#0f172a' }}>{r.guest_name||'Anonyme'}</div>
                    {r.score&&<span style={{ fontSize:'14px', fontWeight:'800', color:'#059669' }}>{r.score}/10</span>}
                  </div>
                  {r.comment&&<div style={{ fontSize:'12px', color:'#64748b', marginTop:'4px', fontStyle:'italic' }}>"{r.comment}"</div>}
                  <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'4px' }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
