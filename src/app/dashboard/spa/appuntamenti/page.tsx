'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useStaffNav } from '@/lib/useStaffNav'
import PaymentModal from '@/components/PaymentModal'
import { autoGenerateInvoice } from '@/lib/autoInvoice'

const SC: Record<string,{label:string;color:string}> = {
  confirmed:   { label:'Confermato',  color:'#3b82f6' },
  in_progress: { label:'In corso',    color:'#f59e0b' },
  completed:   { label:'Completato',  color:'#10b981' },
  cancelled:   { label:'Cancellato',  color:'#ef4444' },
  no_show:     { label:'No show',     color:'#7c3aed' },
}

export default function SpaAppuntamentiPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const [appointments, setAppointments] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('upcoming')
  const [catFilter, setCatFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paymentModal, setPaymentModal] = useState<any>(null)
  const [updating, setUpdating] = useState<string|null>(null)
  const today = new Date().toISOString().split('T')[0]
  const defaultTime = new Date(); defaultTime.setMinutes(0); const defT = defaultTime.toTimeString().slice(0,5)

  const FORM_EMPTY = { guest_name:'', guest_phone:'', guest_email:'', service_id:'', staff_id:'', date:today, time:defT, notes:'' }
  const [form, setForm] = useState<any>(FORM_EMPTY)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [])

  const load = async () => {
    const [aRes, sRes, stRes] = await Promise.all([
      supabase.from('spa_appointments').select('*, service:spa_services(name,duration_minutes,category,price), staff:spa_staff(name)').order('date', { ascending:false }).order('time'),
      supabase.from('spa_services').select('*').eq('is_active', true).order('category').order('sort_order'),
      supabase.from('spa_staff').select('*').eq('is_active', true).order('name'),
    ])
    setAppointments(aRes.data||[])
    setServices(sRes.data||[])
    setStaff(stRes.data||[])
    setLoading(false)
  }

  const saveAppt = async () => {
    if (!form.guest_name || !form.service_id || !form.date) return
    setSaving(true)
    const svc = services.find(s => s.id === form.service_id)
    const { data, error } = await supabase.from('spa_appointments').insert([{
      ...form, price:svc?.price||0, status:'confirmed'
    }]).select('*, service:spa_services(name,duration_minutes,category,price), staff:spa_staff(name)').single()
    if (!error && data) {
      setAppointments(prev => [data, ...prev])
      setShowForm(false)
      setForm(FORM_EMPTY)
    } else if (error) alert('Erreur: ' + error.message)
    setSaving(false)
  }

  const updateStatus = async (id: string, newStatus: string) => {
    const appt = appointments.find(a => a.id === id)
    if (newStatus === 'completed') { setPaymentModal({ id, appt }); return }
    setUpdating(id)
    await supabase.from('spa_appointments').update({ status:newStatus }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id===id ? {...a, status:newStatus} : a))
    setUpdating(null)
  }

  const handlePayment = async (payment: any) => {
    if (!paymentModal) return
    const { id, appt } = paymentModal
    setPaymentModal(null)
    setUpdating(id)
    await supabase.from('spa_appointments').update({ status:'completed', payment_method:payment.method, payment_note:payment.note||null, is_complimentary:payment.isComplimentary }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id===id ? {...a, status:'completed'} : a))
    if (appt) await autoGenerateInvoice({ source:'spa', sourceId:id, clientFirstName:appt.guest_name||'Cliente', clientLastName:'', clientEmail:appt.guest_email, clientPhone:appt.guest_phone, items:[{ description:appt.service?.name||'Trattamento spa', quantity:1, unit_price:Number(appt.price||0), tax_rate:10 }], taxRate:10, paymentMethod:payment.method, paymentNote:payment.note, isComplimentary:payment.isComplimentary, router })
    setUpdating(null)
  }

  const deleteAppt = async (id: string) => {
    if (!confirm('Cancellare questo appuntamento?')) return
    await supabase.from('spa_appointments').update({ status:'cancelled' }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id===id ? {...a, status:'cancelled'} : a))
  }

  const cats = [...new Set(services.map(s => s.category).filter(Boolean))]
  const filtered = appointments.filter(a => {
    const matchFilter = filter==='all' || (filter==='upcoming' && a.date>=today && ['confirmed','in_progress'].includes(a.status)) || (filter==='today' && a.date===today) || (filter===a.status)
    const matchCat = catFilter==='all' || a.service?.category===catFilter
    const matchSearch = !search || a.guest_name?.toLowerCase().includes(search.toLowerCase()) || a.guest_email?.includes(search)
    return matchFilter && matchCat && matchSearch
  })

  const IS: any = { padding:'8px 10px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', width:'100%', boxSizing:'border-box', outline:'none' }
  const LS: any = { fontSize:'11px', color:'#94a3b8', marginBottom:'4px', display:'block' }

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight:'100vh', background:'white', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ borderBottom:'1px solid #e2e8f0', padding:'14px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'white', zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <Link href="/dashboard/spa" style={{ color:'#94a3b8', textDecoration:'none', fontSize:'13px' }}>← Spa</Link>
          <span style={{ color:'#2a2a3a' }}>|</span>
          <h1 style={{ fontSize:'17px', fontWeight:'600', color:'#0f172a', margin:0 }}>💆 Appuntamenti</h1>
        </div>
        <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'8px 16px', background:'#8b5cf6', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500' }}>
          {showForm ? '✕ Annulla' : '+ Nuovo appuntamento'}
        </button>
      </div>

      <div style={{ padding:'20px 24px' }}>
        {/* Form nuovo appuntamento */}
        {showForm && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'20px 24px', marginBottom:'20px' }}>
            <h3 style={{ color:'#0f172a', fontSize:'14px', fontWeight:'600', margin:'0 0 16px' }}>Nuovo appuntamento</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:'12px', marginBottom:'14px' }}>
              <div><label style={LS}>Nome cliente *</label><input style={IS} value={form.guest_name} onChange={e=>setForm((p:any)=>({...p,guest_name:e.target.value}))} placeholder="Mario Rossi" /></div>
              <div><label style={LS}>Telefono</label><input style={IS} value={form.guest_phone} onChange={e=>setForm((p:any)=>({...p,guest_phone:e.target.value}))} placeholder="+39..." /></div>
              <div><label style={LS}>Email</label><input style={IS} value={form.guest_email} onChange={e=>setForm((p:any)=>({...p,guest_email:e.target.value}))} placeholder="email@..." /></div>
              <div><label style={LS}>Servizio *</label>
                <select style={IS} value={form.service_id} onChange={e=>setForm((p:any)=>({...p,service_id:e.target.value}))}>
                  <option value="">Seleziona...</option>
                  {cats.map(cat => (
                    <optgroup key={cat} label={String(cat).toUpperCase()}>
                      {services.filter(s => s.category===cat).map(s => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min · €{s.price}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div><label style={LS}>Staff</label>
                <select style={IS} value={form.staff_id} onChange={e=>setForm((p:any)=>({...p,staff_id:e.target.value}))}>
                  <option value="">Qualsiasi</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label style={LS}>Data *</label><input type="date" style={IS} value={form.date} onChange={e=>setForm((p:any)=>({...p,date:e.target.value}))} /></div>
              <div><label style={LS}>Orario *</label><input type="time" style={IS} value={form.time} onChange={e=>setForm((p:any)=>({...p,time:e.target.value}))} /></div>
              <div><label style={LS}>Note</label><input style={IS} value={form.notes} onChange={e=>setForm((p:any)=>({...p,notes:e.target.value}))} placeholder="Allergie, preferenze..." /></div>
            </div>
            {form.service_id && (
              <div style={{ padding:'8px 12px', background:'#8b5cf620', border:'1px solid #8b5cf640', borderRadius:'8px', marginBottom:'12px', fontSize:'12px', color:'#a78bfa' }}>
                💆 {services.find(s=>s.id===form.service_id)?.name} · {services.find(s=>s.id===form.service_id)?.duration_minutes}min · <strong>€{services.find(s=>s.id===form.service_id)?.price}</strong>
              </div>
            )}
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={saveAppt} disabled={!form.guest_name||!form.service_id||!form.date||saving} style={{ padding:'8px 18px', background:form.guest_name&&form.service_id&&form.date?'#8b5cf6':'#374151', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                {saving ? 'Salvataggio...' : '✓ Conferma appuntamento'}
              </button>
            </div>
          </div>
        )}

        {/* Filtri */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cerca cliente..." style={{ padding:'7px 12px', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#0f172a', fontSize:'13px', outline:'none', width:'180px' }} />
          {['upcoming','today','all','confirmed','completed','cancelled'].map(f => (
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 12px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'12px', background:filter===f?'#8b5cf6':'#111118', color:filter===f?'white':'#9ca3af', outline:`1px solid ${filter===f?'#8b5cf6':'#1f2030'}` }}>
              {f==='upcoming'?'Prossimi':f==='today'?'Oggi':f==='all'?'Tutti':SC[f]?.label||f}
            </button>
          ))}
          {cats.length > 0 && (
            <div style={{ display:'flex', gap:'6px', marginLeft:'auto' }}>
              {['all',...cats].map(c => (
                <button key={c} onClick={()=>setCatFilter(c)} style={{ padding:'6px 10px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'11px', background:catFilter===c?'#1f2030':'transparent', color:catFilter===c?'#f1f1f1':'#6b7280', outline:`1px solid ${catFilter===c?'#2a2a3a':'transparent'}` }}>
                  {c==='all'?'Tutti':c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filtered.length === 0 ? (
            <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'60px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>
              Nessun appuntamento. <button onClick={()=>setShowForm(true)} style={{ background:'none', border:'none', color:'#8b5cf6', cursor:'pointer', fontSize:'13px' }}>Crea il primo →</button>
            </div>
          ) : filtered.map(a => {
            const sc = SC[a.status]
            return (
              <div key={a.id} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'16px', fontWeight:'700', color:'#0f172a' }}>{a.guest_name}</span>
                      <span style={{ background:sc.color+'20', color:sc.color, padding:'2px 8px', borderRadius:'12px', fontSize:'11px', fontWeight:'500' }}>{sc.label}</span>
                      {a.service?.category && <span style={{ background:'#8b5cf620', color:'#a78bfa', padding:'2px 8px', borderRadius:'12px', fontSize:'10px' }}>{a.service.category}</span>}
                    </div>
                    <div style={{ fontSize:'13px', color:'#94a3b8' }}>
                      {a.service?.name} · {a.staff?.name||'Staff TBD'} · {a.date} alle {String(a.time).slice(0,5)}
                    </div>
                    {(a.guest_phone||a.guest_email) && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>{a.guest_phone} {a.guest_email}</div>}
                    {a.notes && <div style={{ fontSize:'12px', color:'#f59e0b', marginTop:'4px' }}>📝 {a.notes}</div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'18px', fontWeight:'700', color:'#8b5cf6' }}>€{a.price||a.service?.price||0}</div>
                    {a.service?.duration_minutes && <div style={{ fontSize:'11px', color:'#94a3b8' }}>{a.service.duration_minutes}min</div>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', marginTop:'12px', flexWrap:'wrap' }}>
                  {a.status === 'confirmed' && <>
                    <button onClick={()=>updateStatus(a.id,'in_progress')} disabled={updating===a.id} style={{ padding:'5px 12px', background:'#f59e0b20', color:'#f59e0b', border:'1px solid #f59e0b40', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>▶ Inizia</button>
                    <button onClick={()=>updateStatus(a.id,'no_show')} disabled={updating===a.id} style={{ padding:'5px 12px', background:'#7c3aed20', color:'#7c3aed', border:'1px solid #7c3aed40', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>No show</button>
                    <button onClick={()=>deleteAppt(a.id)} style={{ padding:'5px 12px', background:'#ef444420', color:'#ef4444', border:'1px solid #ef444440', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>✕ Cancella</button>
                  </>}
                  {a.status === 'in_progress' && (
                    <button onClick={()=>updateStatus(a.id,'completed')} disabled={updating===a.id} style={{ padding:'5px 12px', background:'#10b98120', color:'#10b981', border:'1px solid #10b98140', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>✓ Completa e paga</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {paymentModal && (
        <PaymentModal title={`Completa — ${paymentModal.appt?.guest_name||''}`} amount={Number(paymentModal.appt?.price||0)} onConfirm={handlePayment} onCancel={()=>setPaymentModal(null)} />
      )}
    </div>
  )
}
