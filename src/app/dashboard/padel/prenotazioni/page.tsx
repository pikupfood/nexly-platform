'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useStaffNav } from '@/lib/useStaffNav'
import PaymentModal from '@/components/PaymentModal'
import { autoGenerateInvoice } from '@/lib/autoInvoice'

const SC: Record<string,{label:string;color:string}> = {
  confirmed:   { label:'Confermata', color:'#3b82f6' },
  in_progress: { label:'In corso',   color:'#f59e0b' },
  completed:   { label:'Completata', color:'#10b981' },
  cancelled:   { label:'Cancellata', color:'#ef4444' },
}

export default function PadelPrenotazioniPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const [bookings, setBookings] = useState<any[]>([])
  const [courts, setCourts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paymentModal, setPaymentModal] = useState<any>(null)
  const today = new Date().toISOString().split('T')[0]

  const EMPTY = { court_id:'', player_name:'', player_phone:'', player_email:'', date:today, start_time:'09:00', players_count:4 }
  const [form, setForm] = useState<any>(EMPTY)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [])

  const load = async () => {
    const [bRes, cRes] = await Promise.all([
      supabase.from('padel_bookings').select('*, court:padel_courts(name,price_per_hour,slot_duration)').order('date', { ascending:false }).order('start_time'),
      supabase.from('padel_courts').select('*').eq('is_active', true).order('name'),
    ])
    setBookings(bRes.data||[])
    setCourts(cRes.data||[])
    setLoading(false)
  }

  const calcEndTime = (start: string, duration: number) => {
    const [h,m] = start.split(':').map(Number)
    const end = h*60+m+duration
    return `${Math.floor(end/60).toString().padStart(2,'0')}:${(end%60).toString().padStart(2,'0')}`
  }

  const save = async () => {
    if (!form.court_id||!form.player_name||!form.date) return
    setSaving(true)
    const court = courts.find(c => c.id === form.court_id)
    const duration = court?.slot_duration||90
    const end_time = calcEndTime(form.start_time, duration)
    const price = (court?.price_per_hour||0) * (duration/60)
    const { data, error } = await supabase.from('padel_bookings').insert([{ ...form, end_time, price, status:'confirmed' }]).select('*, court:padel_courts(name,price_per_hour,slot_duration)').single()
    if (!error && data) { setBookings(prev => [data, ...prev]); setShowForm(false); setForm(EMPTY) }
    else if (error) alert('Erreur: ' + error.message)
    setSaving(false)
  }

  const updateStatus = async (id: string, newStatus: string) => {
    const bk = bookings.find(b => b.id === id)
    if (newStatus === 'completed') { setPaymentModal({ id, bk }); return }
    await supabase.from('padel_bookings').update({ status:newStatus }).eq('id', id)
    setBookings(prev => prev.map(b => b.id===id ? {...b,status:newStatus} : b))
  }

  const handlePayment = async (payment: any) => {
    if (!paymentModal) return
    const { id, bk } = paymentModal
    setPaymentModal(null)
    await supabase.from('padel_bookings').update({ status:'completed', payment_method:payment.method, payment_note:payment.note||null, is_complimentary:payment.isComplimentary }).eq('id', id)
    setBookings(prev => prev.map(b => b.id===id ? {...b,status:'completed'} : b))
    if (bk) await autoGenerateInvoice({ source:'padel', sourceId:id, clientFirstName:bk.player_name||'Giocatore', clientLastName:'', clientEmail:bk.player_email, clientPhone:bk.player_phone, items:[{ description:`${bk.court?.name||'Campo padel'} · ${bk.date} ${bk.start_time?.slice(0,5)}-${bk.end_time?.slice(0,5)}`, quantity:1, unit_price:Number(bk.price||0), tax_rate:10 }], taxRate:10, paymentMethod:payment.method, paymentNote:payment.note, isComplimentary:payment.isComplimentary, router })
  }

  const filtered = bookings.filter(b => {
    const mF = filter==='upcoming'?(b.date>=today&&['confirmed','in_progress'].includes(b.status)):filter==='today'?(b.date===today):filter==='all'?true:(b.status===filter)
    const mS = !search || b.player_name?.toLowerCase().includes(search.toLowerCase()) || b.player_email?.includes(search)
    return mF && mS
  })

  const IS: any = { padding:'8px 10px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', width:'100%', boxSizing:'border-box', outline:'none' }
  const LS: any = { fontSize:'11px', color:'#94a3b8', marginBottom:'4px', display:'block' }

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight:'100vh', background:'white', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ borderBottom:'1px solid #e2e8f0', padding:'14px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'white', zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <Link href="/dashboard/padel" style={{ color:'#94a3b8', textDecoration:'none', fontSize:'13px' }}>← Padel</Link>
          <span style={{ color:'#2a2a3a' }}>|</span>
          <h1 style={{ fontSize:'17px', fontWeight:'600', color:'#0f172a', margin:0 }}>🎾 Prenotazioni padel</h1>
        </div>
        <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'8px 16px', background:'#f59e0b', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500' }}>
          {showForm ? '✕ Annulla' : '+ Nuova prenotazione'}
        </button>
      </div>

      <div style={{ padding:'20px 24px' }}>
        {showForm && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'20px 24px', marginBottom:'20px' }}>
            <h3 style={{ color:'#0f172a', fontSize:'14px', fontWeight:'600', margin:'0 0 16px' }}>Nuova prenotazione</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:'12px', marginBottom:'14px' }}>
              <div><label style={LS}>Campo *</label>
                <select style={IS} value={form.court_id} onChange={e=>setForm((p:any)=>({...p,court_id:e.target.value}))}>
                  <option value="">Seleziona campo...</option>
                  {courts.map(c => <option key={c.id} value={c.id}>{c.name} · €{c.price_per_hour}/h</option>)}
                </select>
              </div>
              <div><label style={LS}>Nome giocatore *</label><input style={IS} value={form.player_name} onChange={e=>setForm((p:any)=>({...p,player_name:e.target.value}))} placeholder="Mario Rossi" /></div>
              <div><label style={LS}>Telefono</label><input style={IS} value={form.player_phone} onChange={e=>setForm((p:any)=>({...p,player_phone:e.target.value}))} placeholder="+39..." /></div>
              <div><label style={LS}>Email</label><input style={IS} value={form.player_email} onChange={e=>setForm((p:any)=>({...p,player_email:e.target.value}))} placeholder="email@..." /></div>
              <div><label style={LS}>Data *</label><input type="date" style={IS} value={form.date} onChange={e=>setForm((p:any)=>({...p,date:e.target.value}))} /></div>
              <div><label style={LS}>Orario *</label><input type="time" style={IS} value={form.start_time} onChange={e=>setForm((p:any)=>({...p,start_time:e.target.value}))} /></div>
              <div><label style={LS}>Numero giocatori</label>
                <select style={IS} value={form.players_count} onChange={e=>setForm((p:any)=>({...p,players_count:parseInt(e.target.value)}))}>
                  {[2,3,4].map(n => <option key={n} value={n}>{n} giocatori</option>)}
                </select>
              </div>
            </div>
            {form.court_id && (
              <div style={{ padding:'8px 12px', background:'#f59e0b20', border:'1px solid #f59e0b40', borderRadius:'8px', marginBottom:'12px', fontSize:'12px', color:'#fbbf24' }}>
                ⏱️ {courts.find(c=>c.id===form.court_id)?.slot_duration||90} min · Fine: {calcEndTime(form.start_time, courts.find(c=>c.id===form.court_id)?.slot_duration||90)} · 
                <strong> €{((courts.find(c=>c.id===form.court_id)?.price_per_hour||0)*((courts.find(c=>c.id===form.court_id)?.slot_duration||90)/60)).toFixed(0)}</strong>
              </div>
            )}
            <button onClick={save} disabled={!form.court_id||!form.player_name||!form.date||saving} style={{ padding:'8px 18px', background:form.court_id&&form.player_name&&form.date?'#f59e0b':'#374151', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
              {saving?'Salvataggio...':'✓ Conferma prenotazione'}
            </button>
          </div>
        )}

        {/* Filtri */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cerca giocatore..." style={{ padding:'7px 12px', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#0f172a', fontSize:'13px', outline:'none', width:'180px' }} />
          {['upcoming','today','all','completed','cancelled'].map(f => (
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 12px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'12px', background:filter===f?'#f59e0b':'#111118', color:filter===f?'white':'#9ca3af', outline:`1px solid ${filter===f?'#f59e0b':'#1f2030'}` }}>
              {f==='upcoming'?'Prossime':f==='today'?'Oggi':f==='all'?'Tutte':SC[f]?.label||f}
            </button>
          ))}
          <span style={{ fontSize:'12px', color:'#94a3b8', marginLeft:'auto' }}>{filtered.length} risultati</span>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filtered.length === 0 ? (
            <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'60px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>
              Nessuna prenotazione. <button onClick={()=>setShowForm(true)} style={{ background:'none', border:'none', color:'#f59e0b', cursor:'pointer', fontSize:'13px' }}>Crea la prima →</button>
            </div>
          ) : filtered.map(b => {
            const sc = SC[b.status]
            return (
              <div key={b.id} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'15px', fontWeight:'700', color:'#0f172a' }}>{b.player_name}</span>
                      <span style={{ background:sc.color+'20', color:sc.color, padding:'2px 8px', borderRadius:'12px', fontSize:'11px', fontWeight:'500' }}>{sc.label}</span>
                    </div>
                    <div style={{ fontSize:'13px', color:'#94a3b8' }}>
                      {b.court?.name} · {b.players_count} giocatori · {b.date} · {String(b.start_time).slice(0,5)} – {String(b.end_time).slice(0,5)}
                    </div>
                    {(b.player_phone||b.player_email) && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>{b.player_phone} {b.player_email}</div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'18px', fontWeight:'700', color:'#f59e0b' }}>€{Number(b.price||0).toFixed(0)}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', marginTop:'12px', flexWrap:'wrap' }}>
                  {b.status === 'confirmed' && <>
                    <button onClick={()=>updateStatus(b.id,'in_progress')} style={{ padding:'5px 12px', background:'#f59e0b20', color:'#f59e0b', border:'1px solid #f59e0b40', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>▶ In corso</button>
                    <button onClick={()=>updateStatus(b.id,'cancelled')} style={{ padding:'5px 12px', background:'#ef444420', color:'#ef4444', border:'1px solid #ef444440', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>✕ Cancella</button>
                  </>}
                  {b.status === 'in_progress' && (
                    <button onClick={()=>updateStatus(b.id,'completed')} style={{ padding:'5px 12px', background:'#10b98120', color:'#10b981', border:'1px solid #10b98140', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>✓ Completa e paga</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {paymentModal && (
        <PaymentModal title={`Completa — ${paymentModal.bk?.player_name||''}`} amount={Number(paymentModal.bk?.price||0)} onConfirm={handlePayment} onCancel={()=>setPaymentModal(null)} />
      )}
    </div>
  )
}
