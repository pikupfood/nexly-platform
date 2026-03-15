'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

const PRIORITY_COLOR: Record<string,{label:string;color:string}> = { low:{label:'Basso',color:'#94a3b8'}, medium:{label:'Medio',color:'#f59e0b'}, high:{label:'Alto',color:'#f97316'}, urgent:{label:'🔴 URGENTE',color:'#dc2626'} }
const STATUS_COLOR: Record<string,{label:string;color:string}> = { open:{label:'Aperto',color:'#3b82f6'}, in_progress:{label:'In corso',color:'#f59e0b'}, completed:{label:'Completato',color:'#10b981'}, cancelled:{label:'Cancellato',color:'#94a3b8'} }
const CAT_ICON: Record<string,string> = { electrical:'⚡', plumbing:'🚰', hvac:'❄️', cleaning:'🧹', equipment:'⚙️', general:'🔧' }

export default function ManutenzionePage() {
  const router = useRouter()
  const { t } = useI18n()
  const [tasks, setTasks] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('open')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', location:'', category:'general', priority:'medium', due_date:'', assigned_to:'' })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(tn); setTenantId(tn?.id||null)
      const [taskRes, staffRes] = await Promise.all([
        supabase.from('maintenance_tasks').select('*').order('created_at', { ascending:false }),
        supabase.from('staff_accounts').select('id,first_name,last_name').eq('is_active',true),
      ])
      setTasks(taskRes.data||[]); setStaff(staffRes.data||[]); setLoading(false)
    })
  }, [])

  const save = async () => {
    if (!form.title||!tenantId) return
    setSaving(true)
    const { data, error } = await supabase.from('maintenance_tasks').insert([{ ...form, tenant_id:tenantId, assigned_to:form.assigned_to||null }]).select().single()
    if (!error&&data) { setTasks(prev=>[data,...prev]); setShowForm(false); setForm({ title:'', description:'', location:'', category:'general', priority:'medium', due_date:'', assigned_to:'' }) }
    setSaving(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const upd: any = { status, updated_at:new Date().toISOString() }
    if (status==='completed') upd.completed_at = new Date().toISOString()
    await supabase.from('maintenance_tasks').update(upd).eq('id', id)
    setTasks(prev=>prev.map(t=>t.id===id?{...t,...upd}:t))
  }

  const filtered = tasks.filter(t => filterStatus==='all' || t.status===filterStatus)
  const urgent = tasks.filter(t=>t.priority==='urgent'&&t.status==='open').length
  const IS: any = { padding:'7px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'12px', outline:'none', boxSizing:'border-box' }

  const actions = (
    <div style={{ display:'flex', gap:'6px' }}>
      {urgent>0&&<span style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'7px', padding:'5px 10px', fontSize:'11px', fontWeight:'700' }}>🔴 {urgent} urgenti</span>}
      <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'7px 14px', background:'#f59e0b', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>+ Intervento</button>
    </div>
  )

  return (
    <AppShell title="Manutenzione" subtitle={`${tasks.filter(t=>t.status==='open').length} aperti`} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'16px 20px' }}>
        {showForm&&(
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>Nuovo intervento</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:'10px', marginBottom:'10px' }}>
              {[{k:'title',l:'Titolo *',p:'Guasto pompa piscina'},{k:'location',l:'Posizione',p:'Camera 12, Cucina...'},{k:'description',l:'Descrizione',p:'Dettagli...'}].map(f=>(
                <div key={f.k} style={{ gridColumn:f.k==='description'?'1/-1':'auto' }}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>{f.l}</div>
                  <input style={{ ...IS, width:'100%' }} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} />
                </div>
              ))}
              {[{k:'category',l:'Categoria',opts:Object.keys(CAT_ICON)},{k:'priority',l:'Priorità',opts:Object.keys(PRIORITY_COLOR)}].map(f=>(
                <div key={f.k}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>{f.l}</div>
                  <select style={{ ...IS, width:'100%' }} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}>
                    {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Assegna a</div>
                <select style={{ ...IS, width:'100%' }} value={form.assigned_to} onChange={e=>setForm(p=>({...p,assigned_to:e.target.value}))}>
                  <option value="">Non assegnato</option>
                  {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Scadenza</div>
                <input type="date" style={{ ...IS, width:'100%' }} value={form.due_date} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))} />
              </div>
            </div>
            <button onClick={save} disabled={!form.title||saving} style={{ padding:'8px 18px', background:form.title?'#f59e0b':'#94a3b8', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
              {saving?'...':'✓ Créer'}
            </button>
          </div>
        )}

        <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
          {['all','open','in_progress','completed'].map(s=>{
            const sc = s==='all'?{label:'Tutti',color:'#475569'}:STATUS_COLOR[s]
            return (
              <button key={s} onClick={()=>setFilterStatus(s)} style={{ padding:'6px 12px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'600',
                background:filterStatus===s?sc.color:'white', color:filterStatus===s?'white':'#64748b', outline:`1px solid ${filterStatus===s?sc.color:'#e2e8f0'}` }}>
                {sc.label} ({s==='all'?tasks.length:tasks.filter(t=>t.status===s).length})
              </button>
            )
          })}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {filtered.map(task=>{
            const pr = PRIORITY_COLOR[task.priority]||PRIORITY_COLOR.medium
            const st = STATUS_COLOR[task.status]||STATUS_COLOR.open
            const assignedStaff = staff.find(s=>s.id===task.assigned_to)
            return (
              <div key={task.id} style={{ background:'white', border:`1px solid ${pr.color}30`, borderLeft:`4px solid ${pr.color}`, borderRadius:'10px', padding:'14px 16px', display:'flex', gap:'14px', alignItems:'flex-start' }}>
                <div style={{ fontSize:'20px', flexShrink:0 }}>{CAT_ICON[task.category]||'🔧'}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <span style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a' }}>{task.title}</span>
                    <span style={{ background:`${pr.color}15`, color:pr.color, padding:'1px 7px', borderRadius:'6px', fontSize:'10px', fontWeight:'700' }}>{pr.label}</span>
                    <span style={{ background:`${st.color}15`, color:st.color, padding:'1px 7px', borderRadius:'6px', fontSize:'10px', fontWeight:'700' }}>{st.label}</span>
                  </div>
                  {task.description&&<div style={{ fontSize:'12px', color:'#64748b', marginBottom:'4px' }}>{task.description}</div>}
                  <div style={{ display:'flex', gap:'12px', fontSize:'11px', color:'#94a3b8', flexWrap:'wrap' }}>
                    {task.location&&<span>📍 {task.location}</span>}
                    {assignedStaff&&<span>👤 {assignedStaff.first_name} {assignedStaff.last_name}</span>}
                    {task.due_date&&<span>📅 {task.due_date}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  {task.status==='open'&&<button onClick={()=>updateStatus(task.id,'in_progress')} style={{ padding:'5px 10px', background:'#fffbeb', color:'#d97706', border:'1px solid #fcd34d', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>▶ Inizia</button>}
                  {task.status==='in_progress'&&<button onClick={()=>updateStatus(task.id,'completed')} style={{ padding:'5px 10px', background:'#f0fdf4', color:'#059669', border:'1px solid #86efac', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>✓ Completa</button>}
                </div>
              </div>
            )
          })}
          {filtered.length===0&&<div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>Nessun intervento {filterStatus!=='all'?`con status "${filterStatus}"`:''}</div>}
        </div>
      </div>
    </AppShell>
  )
}
