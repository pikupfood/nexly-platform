'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useStaffNav } from '@/lib/useStaffNav'

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confermata', color: '#3b82f6' },
  seated:    { label: 'Al tavolo',  color: '#10b981' },
  completed: { label: 'Completata', color: '#6b7280' },
  cancelled: { label: 'Cancellata', color: '#ef4444' },
  no_show:   { label: 'No show',    color: '#7c3aed' },
}

export default function AgendaRistorantePage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const [reservations, setReservations] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [view, setView] = useState<'day' | 'week'>('day')
  const [tab, setTab] = useState<'prenotazioni' | 'ordini'>('prenotazioni')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
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
    const [resRes, ordRes] = await Promise.all([
      supabase.from('table_reservations')
        .select('*, table:restaurant_tables(table_number, capacity, location)')
        .gte('date', from).lte('date', to)
        .neq('status', 'cancelled')
        .order('date').order('time'),
      supabase.from('restaurant_orders')
        .select('*, table:restaurant_tables(table_number)')
        .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    setReservations(resRes.data || [])
    setOrders(ordRes.data || [])
    setLoading(false)
  }

  const navigate = (dir: number) => {
    const base = new Date(selectedDate)
    base.setDate(base.getDate() + (view === 'day' ? dir : dir * 7))
    setSelectedDate(base.toISOString().split('T')[0])
  }

  const formatDate = (d: string) => { const dt = new Date(d + 'T12:00:00'); return `${DAYS_IT[dt.getDay()]} ${dt.getDate()} ${MONTHS_IT[dt.getMonth()]}` }
  const isToday = (d: string) => d === new Date().toISOString().split('T')[0]

  const byDate = reservations.reduce((acc, r) => {
    if (!acc[r.date]) acc[r.date] = []
    acc[r.date].push(r)
    return acc
  }, {} as Record<string, any[]>)

  const LOC_ICON: Record<string, string> = { sala: '🏠', terrazza: '🌿', privato: '🔒', bar: '🍸' }

  const ORDER_STATUS: Record<string, { label: string; color: string }> = {
    open: { label: 'Aperto', color: '#3b82f6' },
    preparing: { label: 'In cucina', color: '#f59e0b' },
    ready: { label: 'Pronto', color: '#10b981' },
    served: { label: 'Servito', color: '#6b7280' },
    paid: { label: 'Pagato', color: '#4ade80' },
  }

  if (loading) return <div style={{ minHeight: '100vh', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: 'white', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/agenda" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Agenda</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>🍽️ Agenda Ristorante</h1>
        </div>
        <Link href="/dashboard/ristorante/prenotazioni" style={{ padding: '8px 16px', background: '#10b981', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>+ Nuova</Link>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer' }}>←</button>
          <div style={{ fontSize: '17px', fontWeight: '600', color: '#f1f1f1', minWidth: '180px', textAlign: 'center' }}>{formatDate(selectedDate)}</div>
          <button onClick={() => navigate(1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer' }}>→</button>
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} style={{ padding: '6px 12px', background: '#1f2030', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '12px' }}>Oggi</button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: '6px 10px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '13px' }} />
          {(['day','week'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', background: view === v ? '#10b981' : '#111118', color: view === v ? 'white' : '#9ca3af', outline: `1px solid ${view === v ? '#10b981' : '#1f2030'}` }}>
              {v === 'day' ? 'Giorno' : 'Settimana'}
            </button>
          ))}
        </div>

        {/* Stats rapide */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Prenotazioni', value: reservations.length, color: '#10b981', icon: '📅' },
            { label: 'Ospiti', value: reservations.reduce((s, r) => s + r.guests_count, 0), color: '#3b82f6', icon: '👥' },
            { label: 'Ordini', value: orders.length, color: '#f59e0b', icon: '📋' },
            { label: 'Incassato', value: `€${orders.filter(o => o.status === 'paid').reduce((s, o) => s + Number(o.total || 0), 0).toFixed(0)}`, color: '#4ade80', icon: '💰' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '10px', padding: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab prenotazioni / ordini */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
          {(['prenotazioni', 'ordini'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: tab === t ? '#10b981' : '#111118', color: tab === t ? 'white' : '#9ca3af', outline: `1px solid ${tab === t ? '#10b981' : '#1f2030'}` }}>
              {t === 'prenotazioni' ? `📅 Prenotazioni (${reservations.length})` : `📋 Ordini (${orders.length})`}
            </button>
          ))}
        </div>

        {tab === 'prenotazioni' && (
          Object.keys(byDate).length === 0 ? (
            <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍽️</div>
              Nessuna prenotazione per questo periodo
            </div>
          ) : Object.entries(byDate).map(([date, dayRes]) => (
            <div key={date} style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: isToday(date) ? '#10b981' : '#9ca3af', marginBottom: '10px', paddingBottom: '8px', borderBottom: `2px solid ${isToday(date) ? '#10b981' : '#1f2030'}` }}>
                {formatDate(date)} {isToday(date) && '— OGGI'} · {dayRes.length} prenotazioni · {dayRes.reduce((s, r) => s + r.guests_count, 0)} ospiti
              </div>
              {dayRes.map((r: any) => {
                const sc = STATUS_CFG[r.status] || { label: r.status, color: '#6b7280' }
                return (
                  <Link key={r.id} href="/dashboard/ristorante/prenotazioni" style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', gap: '14px', background: '#111118', border: '1px solid #1f2030', borderLeft: '3px solid #10b981', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#10b981')}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2030'; e.currentTarget.style.borderLeftColor = '#10b981' }}>
                      <div style={{ minWidth: '48px', textAlign: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#10b981' }}>{r.time?.slice(0,5)}</div>
                      </div>
                      <div style={{ width: '1px', background: '#1f2030' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#f1f1f1' }}>{r.guest_name}</span>
                            <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>
                              {LOC_ICON[r.table?.location] || '🍽️'} Tavolo {r.table?.table_number} · {r.guests_count} persone
                            </span>
                          </div>
                          <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{sc.label}</span>
                        </div>
                        {r.notes && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>💬 {r.notes}</div>}
                        {r.guest_phone && <div style={{ fontSize: '12px', color: '#6b7280' }}>📞 {r.guest_phone}</div>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ))
        )}

        {tab === 'ordini' && (
          orders.length === 0 ? (
            <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
              Nessun ordine per questo periodo
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {orders.map((o: any) => {
                const sc = ORDER_STATUS[o.status] || { label: o.status, color: '#6b7280' }
                return (
                  <Link key={o.id} href="/dashboard/ristorante/ordini" style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111118', border: '1px solid #1f2030', borderLeft: '3px solid #10b981', borderRadius: '10px', padding: '14px 18px', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f1f1' }}>Tavolo {o.table?.table_number} · {o.order_number}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{new Date(o.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: '#f1f1f1' }}>€{Number(o.total || 0).toFixed(2)}</span>
                        <span style={{ background: sc.color + '20', color: sc.color, padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>{sc.label}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
