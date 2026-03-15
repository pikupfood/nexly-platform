'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

const DEPT_COLOR: Record<string,string> = { hotel:'#2563eb', restaurant:'#059669', spa:'#7c3aed', padel:'#d97706', reception:'#0891b2', cleaning:'#78716c', maintenance:'#f59e0b', other:'#94a3b8' }
const DEPT_ICON: Record<string,string> = { hotel:'🏨', restaurant:'🍽️', spa:'💆', padel:'🎾', reception:'🛎️', cleaning:'🧹', maintenance:'🔧', other:'👤' }
const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

export default function PlanningPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [staff, setStaff] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); const day = d.getDay()
    const mon = new Date(d); mon.setDate(d.getDate() - (day===0?6:day-1))
    return mon.toISOString().split('T')[0]
  })
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [form, setForm] = useState({ staff_id:'', date:'', start_time:'08:00', end_time:'16:00', department:'restaurant', role:'' })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(tn); setTenantId(tn?.id||null)
      load()
    })
  }, [weekStart])

  const getWeekDates = () => {
    const dates = []
    for (let i=0; i<7; i++) {
      const d = new Date(weekStart); d.setDate(d.getDate()+i)
      dates.push(d.toISOString().split('T')[0])
    }
    return dates
  }

  const load = async () => {
    const weekEnd = getWeekDates()[6]
    const [staffRes, shiftsRes, leavesRes] = await Promise.all([
      supabase.from('staff_accounts').select('*').eq('is_active', true).order('first_name'),
      supabase.from('staff_shifts').select('*').gte('date', weekStart).lte('date', weekEnd),
      supabase.from('staff_leaves').select('*').neq('status','rejected').or(`start_date.lte.${weekEnd},end_date.gte.${weekStart}`),
    ])
    setStaff(staffRes.data||[])
    setShifts(shiftsRes.data||[])
    setLeaves(leavesRes.data||[])
    setLoading(false)
  }

  const saveShift = async () => {
    if (!form.staff_id || !form.date || !tenantId) return
    setSaving(true)
    const { error } = await supabase.from('staff_shifts').insert([{ ...form, tenant_id: tenantId }])
    if (!error) { await load(); setShowShiftForm(false); setForm({ staff_id:'', date:'', start_time:'08:00', end_time:'16:00', department:'restaurant', role:'' }) }
    setSaving(false)
  }

  const moveWeek = (delta: number) => {
    const d = new Date(weekStart); d.setDate(d.getDate()+delta*7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const weekDates = getWeekDates()
  const IS: any = { padding:'7px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'12px', outline:'none', boxSizing:'border-box' }

  const actions = (
    <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
      <button onClick={()=>moveWeek(-1)} style={{ padding:'5px 10px', background:'white', border:'1px solid #e2e8f0', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>←</button>
      <span style={{ fontSize:'12px', color:'#64748b', fontWeight:'500' }}>
        {new Date(weekStart).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – {new Date(weekDates[6]).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
      </span>
      <button onClick={()=>moveWeek(1)} style={{ padding:'5px 10px', background:'white', border:'1px solid #e2e8f0', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }}>→</button>
      <button onClick={()=>setShowShiftForm(v=>!v)} style={{ padding:'7px 14px', background:'#0891b2', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>+ Turno</button>
    </div>
  )

  return (
    <AppShell title="Planning Staff" subtitle={`${staff.length} collaborateurs`} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'16px 20px', overflowX:'auto' }}>

        {/* Form turno */}
        {showShiftForm && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>Nuovo turno</div>
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Staff</div>
                <select style={{ ...IS, width:'160px' }} value={form.staff_id} onChange={e=>setForm(p=>({...p,staff_id:e.target.value}))}>
                  <option value="">Seleziona...</option>
                  {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Data</div>
                <input type="date" style={IS} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Inizio</div>
                <input type="time" style={IS} value={form.start_time} onChange={e=>setForm(p=>({...p,start_time:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Fine</div>
                <input type="time" style={IS} value={form.end_time} onChange={e=>setForm(p=>({...p,end_time:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Reparto</div>
                <select style={IS} value={form.department} onChange={e=>setForm(p=>({...p,department:e.target.value}))}>
                  {Object.keys(DEPT_COLOR).map(d=><option key={d} value={d}>{DEPT_ICON[d]} {d}</option>)}
                </select>
              </div>
              <button onClick={saveShift} disabled={!form.staff_id||!form.date||saving} style={{ padding:'7px 16px', background:form.staff_id&&form.date?'#0891b2':'#94a3b8', color:'white', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                {saving?'...':'✓ Salva'}
              </button>
            </div>
          </div>
        )}

        {/* Griglia planning */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden', minWidth:'700px' }}>
          {/* Header giorni */}
          <div style={{ display:'grid', gridTemplateColumns:'160px repeat(7,1fr)', borderBottom:'2px solid #e2e8f0' }}>
            <div style={{ padding:'10px 14px', background:'#f8fafc', borderRight:'1px solid #e2e8f0' }}>
              <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', letterSpacing:'0.05em' }}>COLLABORATEUR</span>
            </div>
            {weekDates.map((date,i)=>{
              const today = new Date().toISOString().split('T')[0]
              return (
                <div key={date} style={{ padding:'8px', textAlign:'center', background:date===today?'#eff6ff':'#f8fafc', borderRight:i<6?'1px solid #e2e8f0':'none' }}>
                  <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'600' }}>{DAYS[i]}</div>
                  <div style={{ fontSize:'13px', fontWeight:date===today?'700':'400', color:date===today?'#2563eb':'#0f172a', marginTop:'1px' }}>
                    {new Date(date).getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Righe staff */}
          {staff.length===0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>Aucun collaborateur. Invitez votre équipe depuis la section Staff.</div>
          ) : staff.map((s,si)=>(
            <div key={s.id} style={{ display:'grid', gridTemplateColumns:'160px repeat(7,1fr)', borderBottom:si<staff.length-1?'1px solid #f1f5f9':'none' }}>
              <div style={{ padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px', borderRight:'1px solid #f1f5f9', background:'#fafbff' }}>
                <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', color:'#2563eb', flexShrink:0 }}>
                  {s.first_name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:'600', color:'#0f172a' }}>{s.first_name}</div>
                  <div style={{ fontSize:'10px', color:'#94a3b8' }}>{s.role}</div>
                </div>
              </div>
              {weekDates.map((date,di)=>{
                const dayShifts = shifts.filter(sh=>sh.staff_id===s.id&&sh.date===date)
                const onLeave = leaves.some(l=>l.staff_id===s.id&&l.start_date<=date&&l.end_date>=date)
                return (
                  <div key={date} style={{ padding:'4px', borderRight:di<6?'1px solid #f1f5f9':'none', minHeight:'52px', background:onLeave?'#fff7ed':'white' }}>
                    {onLeave && <div style={{ background:'#fed7aa', color:'#c2410c', borderRadius:'4px', padding:'2px 5px', fontSize:'9px', fontWeight:'700', textAlign:'center', marginBottom:'2px' }}>CONGÉ</div>}
                    {dayShifts.map(sh=>(
                      <div key={sh.id} style={{ background:`${DEPT_COLOR[sh.department]||'#94a3b8'}15`, border:`1px solid ${DEPT_COLOR[sh.department]||'#94a3b8'}30`, borderRadius:'5px', padding:'2px 5px', marginBottom:'2px', cursor:'pointer' }}
                        title={`${sh.start_time?.slice(0,5)}-${sh.end_time?.slice(0,5)}`}>
                        <div style={{ fontSize:'10px', fontWeight:'700', color:DEPT_COLOR[sh.department]||'#94a3b8' }}>
                          {DEPT_ICON[sh.department]} {sh.start_time?.slice(0,5)}-{sh.end_time?.slice(0,5)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legenda reparti */}
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginTop:'12px' }}>
          {Object.entries(DEPT_COLOR).map(([d,c])=>(
            <span key={d} style={{ fontSize:'11px', display:'flex', alignItems:'center', gap:'4px', color:'#64748b' }}>
              <span style={{ width:'10px', height:'10px', borderRadius:'3px', background:c, display:'inline-block' }}/>
              {DEPT_ICON[d]} {d}
            </span>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
