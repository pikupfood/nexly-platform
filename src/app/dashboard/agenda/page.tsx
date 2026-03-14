'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface AgendaItem {
  id: string
  time: string
  date: string
  title: string
  subtitle: string
  source: 'hotel' | 'ristorante' | 'spa' | 'padel'
  status: string
  price?: number
  color: string
  icon: string
  link: string
}

const SOURCE_CONFIG = {
  hotel:      { color: '#3b82f6', icon: '🏨', label: 'Hotel' },
  ristorante: { color: '#10b981', icon: '🍽️', label: 'Ristorante' },
  spa:        { color: '#8b5cf6', icon: '💆', label: 'Spa' },
  padel:      { color: '#f59e0b', icon: '🎾', label: 'Padel' },
}

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

export default function AgendaGenerale() {
  const router = useRouter()
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [view, setView] = useState<'day' | 'week'>('day')
  const [sourceFilter, setSourceFilter] = useState<string[]>(['hotel', 'ristorante', 'spa', 'padel'])
  const [stats, setStats] = useState({ hotel: 0, ristorante: 0, spa: 0, padel: 0, total: 0 })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadAll()
    })
  }, [selectedDate, view])

  const getDateRange = () => {
    const base = new Date(selectedDate)
    if (view === 'day') {
      return { from: selectedDate, to: selectedDate }
    } else {
      const day = base.getDay()
      const monday = new Date(base)
      monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return {
        from: monday.toISOString().split('T')[0],
        to: sunday.toISOString().split('T')[0],
      }
    }
  }

  const loadAll = async () => {
    setLoading(true)
    const { from, to } = getDateRange()

    const [hotelRes, spaRes, padelRes, ristoranteRes] = await Promise.all([
      supabase.from('reservations')
        .select('id, check_in, check_out, status, total_price, guest:guests(first_name,last_name), room_type:room_types(name), room:rooms(room_number)')
        .or(`check_in.gte.${from},check_out.gte.${from}`)
        .lte('check_in', to)
        .neq('status', 'cancelled')
        .order('check_in'),
      supabase.from('spa_appointments')
        .select('id, date, time, status, price, guest_name, service:spa_services(name, category)')
        .gte('date', from).lte('date', to)
        .neq('status', 'cancelled')
        .order('date').order('time'),
      supabase.from('padel_bookings')
        .select('id, date, start_time, end_time, status, price, player_name, court:padel_courts(name)')
        .gte('date', from).lte('date', to)
        .neq('status', 'cancelled')
        .order('date').order('start_time'),
      supabase.from('table_reservations')
        .select('id, date, time, status, guests_count, guest_name, table:restaurant_tables(table_number)')
        .gte('date', from).lte('date', to)
        .neq('status', 'cancelled')
        .order('date').order('time'),
    ])

    const all: AgendaItem[] = []

    // Hotel check-ins
    for (const r of hotelRes.data || []) {
      if (r.check_in >= from && r.check_in <= to) {
        all.push({
          id: `hotel-in-${r.id}`, time: '14:00', date: r.check_in,
          title: `${r.guest?.first_name} ${r.guest?.last_name}`,
          subtitle: `Check-in · ${r.room_type?.name}${r.room ? ` · Camera ${r.room.room_number}` : ''}`,
          source: 'hotel', status: r.status, price: r.total_price,
          color: SOURCE_CONFIG.hotel.color, icon: '📥', link: '/dashboard/hotel/prenotazioni',
        })
      }
      if (r.check_out >= from && r.check_out <= to) {
        all.push({
          id: `hotel-out-${r.id}`, time: '11:00', date: r.check_out,
          title: `${r.guest?.first_name} ${r.guest?.last_name}`,
          subtitle: `Check-out · ${r.room_type?.name}`,
          source: 'hotel', status: r.status, price: undefined,
          color: SOURCE_CONFIG.hotel.color, icon: '📤', link: '/dashboard/hotel/prenotazioni',
        })
      }
    }

    // Spa
    for (const a of spaRes.data || []) {
      const catIcon: Record<string, string> = { massaggio: '💆', piscina: '🏊', jacuzzi: '🛁', viso: '✨', corpo: '🧖', altro: '⭐' }
      all.push({
        id: `spa-${a.id}`, time: a.time?.slice(0, 5) || '00:00', date: a.date,
        title: a.guest_name,
        subtitle: a.service?.name || 'Servizio Spa',
        source: 'spa', status: a.status, price: a.price,
        color: SOURCE_CONFIG.spa.color,
        icon: catIcon[a.service?.category] || '💆',
        link: '/dashboard/spa/appuntamenti',
      })
    }

    // Padel
    for (const b of padelRes.data || []) {
      all.push({
        id: `padel-${b.id}`, time: b.start_time?.slice(0, 5) || '00:00', date: b.date,
        title: b.player_name,
        subtitle: `${b.court?.name} · ${b.start_time?.slice(0,5)}-${b.end_time?.slice(0,5)}`,
        source: 'padel', status: b.status, price: b.price,
        color: SOURCE_CONFIG.padel.color, icon: '🎾', link: '/dashboard/padel/prenotazioni',
      })
    }

    // Ristorante
    for (const r of ristoranteRes.data || []) {
      all.push({
        id: `rist-${r.id}`, time: r.time?.slice(0, 5) || '00:00', date: r.date,
        title: r.guest_name,
        subtitle: `Tavolo ${r.table?.table_number} · ${r.guests_count} persone`,
        source: 'ristorante', status: r.status, price: undefined,
        color: SOURCE_CONFIG.ristorante.color, icon: '🍽️', link: '/dashboard/ristorante/prenotazioni',
      })
    }

    // Ordina per data + ora
    all.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    setItems(all)

    setStats({
      hotel: (hotelRes.data || []).length,
      spa: (spaRes.data || []).length,
      padel: (padelRes.data || []).length,
      ristorante: (ristoranteRes.data || []).length,
      total: all.length,
    })
    setLoading(false)
  }

  const toggleSource = (src: string) => {
    setSourceFilter(prev =>
      prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
    )
  }

  const filtered = items.filter(i => sourceFilter.includes(i.source))

  // Raggruppa per data
  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = []
    acc[item.date].push(item)
    return acc
  }, {} as Record<string, AgendaItem[]>)

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00')
    return `${DAYS_IT[date.getDay()]} ${date.getDate()} ${MONTHS_IT[date.getMonth()]}`
  }

  const isToday = (d: string) => d === new Date().toISOString().split('T')[0]

  const navigate = (dir: number) => {
    const base = new Date(selectedDate)
    base.setDate(base.getDate() + (view === 'day' ? dir : dir * 7))
    setSelectedDate(base.toISOString().split('T')[0])
  }

  const STATUS_COLOR: Record<string, string> = {
    confirmed: '#3b82f6', checked_in: '#10b981', checked_out: '#6b7280',
    in_progress: '#f59e0b', completed: '#10b981', seated: '#10b981',
    pending: '#f59e0b',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280' }}>Caricamento agenda...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <span style={{ fontSize: '20px' }}>📆</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Agenda Generale</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['hotel', 'ristorante', 'spa', 'padel'] as const).map(src => {
            const cfg = SOURCE_CONFIG[src]
            const active = sourceFilter.includes(src)
            return (
              <Link key={src} href={`/dashboard/agenda/${src}`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '13px', border: `1px solid ${active ? cfg.color : '#2a2a3a'}`, background: active ? cfg.color + '20' : 'transparent', color: active ? cfg.color : '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {cfg.icon} {cfg.label}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* Controlli navigazione */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate(-1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '16px' }}>←</button>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', minWidth: '200px', textAlign: 'center' }}>
              {view === 'day' ? formatDate(selectedDate) : `Settimana del ${formatDate(selectedDate)}`}
            </div>
            <button onClick={() => navigate(1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '16px' }}>→</button>
            <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} style={{ padding: '6px 12px', background: '#1f2030', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '12px' }}>Oggi</button>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: '6px 10px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '13px' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Filtri fonte */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['hotel', 'ristorante', 'spa', 'padel'] as const).map(src => {
                const cfg = SOURCE_CONFIG[src]
                const active = sourceFilter.includes(src)
                return (
                  <button key={src} onClick={() => toggleSource(src)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', background: active ? cfg.color + '30' : '#111118', color: active ? cfg.color : '#374151', outline: `1px solid ${active ? cfg.color + '60' : '#1f2030'}` }}>
                    {cfg.icon} {cfg.label}
                  </button>
                )
              })}
            </div>
            <div style={{ width: '1px', height: '28px', background: '#1f2030' }} />
            {/* Vista giorno/settimana */}
            {(['day', 'week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', background: view === v ? '#3b82f6' : '#111118', color: view === v ? 'white' : '#9ca3af', outline: `1px solid ${view === v ? '#3b82f6' : '#1f2030'}` }}>
                {v === 'day' ? 'Giorno' : 'Settimana'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats veloci */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '24px' }}>
          {[
            { label: 'Totale', value: filtered.length, color: '#f1f1f1', icon: '📆' },
            { label: 'Hotel', value: items.filter(i => i.source === 'hotel').length, color: SOURCE_CONFIG.hotel.color, icon: '🏨' },
            { label: 'Ristorante', value: items.filter(i => i.source === 'ristorante').length, color: SOURCE_CONFIG.ristorante.color, icon: '🍽️' },
            { label: 'Spa', value: items.filter(i => i.source === 'spa').length, color: SOURCE_CONFIG.spa.color, icon: '💆' },
            { label: 'Padel', value: items.filter(i => i.source === 'padel').length, color: SOURCE_CONFIG.padel.color, icon: '🎾' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Agenda */}
        {Object.keys(grouped).length === 0 ? (
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '80px', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📆</div>
            <div style={{ fontSize: '16px' }}>Nessuna prenotazione per questo periodo</div>
          </div>
        ) : (
          Object.entries(grouped).map(([date, dayItems]) => (
            <div key={date} style={{ marginBottom: '24px' }}>
              {/* Header giorno */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px',
                paddingBottom: '10px', borderBottom: '2px solid ' + (isToday(date) ? '#3b82f6' : '#1f2030')
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: isToday(date) ? '#3b82f6' : '#111118',
                  border: `1px solid ${isToday(date) ? '#3b82f6' : '#1f2030'}`,
                }}>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: isToday(date) ? 'white' : '#f1f1f1', lineHeight: 1 }}>
                    {new Date(date + 'T12:00:00').getDate()}
                  </span>
                  <span style={{ fontSize: '9px', color: isToday(date) ? 'rgba(255,255,255,0.8)' : '#6b7280', textTransform: 'uppercase' }}>
                    {DAYS_IT[new Date(date + 'T12:00:00').getDay()]}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: isToday(date) ? '#3b82f6' : '#f1f1f1' }}>
                    {formatDate(date)} {isToday(date) && <span style={{ fontSize: '11px', background: '#3b82f630', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>OGGI</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>{dayItems.length} appuntamenti</div>
                </div>
              </div>

              {/* Items del giorno con timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px' }}>
                {dayItems.map((item, idx) => {
                  const cfg = SOURCE_CONFIG[item.source]
                  const statusColor = STATUS_COLOR[item.status] || '#6b7280'
                  return (
                    <Link key={item.id} href={item.link} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', gap: '16px', alignItems: 'stretch',
                        background: '#111118', border: `1px solid #1f2030`,
                        borderLeft: `3px solid ${cfg.color}`,
                        borderRadius: '10px', padding: '14px 18px',
                        cursor: 'pointer', transition: 'border-color 0.2s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = cfg.color)}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2030'; e.currentTarget.style.borderLeftColor = cfg.color }}
                      >
                        {/* Ora */}
                        <div style={{ minWidth: '52px', textAlign: 'center' }}>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: cfg.color }}>{item.time}</div>
                          <div style={{ fontSize: '10px', color: '#374151', marginTop: '2px' }}>{item.icon}</div>
                        </div>

                        {/* Separatore */}
                        <div style={{ width: '1px', background: '#1f2030', flexShrink: 0 }} />

                        {/* Contenuto */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ fontSize: '15px', fontWeight: '600', color: '#f1f1f1', marginBottom: '2px' }}>{item.title}</div>
                              <div style={{ fontSize: '13px', color: '#9ca3af' }}>{item.subtitle}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                              {item.price && <span style={{ fontSize: '14px', fontWeight: '600', color: '#f1f1f1' }}>€{Number(item.price).toFixed(0)}</span>}
                              <span style={{ background: cfg.color + '20', color: cfg.color, padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '500' }}>{cfg.icon} {cfg.label}</span>
                              <span style={{ background: statusColor + '20', color: statusColor, padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>{item.status}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
