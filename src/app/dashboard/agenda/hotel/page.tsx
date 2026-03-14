'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  confirmed:   { label: 'Confermata',  color: '#3b82f6' },
  checked_in:  { label: 'Check-in',    color: '#10b981' },
  checked_out: { label: 'Check-out',   color: '#6b7280' },
  pending:     { label: 'In attesa',   color: '#f59e0b' },
  no_show:     { label: 'No show',     color: '#7c3aed' },
  cancelled:   { label: 'Cancellata',  color: '#ef4444' },
}

export default function AgendaHotelPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [view, setView] = useState<'day' | 'week' | 'month'>('day')
  const [typeFilter, setTypeFilter] = useState<'all' | 'checkin' | 'checkout' | 'staying'>('all')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [selectedDate, view])

  const getDateRange = () => {
    const base = new Date(selectedDate)
    if (view === 'day') return { from: selectedDate, to: selectedDate }
    if (view === 'week') {
      const day = base.getDay()
      const monday = new Date(base)
      monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
      return { from: monday.toISOString().split('T')[0], to: sunday.toISOString().split('T')[0] }
    }
    // Month
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1)
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0)
    return { from: firstDay.toISOString().split('T')[0], to: lastDay.toISOString().split('T')[0] }
  }

  const loadData = async () => {
    setLoading(true)
    const { from, to } = getDateRange()
    const { data } = await supabase.from('reservations')
      .select('*, guest:guests(first_name,last_name,email,phone,nationality), room:rooms(room_number,floor), room_type:room_types(name,base_price)')
      .or(`and(check_in.gte.${from},check_in.lte.${to}),and(check_out.gte.${from},check_out.lte.${to}),and(check_in.lte.${from},check_out.gte.${to})`)
      .neq('status', 'cancelled')
      .order('check_in')
    setReservations(data || [])
    setLoading(false)
  }

  const navigate = (dir: number) => {
    const base = new Date(selectedDate)
    if (view === 'day') base.setDate(base.getDate() + dir)
    else if (view === 'week') base.setDate(base.getDate() + dir * 7)
    else base.setMonth(base.getMonth() + dir)
    setSelectedDate(base.toISOString().split('T')[0])
  }

  const nights = (ci: string, co: string) => Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000)

  const enriched = reservations.map(r => {
    const isCheckin = r.check_in === selectedDate
    const isCheckout = r.check_out === selectedDate
    const type = isCheckin ? 'checkin' : isCheckout ? 'checkout' : 'staying'
    return { ...r, type }
  })

  const filtered = enriched.filter(r => typeFilter === 'all' || r.type === typeFilter)

  // Agrupar por tipo
  const checkins = filtered.filter(r => r.type === 'checkin')
  const checkouts = filtered.filter(r => r.type === 'checkout')
  const staying = filtered.filter(r => r.type === 'staying')

  const isToday = (d: string) => d === new Date().toISOString().split('T')[0]
  const formatDate = (d: string) => { const dt = new Date(d + 'T12:00:00'); return `${DAYS_IT[dt.getDay()]} ${dt.getDate()} ${MONTHS_IT[dt.getMonth()]}` }

  const ReservationCard = ({ r, highlight }: { r: any, highlight: string }) => {
    const sc = STATUS_CFG[r.status] || { label: r.status, color: '#6b7280' }
    const n = nights(r.check_in, r.check_out)
    return (
      <Link href="/dashboard/hotel/prenotazioni" style={{ textDecoration: 'none' }}>
        <div style={{ background: '#111118', border: `1px solid #1f2030`, borderLeft: `3px solid ${highlight}`, borderRadius: '10px', padding: '16px 20px', marginBottom: '8px', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = highlight)}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2030'; e.currentTarget.style.borderLeftColor = highlight }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#f1f1f1', marginBottom: '2px' }}>
                {r.guest?.first_name} {r.guest?.last_name}
              </div>
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                {r.room_type?.name}{r.room ? ` · Camera ${r.room.room_number}` : ''} · {n} notti
              </div>
              {r.guest?.phone && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>📞 {r.guest.phone}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f1f1' }}>€{Number(r.total_price || 0).toFixed(0)}</div>
              <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>{sc.label}</span>
              {r.guest?.nationality && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>🌍 {r.guest.nationality}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #1f2030', fontSize: '12px', color: '#6b7280' }}>
            <span>📥 {r.check_in}</span>
            <span>→</span>
            <span>📤 {r.check_out}</span>
            {r.special_requests && <span>💬 {r.special_requests}</span>}
          </div>
        </div>
      </Link>
    )
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/agenda" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Agenda</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <span style={{ fontSize: '20px' }}>🏨</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Agenda Hotel</h1>
        </div>
        <Link href="/dashboard/hotel/nuova-prenotazione" style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>+ Nuova</Link>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* Navigazione */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '16px' }}>←</button>
          <div style={{ fontSize: '17px', fontWeight: '600', color: '#f1f1f1', minWidth: '180px', textAlign: 'center' }}>{formatDate(selectedDate)}</div>
          <button onClick={() => navigate(1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '16px' }}>→</button>
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} style={{ padding: '6px 12px', background: '#1f2030', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '12px' }}>Oggi</button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: '6px 10px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '13px' }} />
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['day','week','month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', background: view === v ? '#3b82f6' : '#111118', color: view === v ? 'white' : '#9ca3af', outline: `1px solid ${view === v ? '#3b82f6' : '#1f2030'}` }}>
                {v === 'day' ? 'Giorno' : v === 'week' ? 'Settimana' : 'Mese'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats + filtro tipo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { key: 'all', label: 'Tutti', value: enriched.length, color: '#f1f1f1', icon: '📋' },
            { key: 'checkin', label: 'Check-in', value: checkins.length, color: '#10b981', icon: '📥' },
            { key: 'checkout', label: 'Check-out', value: checkouts.length, color: '#6b7280', icon: '📤' },
            { key: 'staying', label: 'In soggiorno', value: staying.length, color: '#3b82f6', icon: '🛏️' },
          ].map(s => (
            <div key={s.key} onClick={() => setTypeFilter(s.key as any)} style={{
              background: typeFilter === s.key ? s.color + '20' : '#111118',
              border: `1px solid ${typeFilter === s.key ? s.color : '#1f2030'}`,
              borderRadius: '12px', padding: '16px', cursor: 'pointer', textAlign: 'center'
            }}>
              <div style={{ fontSize: '22px', marginBottom: '4px' }}>{s.icon}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Sezioni per tipo */}
        {filtered.length === 0 ? (
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏨</div>
            Nessuna prenotazione per questo periodo
          </div>
        ) : (
          <>
            {checkins.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📥 CHECK-IN ({checkins.length})
                </div>
                {checkins.map(r => <ReservationCard key={r.id} r={r} highlight="#10b981" />)}
              </div>
            )}
            {checkouts.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#6b7280', marginBottom: '12px' }}>📤 CHECK-OUT ({checkouts.length})</div>
                {checkouts.map(r => <ReservationCard key={r.id} r={r} highlight="#6b7280" />)}
              </div>
            )}
            {staying.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#3b82f6', marginBottom: '12px' }}>🛏️ IN SOGGIORNO ({staying.length})</div>
                {staying.map(r => <ReservationCard key={r.id} r={r} highlight="#3b82f6" />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
