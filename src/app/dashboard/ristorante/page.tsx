'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function RistorantePage() {
  const router = useRouter()
  const [stats, setStats] = useState({ free: 0, occupied: 0, reserved: 0, total: 0, open_orders: 0, today_reservations: 0 })
  const [tables, setTables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const today = new Date().toISOString().split('T')[0]
    const [tablesRes, ordersRes, resRes] = await Promise.all([
      supabase.from('restaurant_tables').select('*').order('table_number'),
      supabase.from('restaurant_orders').select('id').in('status', ['open', 'preparing', 'ready']),
      supabase.from('table_reservations').select('id').eq('date', today).neq('status', 'cancelled'),
    ])
    const t = tablesRes.data || []
    setTables(t)
    setStats({
      total: t.length,
      free: t.filter(x => x.status === 'free').length,
      occupied: t.filter(x => x.status === 'occupied').length,
      reserved: t.filter(x => x.status === 'reserved').length,
      open_orders: (ordersRes.data || []).length,
      today_reservations: (resRes.data || []).length,
    })
    setLoading(false)
  }

  const STATUS_COLOR: Record<string, string> = { free: '#10b981', occupied: '#ef4444', reserved: '#f59e0b', cleaning: '#8b5cf6' }
  const STATUS_LABEL: Record<string, string> = { free: 'Libero', occupied: 'Occupato', reserved: 'Prenotato', cleaning: 'Pulizia' }
  const LOC_ICON: Record<string, string> = { sala: '🏠', terrazza: '🌿', privato: '🔒', bar: '🍸' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280' }}>Caricamento...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <span style={{ color: '#2a2a3a' }}>|</span>
        <span style={{ fontSize: '20px' }}>🍽️</span>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Ristorante</h1>
      </div>

      <div style={{ padding: '32px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Tavoli totali', value: stats.total, color: '#6b7280', icon: '🪑' },
            { label: 'Liberi', value: stats.free, color: '#10b981', icon: '✅' },
            { label: 'Occupati', value: stats.occupied, color: '#ef4444', icon: '🔴' },
            { label: 'Prenotati', value: stats.reserved, color: '#f59e0b', icon: '📅' },
            { label: 'Ordini aperti', value: stats.open_orders, color: '#3b82f6', icon: '📋' },
            { label: 'Prenotazioni oggi', value: stats.today_reservations, color: '#8b5cf6', icon: '👥' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Azioni rapide */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
          {[
            { href: '/dashboard/ristorante/ordini', label: 'Gestione Ordini', icon: '📋', color: '#3b82f6' },
            { href: '/dashboard/ristorante/tavoli', label: 'Mappa Tavoli', icon: '🪑', color: '#10b981' },
            { href: '/dashboard/ristorante/prenotazioni', label: 'Prenotazioni', icon: '📅', color: '#f59e0b' },
            { href: '/dashboard/ristorante/menu', label: 'Gestione Menu', icon: '📖', color: '#8b5cf6' },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#111118', border: `1px solid ${a.color}40`, borderRadius: '12px', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
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

        {/* Mappa tavoli compatta */}
        <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1f2030', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Stato tavoli in tempo reale</h2>
            <div style={{ display: 'flex', gap: '16px' }}>
              {Object.entries(STATUS_COLOR).map(([k, c]) => (
                <span key={k} style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, display: 'inline-block' }} />
                  {STATUS_LABEL[k]}
                </span>
              ))}
            </div>
          </div>
          <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
            {tables.map(t => {
              const c = STATUS_COLOR[t.status]
              return (
                <Link key={t.id} href="/dashboard/ristorante/tavoli" style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: `${c}15`, border: `2px solid ${c}60`, borderRadius: '10px',
                    padding: '12px 8px', textAlign: 'center', cursor: 'pointer',
                  }}>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{LOC_ICON[t.location]}</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: c }}>{t.table_number}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>👤{t.capacity}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
