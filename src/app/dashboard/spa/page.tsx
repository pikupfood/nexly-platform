'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function SpaPage() {
  const router = useRouter()
  const [stats, setStats] = useState({ today: 0, upcoming: 0, completed: 0, revenue: 0 })
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('spa_appointments')
      .select('*, service:spa_services(name,duration_minutes), staff:spa_staff(name)')
      .order('date').order('time')
    const all = data || []
    setAppointments(all.slice(0, 8))
    setStats({
      today: all.filter(a => a.date === today).length,
      upcoming: all.filter(a => a.date >= today && a.status === 'confirmed').length,
      completed: all.filter(a => a.status === 'completed').length,
      revenue: all.filter(a => a.status === 'completed').reduce((s, a) => s + (a.price || 0), 0),
    })
    setLoading(false)
  }

  const SC: Record<string, { label: string; color: string }> = {
    confirmed:   { label: 'Confermato',   color: '#3b82f6' },
    in_progress: { label: 'In corso',     color: '#f59e0b' },
    completed:   { label: 'Completato',   color: '#10b981' },
    cancelled:   { label: 'Cancellato',   color: '#ef4444' },
    no_show:     { label: 'No show',      color: '#7c3aed' },
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <span style={{ color: '#2a2a3a' }}>|</span>
        <span style={{ fontSize: '20px' }}>💆</span>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Spa & Benessere</h1>
      </div>
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Appuntamenti oggi', value: stats.today, color: '#3b82f6', icon: '📅' },
            { label: 'Prossimi', value: stats.upcoming, color: '#f59e0b', icon: '⏰' },
            { label: 'Completati', value: stats.completed, color: '#10b981', icon: '✅' },
            { label: 'Ricavi', value: `€${stats.revenue.toFixed(0)}`, color: '#8b5cf6', icon: '💰' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
          {[
            { href: '/dashboard/spa/appuntamenti', label: 'Massaggi', icon: '💆', color: '#8b5cf6', cat: 'massaggio' },
            { href: '/dashboard/spa/appuntamenti?cat=piscina', label: 'Piscina', icon: '🏊', color: '#3b82f6', cat: 'piscina' },
            { href: '/dashboard/spa/appuntamenti?cat=jacuzzi', label: 'Jacuzzi', icon: '🛁', color: '#06b6d4', cat: 'jacuzzi' },
            { href: '/dashboard/spa/servizi', label: 'Servizi & Prezzi', icon: '📋', color: '#10b981' },
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

        <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1f2030', display: 'flex', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Prossimi appuntamenti</h2>
            <Link href="/dashboard/spa/appuntamenti" style={{ fontSize: '13px', color: '#8b5cf6', textDecoration: 'none' }}>Vedi tutti →</Link>
          </div>
          {appointments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              Nessun appuntamento. <Link href="/dashboard/spa/appuntamenti" style={{ color: '#8b5cf6' }}>Crea il primo →</Link>
            </div>
          ) : (
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {appointments.map(a => {
                const sc = SC[a.status]
                return (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1f2030' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#f1f1f1' }}>{a.guest_name}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{a.service?.name} · {a.staff?.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', color: '#8b5cf6', fontWeight: '600' }}>{a.date} {a.time?.slice(0,5)}</div>
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
