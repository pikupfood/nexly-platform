'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function PadelPage() {
  const router = useRouter()
  const [courts, setCourts] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const today = new Date().toISOString().split('T')[0]
    const [courtsRes, bookRes] = await Promise.all([
      supabase.from('padel_courts').select('*').order('name'),
      supabase.from('padel_bookings').select('*, court:padel_courts(name)').gte('date', today).order('date').order('start_time').limit(10),
    ])
    setCourts(courtsRes.data || [])
    setBookings(bookRes.data || [])
    setLoading(false)
  }

  const SC: Record<string, { label: string; color: string }> = {
    confirmed:   { label: 'Confermata', color: '#3b82f6' },
    in_progress: { label: 'In corso',   color: '#f59e0b' },
    completed:   { label: 'Completata', color: '#10b981' },
    cancelled:   { label: 'Cancellata', color: '#ef4444' },
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <span style={{ color: '#2a2a3a' }}>|</span>
        <span style={{ fontSize: '20px' }}>🎾</span>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Padel</h1>
      </div>

      <div style={{ padding: '32px' }}>
        {/* Campi */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {courts.map(c => (
            <div key={c.id} style={{ background: '#111118', border: '1px solid #f59e0b40', borderRadius: '14px', padding: '24px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎾</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f1f1' }}>{c.name}</div>
              <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>{c.type === 'indoor' ? '🏠 Indoor' : '☀️ Outdoor'} · {c.surface}</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b', marginTop: '8px' }}>€{c.price_per_hour}/ora</div>
            </div>
          ))}
        </div>

        {/* Azioni */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
          {[
            { href: '/dashboard/padel/prenotazioni', label: 'Prenotazioni', icon: '📋', color: '#f59e0b' },
            { href: '/dashboard/padel/campi', label: 'Gestione Campi', icon: '🎾', color: '#10b981' },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#111118', border: `1px solid ${a.color}40`, borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = a.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = `${a.color}40`)}>
                <span style={{ fontSize: '24px' }}>{a.icon}</span>
                <span style={{ color: '#f1f1f1', fontWeight: '500', fontSize: '14px' }}>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Prossime prenotazioni */}
        <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1f2030', display: 'flex', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Prossime prenotazioni</h2>
            <Link href="/dashboard/padel/prenotazioni" style={{ fontSize: '13px', color: '#f59e0b', textDecoration: 'none' }}>Vedi tutte →</Link>
          </div>
          {bookings.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Nessuna prenotazione. <Link href="/dashboard/padel/prenotazioni" style={{ color: '#f59e0b' }}>Crea la prima →</Link></div>
          ) : (
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bookings.map(b => {
                const sc = SC[b.status]
                return (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1f2030' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#f1f1f1' }}>{b.player_name}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{b.court?.name} · {b.players_count} giocatori</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', color: '#f59e0b', fontWeight: '600' }}>{b.start_time?.slice(0,5)} - {b.end_time?.slice(0,5)}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{b.date}</div>
                      <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{sc.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
