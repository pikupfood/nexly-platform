'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useStaffNav } from '@/lib/useStaffNav'

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

export default function AgendaPadelPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const [bookings, setBookings] = useState<any[]>([])
  const [courts, setCourts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [view, setView] = useState<'day' | 'week'>('day')
  const [courtFilter, setCourtFilter] = useState('all')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      supabase.from('padel_courts').select('*').eq('is_active', true).order('name').then(({ data }) => setCourts(data || []))
      loadData()
    })
  }, [selectedDate, view])

  const getDateRange = () => {
    const base = new Date(selectedDate)
    if (view === 'day') return { from: selectedDate, to: selectedDate }
    const day = base.getDay()
    const monday = new Date(base); monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    return { from: monday.toISOString().split('T')[0], to: sunday.toISOString().split('T')[0] }
  }

  const loadData = async () => {
    setLoading(true)
    const { from, to } = getDateRange()
    const { data } = await supabase.from('padel_bookings')
      .select('*, court:padel_courts(name, type, price_per_hour)')
      .gte('date', from).lte('date', to)
      .neq('status', 'cancelled')
      .order('date').order('start_time')
    setBookings(data || [])
    setLoading(false)
  }

  const navigate = (dir: number) => {
    const base = new Date(selectedDate)
    base.setDate(base.getDate() + (view === 'day' ? dir : dir * 7))
    setSelectedDate(base.toISOString().split('T')[0])
  }

  const formatDate = (d: string) => { const dt = new Date(d + 'T12:00:00'); return `${DAYS_IT[dt.getDay()]} ${dt.getDate()} ${MONTHS_IT[dt.getMonth()]}` }
  const isToday = (d: string) => d === new Date().toISOString().split('T')[0]
  const hours = (s: string, e: string) => ((new Date(`2000-01-01T${e}`).getTime() - new Date(`2000-01-01T${s}`).getTime()) / 3600000).toFixed(1)

  const filtered = courtFilter === 'all' ? bookings : bookings.filter(b => b.court_id === courtFilter)

  const byDate = filtered.reduce((acc, b) => {
    if (!acc[b.date]) acc[b.date] = []
    acc[b.date].push(b)
    return acc
  }, {} as Record<string, any[]>)

  // Vista grid campi (solo per giorno)
  const courtSlots = courts.map(c => ({
    ...c,
    bookings: filtered.filter(b => b.court_id === c.id && (view === 'day' ? b.date === selectedDate : true))
  }))

  const STATUS_CFG: Record<string, { label: string; color: string }> = {
    confirmed:   { label: 'Confermata', color: '#3b82f6' },
    in_progress: { label: 'In corso',   color: '#f59e0b' },
    completed:   { label: 'Completata', color: '#10b981' },
  }

  if (loading) return <div style={{ minHeight: '100vh', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: 'white', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/agenda" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Agenda</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>🎾 Agenda Padel</h1>
        </div>
        <Link href="/dashboard/padel/prenotazioni" style={{ padding: '8px 16px', background: '#f59e0b', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>+ Nuova</Link>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer' }}>←</button>
          <div style={{ fontSize: '17px', fontWeight: '600', color: '#f1f1f1', minWidth: '180px', textAlign: 'center' }}>{formatDate(selectedDate)}</div>
          <button onClick={() => navigate(1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer' }}>→</button>
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} style={{ padding: '6px 12px', background: '#1f2030', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '12px' }}>Oggi</button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: '6px 10px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '13px' }} />
          {(['day','week'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', background: view === v ? '#f59e0b' : '#111118', color: view === v ? 'white' : '#9ca3af', outline: `1px solid ${view === v ? '#f59e0b' : '#1f2030'}` }}>
              {v === 'day' ? 'Giorno' : 'Settimana'}
            </button>
          ))}
        </div>

        {/* Grid campi (vista giorno) */}
        {view === 'day' && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${courts.length}, 1fr)`, gap: '12px', marginBottom: '24px' }}>
            {courtSlots.map(c => (
              <div key={c.id} style={{ background: '#111118', border: '1px solid #f59e0b40', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ background: '#f59e0b20', padding: '12px 16px', borderBottom: '1px solid #f59e0b30' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#f59e0b' }}>🎾 {c.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{c.type === 'indoor' ? '🏠 Indoor' : '☀️ Outdoor'} · €{c.price_per_hour}/h</div>
                </div>
                <div style={{ padding: '12px' }}>
                  {c.bookings.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#374151', fontSize: '13px', padding: '20px 0' }}>Libero</div>
                  ) : c.bookings.map((b: any) => {
                    const sc = STATUS_CFG[b.status] || { label: b.status, color: '#6b7280' }
                    return (
                      <div key={b.id} style={{ background: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f1f1' }}>{b.player_name}</div>
                        <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '2px' }}>{b.start_time?.slice(0,5)} - {b.end_time?.slice(0,5)}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{b.players_count} giocatori</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                          {b.price && <span style={{ fontSize: '12px', color: '#f1f1f1' }}>€{Number(b.price).toFixed(0)}</span>}
                          <span style={{ background: sc.color + '20', color: sc.color, padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>{sc.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lista per settimana */}
        {view === 'week' && (
          Object.keys(byDate).length === 0 ? (
            <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎾</div>
              Nessuna prenotazione per questa settimana
            </div>
          ) : Object.entries(byDate).map(([date, dayBookings]) => (
            <div key={date} style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: isToday(date) ? '#f59e0b' : '#9ca3af', marginBottom: '10px', paddingBottom: '8px', borderBottom: `2px solid ${isToday(date) ? '#f59e0b' : '#1f2030'}` }}>
                {formatDate(date)} {isToday(date) && '— OGGI'} ({dayBookings.length})
              </div>
              {dayBookings.map((b: any) => {
                const sc = STATUS_CFG[b.status] || { label: b.status, color: '#6b7280' }
                return (
                  <Link key={b.id} href="/dashboard/padel/prenotazioni" style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', gap: '14px', background: '#111118', border: '1px solid #1f2030', borderLeft: '3px solid #f59e0b', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', cursor: 'pointer' }}>
                      <div style={{ minWidth: '52px' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#f59e0b' }}>{b.start_time?.slice(0,5)}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{hours(b.start_time, b.end_time)}h</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#f1f1f1' }}>{b.player_name}</span>
                            <span style={{ fontSize: '12px', color: '#f59e0b', marginLeft: '8px' }}>{b.court?.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {b.price && <span style={{ fontSize: '13px', color: '#f1f1f1' }}>€{Number(b.price).toFixed(0)}</span>}
                            <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{sc.label}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{b.players_count} giocatori · {b.start_time?.slice(0,5)}-{b.end_time?.slice(0,5)}</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
