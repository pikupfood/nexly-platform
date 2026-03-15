'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import { useStaffNav } from '@/lib/useStaffNav'

export default function ClientiPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { backHref } = useStaffNav()
  const [clients, setClients] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [history, setHistory] = useState<any>({ reservations:[], spa:[], padel:[], tableRes:[] })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', phone:'', nationality:'', notes:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [])

  const load = async () => {
    const [gRes, spaRes, padelRes] = await Promise.all([
      supabase.from('guests').select('*').order('created_at', { ascending:false }),
      supabase.from('spa_appointments').select('guest_name,guest_email,guest_phone,created_at,date,service:spa_services(name),price').order('created_at', { ascending:false }),
      supabase.from('padel_bookings').select('player_name,player_email,player_phone,created_at,date,price').order('created_at', { ascending:false }),
    ])
    const hotelGuests = (gRes.data||[]).map(g => ({ id:g.id, source:'hotel', name:`${g.first_name} ${g.last_name}`, first_name:g.first_name, last_name:g.last_name, email:g.email, phone:g.phone, nationality:g.nationality, notes:g.notes, created_at:g.created_at, raw:g }))
    const spaGuests = (spaRes.data||[]).map((a,i) => ({ id:`spa-${i}`, source:'spa', name:a.guest_name, email:a.guest_email, phone:a.guest_phone, created_at:a.created_at, raw:a }))
    const padelGuests = (padelRes.data||[]).map((b,i) => ({ id:`padel-${i}`, source:'padel', name:b.player_name, email:b.player_email, phone:b.player_phone, created_at:b.created_at, raw:b }))
    const all: any[] = []; const seen = new Set()
    for (const c of [...hotelGuests, ...spaGuests, ...padelGuests]) {
      const key = c.email?.toLowerCase() || c.name?.toLowerCase()
      if (key && !seen.has(key)) { seen.add(key); all.push(c) }
    }
    setClients(all)
    setLoading(false)
  }

  const loadHistory = async (c: any) => {
    setSelected(c)
    if (!c.email) { setHistory({ reservations:[], spa:[], padel:[], tableRes:[] }); return }
    const [resRes, spaRes, padelRes, tRes] = await Promise.all([
      supabase.from('reservations').select('*, guest:guests(email), room_type:room_types(name)').eq('guest.email', c.email),
      supabase.from('spa_appointments').select('*, service:spa_services(name)').eq('guest_email', c.email).order('date', { ascending:false }),
      supabase.from('padel_bookings').select('*, court:padel_courts(name)').eq('player_email', c.email).order('date', { ascending:false }),
      supabase.from('table_reservations').select('*').eq('guest_email', c.email).order('date', { ascending:false }),
    ])
    setHistory({ reservations:resRes.data||[], spa:spaRes.data||[], padel:padelRes.data||[], tableRes:tRes.data||[] })
  }

  const save = async () => {
    if (!form.first_name || !form.last_name) return
    setSaving(true)
    const { data } = await supabase.from('guests').insert([form]).select().single()
    if (data) {
      setClients(prev => [{ id:data.id, source:'hotel', name:`${data.first_name} ${data.last_name}`, ...data, raw:data }, ...prev])
      setShowForm(false)
      setForm({ first_name:'', last_name:'', email:'', phone:'', nationality:'', notes:'' })
    }
    setSaving(false)
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)
  })

  const totalHistory = history.reservations.length + history.spa.length + history.padel.length + history.tableRes.length
  const totalSpend = [
    ...history.reservations.map((r:any) => Number(r.total_price||0)),
    ...history.spa.map((a:any) => Number(a.price||0)),
    ...history.padel.map((b:any) => Number(b.price||0)),
  ].reduce((s,v) => s+v, 0)

  const SOURCE_ICON: Record<string,string> = { hotel:'🏨', spa:'💆', padel:'🎾' }
  const SOURCE_COLOR: Record<string,string> = { hotel:'#3b82f6', spa:'#8b5cf6', padel:'#f59e0b' }

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  const actions = (
    <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'7px 14px', background:'#ec4899', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>+ Nouveau client</button>
  )

  return (
    <AppShell title="Clients" actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'20px 24px' }}>
        {/* Form nuovo cliente */}
        {showForm && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'20px 24px', marginBottom:'20px' }}>
            <h3 style={{ color:'#0f172a', fontSize:'14px', fontWeight:'600', margin:'0 0 16px' }}>Nuovo cliente</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:'10px', marginBottom:'12px' }}>
              {[
                { key:'first_name', label:'Nome *', ph:'Mario' },
                { key:'last_name',  label:'Cognome *', ph:'Rossi' },
                { key:'email',      label:'Email', ph:'mario@email.com' },
                { key:'phone',      label:'Telefono', ph:'+39...' },
                { key:'nationality', label:'Nazionalità', ph:'Italiano' },
                { key:'notes',      label:'Note', ph:'Note interne...' },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'4px' }}>{f.label}</div>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                    style={{ width:'100%', padding:'8px 10px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={save} disabled={!form.first_name||!form.last_name||saving} style={{ padding:'8px 18px', background: form.first_name&&form.last_name?'#ec4899':'#374151', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                {saving ? 'Salvataggio...' : '✓ Salva'}
              </button>
              <button onClick={()=>setShowForm(false)} style={{ padding:'8px 16px', background:'none', border:'1px solid #e2e8f0', color:'#94a3b8', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>Annulla</button>
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap:'16px' }}>
          {/* Lista clienti */}
          <div>
            <div style={{ display:'flex', gap:'10px', marginBottom:'12px', alignItems:'center' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cerca per nome, email, telefono..." style={{ flex:1, padding:'8px 12px', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#0f172a', fontSize:'13px', outline:'none' }} />
              {search && <button onClick={()=>setSearch('')} style={{ padding:'7px 10px', background:'none', border:'1px solid #e2e8f0', color:'#94a3b8', borderRadius:'7px', cursor:'pointer', fontSize:'12px' }}>✕</button>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {filtered.slice(0,30).map(c => (
                <div key={c.id} onClick={()=>loadHistory(c)}
                  style={{ background: selected?.id===c.id ? '#1a2a3a' : '#111118', border:`1px solid ${selected?.id===c.id?'#3b82f6':'#1f2030'}`, borderRadius:'10px', padding:'12px 16px', cursor:'pointer', transition:'all 0.1s', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                  onMouseEnter={e => { if(selected?.id!==c.id) e.currentTarget.style.borderColor='#2a2a3a' }}
                  onMouseLeave={e => { if(selected?.id!==c.id) e.currentTarget.style.borderColor='#1f2030' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'50%', background: SOURCE_COLOR[c.source]+'30', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'700', color: SOURCE_COLOR[c.source], flexShrink:0 }}>
                      {(c.name||'?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a' }}>{c.name||'—'}</div>
                      <div style={{ fontSize:'11px', color:'#94a3b8' }}>
                        {c.email && <span>{c.email}</span>}
                        {c.phone && <span style={{ marginLeft:'8px' }}>{c.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize:'10px', background: SOURCE_COLOR[c.source]+'20', color: SOURCE_COLOR[c.source], padding:'2px 7px', borderRadius:'8px' }}>
                    {SOURCE_ICON[c.source]} {c.source}
                  </span>
                </div>
              ))}
              {filtered.length > 30 && <div style={{ textAlign:'center', color:'#94a3b8', fontSize:'12px', padding:'8px' }}>+{filtered.length-30} altri risultati</div>}
              {filtered.length === 0 && <div style={{ textAlign:'center', color:'#94a3b8', fontSize:'13px', padding:'30px' }}>Nessun cliente trovato</div>}
            </div>
          </div>

          {/* Scheda cliente */}
          {selected && (
            <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden', alignSelf:'flex-start', position:'sticky', top:'70px' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'50%', background: SOURCE_COLOR[selected.source]+'30', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', color: SOURCE_COLOR[selected.source] }}>
                    {(selected.name||'?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:'700', color:'#0f172a' }}>{selected.name}</div>
                    <div style={{ fontSize:'11px', color:'#94a3b8' }}>{selected.nationality||''}</div>
                  </div>
                </div>
                <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'18px' }}>✕</button>
              </div>

              {/* Info contatto */}
              <div style={{ padding:'14px 20px', borderBottom:'1px solid #e2e8f0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                {[
                  { label:'Email', value: selected.email },
                  { label:'Telefono', value: selected.phone },
                  { label:'Nazionalità', value: selected.nationality },
                  { label:'Note', value: selected.notes },
                ].filter(f => f.value).map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize:'10px', color:'#94a3b8', marginBottom:'2px' }}>{f.label}</div>
                    <div style={{ fontSize:'12px', color:'#d1d5db' }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {/* KPI cliente */}
              <div style={{ padding:'12px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', gap:'16px' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'18px', fontWeight:'700', color:'#ec4899' }}>{totalHistory}</div>
                  <div style={{ fontSize:'10px', color:'#94a3b8' }}>Prenotazioni</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'18px', fontWeight:'700', color:'#10b981' }}>€{totalSpend.toFixed(0)}</div>
                  <div style={{ fontSize:'10px', color:'#94a3b8' }}>Totale speso</div>
                </div>
                {history.reservations.length > 0 && (
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:'18px', fontWeight:'700', color:'#3b82f6' }}>{history.reservations.length}</div>
                    <div style={{ fontSize:'10px', color:'#94a3b8' }}>Soggiorni</div>
                  </div>
                )}
              </div>

              {/* Storico */}
              <div style={{ padding:'12px 20px', maxHeight:'320px', overflowY:'auto' }}>
                {[
                  ...history.reservations.map((r:any) => ({ icon:'🏨', color:'#3b82f6', text:`${r.room_type?.name||'Camera'} · ${r.check_in} → ${r.check_out}`, amount:r.total_price, status:r.status })),
                  ...history.spa.map((a:any) => ({ icon:'💆', color:'#8b5cf6', text:`${a.service?.name||'Spa'} · ${a.date}`, amount:a.price, status:a.status })),
                  ...history.padel.map((b:any) => ({ icon:'🎾', color:'#f59e0b', text:`${b.court?.name||'Padel'} · ${b.date} ${String(b.start_time).slice(0,5)}`, amount:b.price, status:b.status })),
                  ...history.tableRes.map((t:any) => ({ icon:'🍽️', color:'#10b981', text:`Tavolo ${t.date} ${String(t.time).slice(0,5)} · ${t.guests_count} pers.`, amount:null, status:t.status })),
                ].length === 0 ? (
                  <div style={{ color:'#94a3b8', fontSize:'12px', textAlign:'center', padding:'16px' }}>Nessuna attività registrata</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {[
                      ...history.reservations.map((r:any) => ({ icon:'🏨', color:'#3b82f6', text:`${r.room_type?.name||'Camera'} · ${r.check_in} → ${r.check_out}`, amount:r.total_price, status:r.status })),
                      ...history.spa.map((a:any) => ({ icon:'💆', color:'#8b5cf6', text:`${a.service?.name||'Spa'} · ${a.date}`, amount:a.price, status:a.status })),
                      ...history.padel.map((b:any) => ({ icon:'🎾', color:'#f59e0b', text:`${b.court?.name||'Padel'} · ${b.date}`, amount:b.price, status:b.status })),
                    ].map((item, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:`${item.color}10`, border:`1px solid ${item.color}25`, borderRadius:'8px' }}>
                        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                          <span style={{ fontSize:'14px' }}>{item.icon}</span>
                          <span style={{ fontSize:'12px', color:'#d1d5db' }}>{item.text}</span>
                        </div>
                        {item.amount && <span style={{ fontSize:'12px', fontWeight:'600', color:item.color }}>€{Number(item.amount).toFixed(0)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
