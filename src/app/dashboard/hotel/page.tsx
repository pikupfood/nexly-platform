'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function HotelPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    total_rooms: 0,
    available: 0,
    occupied: 0,
    maintenance: 0,
    today_checkins: 0,
    today_checkouts: 0,
    upcoming_reservations: 0,
    occupancy_rate: 0,
  })
  const [recentReservations, setRecentReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const today = new Date().toISOString().split('T')[0]

    const [roomsRes, reservationsRes] = await Promise.all([
      supabase.from('rooms').select('status'),
      supabase.from('reservations')
        .select('*, guest:guests(first_name,last_name), room:rooms(room_number), room_type:room_types(name)')
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    const rooms = roomsRes.data || []
    const available = rooms.filter(r => r.status === 'available').length
    const occupied = rooms.filter(r => r.status === 'occupied').length
    const maintenance = rooms.filter(r => r.status === 'maintenance').length

    const todayCheckins = (reservationsRes.data || []).filter(r => r.check_in === today).length
    const todayCheckouts = (reservationsRes.data || []).filter(r => r.check_out === today).length
    const upcoming = (reservationsRes.data || []).filter(r => r.status === 'confirmed' && r.check_in >= today).length

    setStats({
      total_rooms: rooms.length,
      available,
      occupied,
      maintenance,
      today_checkins: todayCheckins,
      today_checkouts: todayCheckouts,
      upcoming_reservations: upcoming,
      occupancy_rate: rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0,
    })
    setRecentReservations(reservationsRes.data || [])
    setLoading(false)
  }

  const statusColor: Record<string, string> = {
    confirmed: '#3b82f6',
    pending: '#f59e0b',
    checked_in: '#10b981',
    checked_out: '#6b7280',
    cancelled: '#ef4444',
    no_show: '#7c3aed',
  }

  const statusLabel: Record<string, string> = {
    confirmed: 'Confermata',
    pending: 'In attesa',
    checked_in: 'Check-in',
    checked_out: 'Check-out',
    cancelled: 'Cancellata',
    no_show: 'No show',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280' }}>Caricamento...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <span style={{ color: '#2a2a3a' }}>|</span>
        <span style={{ fontSize: '20px' }}>🏨</span>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Hotel</h1>
      </div>

      <div style={{ padding: '32px' }}>
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Camere totali', value: stats.total_rooms, color: '#6b7280', icon: '🛏️' },
            { label: 'Disponibili', value: stats.available, color: '#10b981', icon: '✅' },
            { label: 'Occupate', value: stats.occupied, color: '#3b82f6', icon: '🔴' },
            { label: 'Manutenzione', value: stats.maintenance, color: '#f59e0b', icon: '🔧' },
            { label: 'Check-in oggi', value: stats.today_checkins, color: '#8b5cf6', icon: '📥' },
            { label: 'Check-out oggi', value: stats.today_checkouts, color: '#06b6d4', icon: '📤' },
            { label: 'Tasso occupazione', value: `${stats.occupancy_rate}%`, color: '#f59e0b', icon: '📊' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
          {[
            { href: '/dashboard/hotel/nuova-prenotazione', label: 'Nuova prenotazione', icon: '➕', color: '#3b82f6' },
            { href: '/dashboard/hotel/prenotazioni', label: 'Tutte le prenotazioni', icon: '📋', color: '#10b981' },
            { href: '/dashboard/hotel/camere', label: 'Gestione camere', icon: '🛏️', color: '#8b5cf6' },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#111118', border: `1px solid ${a.color}40`,
                borderRadius: '12px', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '12px',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = a.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = `${a.color}40`)}
              >
                <span style={{ fontSize: '24px' }}>{a.icon}</span>
                <span style={{ color: '#f1f1f1', fontWeight: '500', fontSize: '14px' }}>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent reservations */}
        <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1f2030', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Prenotazioni recenti</h2>
            <Link href="/dashboard/hotel/prenotazioni" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none' }}>Vedi tutte →</Link>
          </div>
          {recentReservations.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              Nessuna prenotazione ancora. <Link href="/dashboard/hotel/nuova-prenotazione" style={{ color: '#3b82f6' }}>Crea la prima →</Link>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f2030' }}>
                  {['N° Prenotazione', 'Ospite', 'Camera', 'Check-in', 'Check-out', 'Stato', 'Totale'].map(h => (
                    <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentReservations.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: i < recentReservations.length - 1 ? '1px solid #1f2030' : 'none' }}>
                    <td style={{ padding: '14px 24px', fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace' }}>{r.reservation_number}</td>
                    <td style={{ padding: '14px 24px', fontSize: '13px', color: '#f1f1f1' }}>
                      {r.guest ? `${r.guest.first_name} ${r.guest.last_name}` : '—'}
                    </td>
                    <td style={{ padding: '14px 24px', fontSize: '13px', color: '#9ca3af' }}>
                      {r.room ? `Camera ${r.room.room_number}` : r.room_type?.name || '—'}
                    </td>
                    <td style={{ padding: '14px 24px', fontSize: '13px', color: '#9ca3af' }}>{r.check_in}</td>
                    <td style={{ padding: '14px 24px', fontSize: '13px', color: '#9ca3af' }}>{r.check_out}</td>
                    <td style={{ padding: '14px 24px' }}>
                      <span style={{
                        background: `${statusColor[r.status]}20`,
                        color: statusColor[r.status],
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'
                      }}>{statusLabel[r.status]}</span>
                    </td>
                    <td style={{ padding: '14px 24px', fontSize: '13px', color: '#f1f1f1', fontWeight: '500' }}>
                      {r.total_price ? `€${Number(r.total_price).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
