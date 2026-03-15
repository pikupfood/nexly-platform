'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import { useStaffNav } from '@/lib/useStaffNav'

const SC: Record<string,{label:string;color:string}> = {
  confirmed:   { label:'Confermata', color:'#3b82f6' },
  in_progress: { label:'In corso',   color:'#f59e0b' },
  completed:   { label:'Completata', color:'#10b981' },
  cancelled:   { label:'Cancellata', color:'#ef4444' },
}

export default function PadelPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const { t } = useI18n()
  const [courts, setCourts] = useState<any[]>([])
  const [todayBookings, setTodayBookings] = useState<any[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([])
  const [stats, setStats] = useState({ today:0, upcoming:0, revenue:0, courts_active:0 })
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0])
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [viewDate])

  const load = async () => {
    const [courtsRes, bookRes, allRes] = await Promise.all([
      supabase.from('padel_courts').select('*').order('name'),
      supabase.from('padel_bookings').select('*, court:padel_courts(name)').eq('date', viewDate).neq('status','cancelled').order('start_time'),
      supabase.from('padel_bookings').select('status, date, price').gte('date', today).neq('status','cancelled'),
    ])
    const all = allRes.data || []
    setCourts(courtsRes.data || [])
    setTodayBookings(bookRes.data || [])
    setUpcomingBookings(all.filter(b => b.date > viewDate).slice(0, 8) as any[])
    setStats({
      today: (bookRes.data||[]).length,
      upcoming: all.filter(b => b.date > viewDate).length,
      revenue: all.filter(b => b.status==='completed').reduce((s,b)=>s+Number(b.price||0), 0),
      courts_active: (courtsRes.data||[]).filter(c=>c.is_active).length,
    })
    setLoading(false)
  }

  const moveDate = (d: number) => {
    const dt = new Date(viewDate); dt.setDate(dt.getDate()+d)
    setViewDate(dt.toISOString().split('T')[0])
  }

  // Genera slot orari per la griglia
  const generateSlots = (court: any) => {
    const slots: { time: string; booking: any; }[] = []
    const open = court.open_time?.slice(0,5) || '08:00'
    const close = court.close_time?.slice(0,5) || '22:00'
    const [oh,om] = open.split(':').map(Number)
    const [ch,cm] = close.split(':').map(Number)
    let cur = oh*60+om
    const end = ch*60+cm
    while (cur < end) {
      const h = Math.floor(cur/60).toString().padStart(2,'0')
      const m = (cur%60).toString().padStart(2,'0')
      const time = `${h}:${m}`
      const booking = todayBookings.find(b => b.court_id === court.id && b.start_time?.slice(0,5) === time)
      slots.push({ time, booking })
      cur += court.slot_duration || 90
    }
    return slots
  }

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  return (
    <AppShell title="Padel" tenantName={tenant?.business_name} userEmail={user?.email}>
        <Link href="/dashboard/padel/prenotazioni" style={{ padding:'8px 16px', background:'#f59e0b', color:'white', borderRadius:'8px', textDecoration:'none', fontSize:'13px', fontWeight:'500' }}>+ Nuova prenotazione</Link>

      <div style={{ padding:'20px 24px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:t('today'), value:stats.today,         color:'#3b82f6', icon:'📅' },
            { label:t('upcoming'),          value:stats.upcoming,      color:'#f59e0b', icon:'⏰' },
            { label:t('courts'),      value:stats.courts_active, color:'#10b981', icon:'🎾' },
            { label:t('revenue'),           value:`€${stats.revenue.toFixed(0)}`, color:'#8b5cf6', icon:'💶' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontSize:'16px', marginBottom:'6px' }}>{s.icon}</div>
              <div style={{ fontSize:'20px', fontWeight:'700', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Azioni */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { href:'/dashboard/padel/prenotazioni', label:t('bookings'), icon:'📋', color:'#f59e0b' },
            { href:'/dashboard/padel/campi',        label:t('courts'),        icon:'🎾', color:'#10b981' },
            { href:'/dashboard/agenda/padel',       label:t('agenda') + ' padel',          icon:'📆', color:'#f43f5e' },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'white', border:`1px solid ${a.color}30`, borderRadius:'10px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', transition:'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = a.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = a.color+'30'}>
                <span style={{ fontSize:'18px' }}>{a.icon}</span>
                <span style={{ color:'#0f172a', fontSize:'13px', fontWeight:'500' }}>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Griglia disponibilità */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden', marginBottom:'16px' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', margin:0 }}>Griglia disponibilità</h2>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <button onClick={() => moveDate(-1)} style={{ padding:'4px 8px', background:'#f1f5f9', border:'none', color:'#64748b', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>←</button>
              <span style={{ fontSize:'13px', color:'#0f172a', minWidth:'120px', textAlign:'center' }}>
                {viewDate === today ? 'Oggi' : viewDate}
              </span>
              <button onClick={() => moveDate(1)} style={{ padding:'4px 8px', background:'#f1f5f9', border:'none', color:'#64748b', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>→</button>
              {viewDate !== today && <button onClick={() => setViewDate(today)} style={{ padding:'4px 8px', background:'#3b82f620', border:'1px solid #3b82f640', color:'#60a5fa', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>Oggi</button>}
            </div>
          </div>
          <div style={{ padding:'16px', overflowX:'auto' }}>
            {courts.filter(c => c.is_active).length === 0 ? (
              <div style={{ textAlign:'center', color:'#94a3b8', fontSize:'13px', padding:'20px' }}>
                Nessun campo attivo. <Link href="/dashboard/padel/campi" style={{ color:'#f59e0b' }}>Aggiungi un campo →</Link>
              </div>
            ) : (
              <div style={{ display:'flex', gap:'12px' }}>
                {courts.filter(c => c.is_active).map(court => {
                  const slots = generateSlots(court)
                  return (
                    <div key={court.id} style={{ flex:1, minWidth:'180px' }}>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'#f59e0b', marginBottom:'8px', textAlign:'center' }}>
                        🎾 {court.name}
                        <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'400' }}>€{court.price_per_hour}/h · {court.type==='indoor'?'Indoor':'Outdoor'}</div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                        {slots.map(slot => {
                          const bk = slot.booking
                          const sc = bk ? SC[bk.status] : null
                          return (
                            <div key={slot.time} style={{
                              padding:'8px 10px', borderRadius:'8px', border:'1px solid',
                              borderColor: bk ? (sc?.color||'#6b7280')+'50' : '#2a2a3a',
                              background: bk ? (sc?.color||'#6b7280')+'15' : '#1a1a25',
                              cursor:'pointer',
                            }}
                              onClick={() => bk ? null : window.location.href='/dashboard/padel/prenotazioni'}
                              title={bk ? `${bk.player_name} — ${sc?.label}` : 'Libero — clicca per prenotare'}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontSize:'11px', fontWeight:'600', color: bk ? sc?.color : '#6b7280' }}>{slot.time}</span>
                                {bk ? (
                                  <span style={{ fontSize:'10px', color:sc?.color, background:sc?.color+'20', padding:'1px 6px', borderRadius:'6px' }}>{sc?.label}</span>
                                ) : (
                                  <span style={{ fontSize:'10px', color:'#10b981' }}>Libero</span>
                                )}
                              </div>
                              {bk && <div style={{ fontSize:'11px', color:'#64748b', marginTop:'2px' }}>{bk.player_name} · {bk.players_count}p</div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
