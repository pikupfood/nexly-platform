'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

const DEPT_COLOR: Record<string,string> = { hotel:'#2563eb', restaurant:'#059669', spa:'#7c3aed', padel:'#d97706', reception:'#0891b2', cleaning:'#78716c', maintenance:'#f59e0b', other:'#94a3b8' }
const PERIODS = [
  { key:'day',   label:"Aujourd'hui" },
  { key:'week',  label:'Cette semaine' },
  { key:'month', label:'Ce mois' },
]

export default function FeuillesTempsPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [staff, setStaff] = useState<any[]>([])
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [period, setPeriod] = useState('week')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ staff_id:'', date:new Date().toISOString().split('T')[0], start_time:'08:00', end_time:'17:00', break_minutes:60, department:'restaurant', description:'' })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(tn); setTenantId(tn?.id||null)
      const { data: st } = await supabase.from('staff_accounts').select('id,first_name,last_name,role').eq('is_active',true).order('first_name')
      setStaff(st||[])
      load(tn?.id, period)
    })
  }, [])

  const load = async (tid: string|null = tenantId, p: string = period) => {
    if (!tid) return
    setLoading(true)
    const [tsRes, sumRes] = await Promise.all([
      supabase.from('timesheets').select('*, staff:staff_accounts(first_name,last_name,role)').order('date', { ascending:false }).limit(50),
      supabase.rpc('get_timesheet_summary', { p_tenant_id: tid, p_period: p, p_date: new Date().toISOString().split('T')[0] })
    ])
    setTimesheets(tsRes.data||[])
    setSummary(sumRes.data)
    setLoading(false)
  }

  const changePeriod = (p: string) => { setPeriod(p); load(tenantId, p) }

  const save = async () => {
    if (!form.staff_id||!tenantId) return
    setSaving(true)
    const { error } = await supabase.from('timesheets').insert([{ ...form, tenant_id:tenantId, break_minutes:Number(form.break_minutes) }])
    if (!error) { await load(); setShowForm(false); setForm({ staff_id:'', date:new Date().toISOString().split('T')[0], start_time:'08:00', end_time:'17:00', break_minutes:60, department:'restaurant', description:'' }) }
    else alert(error.message)
    setSaving(false)
  }

  const validate = async (id: string) => {
    await supabase.from('timesheets').update({ status:'validated', validated_at:new Date().toISOString() }).eq('id', id)
    setTimesheets(p=>p.map(t=>t.id===id?{...t,status:'validated'}:t))
  }

  const IS: any = { padding:'8px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }

  const actions = (
    <div style={{ display:'flex', gap:'6px' }}>
      {PERIODS.map(p=>(
        <button key={p.key} onClick={()=>changePeriod(p.key)} style={{ padding:'6px 12px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'600', background:period===p.key?'#0891b2':'white', color:period===p.key?'white':'#64748b', outline:`1px solid ${period===p.key?'#0891b2':'#e2e8f0'}` }}>
          {p.label}
        </button>
      ))}
      <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'6px 14px', background:'#0891b2', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
        + Saisie
      </button>
    </div>
  )

  return (
    <AppShell title="Feuilles de temps" subtitle="Suivi des heures travaillées" actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'16px 20px' }}>

        {/* Résumé période */}
        {summary && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'10px', marginBottom:'20px' }}>
            {[
              { label:'Heures totales', value:`${Number(summary.total_hours||0).toFixed(1)}h`, color:'#0891b2', icon:'⏱️' },
              { label:'Jours travaillés', value:summary.total_days||0, color:'#059669', icon:'📅' },
              { label:'Collaborateurs', value:summary.staff_count||0, color:'#7c3aed', icon:'👥' },
              { label:'Moy. par pers.', value:summary.staff_count>0?`${(summary.total_hours/summary.staff_count).toFixed(1)}h`:'—', color:'#d97706', icon:'📊' },
            ].map(k=>(
              <div key={k.label} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px', borderTop:`3px solid ${k.color}` }}>
                <div style={{ fontSize:'20px', marginBottom:'6px' }}>{k.icon}</div>
                <div style={{ fontSize:'22px', fontWeight:'700', color:k.color, lineHeight:1 }}>{k.value}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'3px' }}>{k.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
          {/* Heures par personne */}
          {summary?.by_staff?.length > 0 && (
            <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 18px' }}>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>👤 Par collaborateur</div>
              {summary.by_staff.map((s:any)=>(
                <div key={s.staff_id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:'600', color:'#0f172a' }}>{s.first_name} {s.last_name}</div>
                    <div style={{ fontSize:'10px', color:'#94a3b8' }}>{s.days} jours</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div style={{ width:`${Math.min(100,(s.hours/40)*100)}px`, height:'6px', background:'#e2e8f0', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min(100,(s.hours/40)*100)}%`, background:'#0891b2', borderRadius:'3px' }} />
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:'700', color:'#0891b2', minWidth:'40px', textAlign:'right' }}>{s.hours}h</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Heures par département */}
          {summary?.by_department?.length > 0 && (
            <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 18px' }}>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>🏢 Par département</div>
              {summary.by_department.map((d:any)=>{
                const c = DEPT_COLOR[d.department]||'#94a3b8'
                return (
                  <div key={d.department} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ fontSize:'12px', color:'#475569', fontWeight:'500' }}>
                      <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:c, display:'inline-block', marginRight:'6px' }}/>
                      {d.department}
                    </span>
                    <span style={{ fontSize:'13px', fontWeight:'700', color:c }}>{d.hours}h</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Form saisie */}
        {showForm && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>Nouvelle saisie d'heures</div>
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>
              <div style={{ flex:2, minWidth:'150px' }}>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Collaborateur *</div>
                <select style={{ ...IS, width:'100%' }} value={form.staff_id} onChange={e=>setForm(p=>({...p,staff_id:e.target.value}))}>
                  <option value="">Sélectionner...</option>
                  {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Date</div>
                <input type="date" style={IS} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Début</div>
                <input type="time" style={IS} value={form.start_time} onChange={e=>setForm(p=>({...p,start_time:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Fin</div>
                <input type="time" style={IS} value={form.end_time} onChange={e=>setForm(p=>({...p,end_time:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Pause (min)</div>
                <input type="number" style={{ ...IS, width:'70px' }} value={form.break_minutes} onChange={e=>setForm(p=>({...p,break_minutes:Number(e.target.value)}))} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Département</div>
                <select style={IS} value={form.department} onChange={e=>setForm(p=>({...p,department:e.target.value}))}>
                  {Object.keys(DEPT_COLOR).map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button onClick={save} disabled={!form.staff_id||saving} style={{ padding:'8px 16px', background:form.staff_id?'#0891b2':'#94a3b8', color:'white', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                {saving?'...':'✓ Enregistrer'}
              </button>
            </div>
            {/* Preview heures */}
            {form.start_time && form.end_time && (
              <div style={{ marginTop:'8px', fontSize:'12px', color:'#0891b2', fontWeight:'600' }}>
                ⏱️ Durée: {Math.max(0, (new Date(`2000-01-01T${form.end_time}`).getTime() - new Date(`2000-01-01T${form.start_time}`).getTime())/3600000 - form.break_minutes/60).toFixed(2)}h effectives
              </div>
            )}
          </div>
        )}

        {/* Liste timesheets */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                {['Collaborateur','Date','Horaires','Pause','Heures eff.','Département','Statut',''].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'#94a3b8', fontWeight:'600', letterSpacing:'0.03em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timesheets.length===0 ? (
                <tr><td colSpan={8} style={{ padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>Aucune saisie d'heures.</td></tr>
              ) : timesheets.map((ts,i)=>{
                const statusColor = ts.status==='validated'?'#059669':ts.status==='rejected'?'#dc2626':'#94a3b8'
                const deptColor = DEPT_COLOR[ts.department]||'#94a3b8'
                return (
                  <tr key={ts.id} style={{ borderBottom:i<timesheets.length-1?'1px solid #f1f5f9':'none' }}>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>{ts.staff?.first_name} {ts.staff?.last_name}</div>
                      <div style={{ fontSize:'10px', color:'#94a3b8' }}>{ts.staff?.role}</div>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:'12px', color:'#64748b' }}>{new Date(ts.date).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'})}</td>
                    <td style={{ padding:'10px 14px', fontSize:'12px', color:'#0f172a', fontFamily:'monospace' }}>{ts.start_time?.slice(0,5)} — {ts.end_time?.slice(0,5)||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:'12px', color:'#94a3b8' }}>{ts.break_minutes}min</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:'15px', fontWeight:'800', color:'#0891b2' }}>{ts.hours_worked?Number(ts.hours_worked).toFixed(2):'—'}h</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:'11px', background:`${deptColor}15`, color:deptColor, padding:'2px 7px', borderRadius:'6px', fontWeight:'600' }}>{ts.department}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:'11px', background:`${statusColor}15`, color:statusColor, padding:'2px 7px', borderRadius:'6px', fontWeight:'600' }}>
                        {ts.status==='validated'?'✓ Validé':ts.status==='rejected'?'✗ Refusé':'En attente'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      {ts.status==='open' && (
                        <button onClick={()=>validate(ts.id)} style={{ padding:'4px 9px', background:'#f0fdf4', color:'#059669', border:'1px solid #86efac', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>
                          ✓ Valider
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
