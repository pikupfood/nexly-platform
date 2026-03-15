'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useStaffNav } from '@/lib/useStaffNav'

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const CAT_CFG: Record<string, { label: string; color: string; icon: string }> = {
  massaggio: { label: 'Massaggi',  color: '#8b5cf6', icon: '💆' },
  piscina:   { label: 'Piscina',   color: '#3b82f6', icon: '🏊' },
  jacuzzi:   { label: 'Jacuzzi',   color: '#06b6d4', icon: '🛁' },
  viso:      { label: 'Viso',      color: '#ec4899', icon: '✨' },
  corpo:     { label: 'Corpo',     color: '#f97316', icon: '🧖' },
  altro:     { label: 'Altro',     color: '#6b7280', icon: '⭐' },
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  confirmed:   { label: 'Confermato',  color: '#3b82f6' },
  in_progress: { label: 'In corso',    color: '#f59e0b' },
  completed:   { label: 'Completato',  color: '#10b981' },
  cancelled:   { label: 'Cancellato',  color: '#ef4444' },
  no_show:     { label: 'No show',     color: '#7c3aed' },
}

export default function AgendaSpaPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [view, setView] = useState<'day' | 'week'>('day')
  const [catFilter, setCatFilter] = useState('all')

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
    const { data } = await supabase.from('spa_appointments')
      .select('*, service:spa_services(name, category, duration_minutes, price), staff:spa_staff(name)')
      .gte('date', from).lte('date', to)
      .neq('status', 'cancelled')
      .order('date').order('time')
    setAppointments(data || [])
    setLoading(false)
  }

  const navigate = (dir: number) => {
    const base = new Date(selectedDate)
    base.setDate(base.getDate() + (view === 'day' ? dir : dir * 7))
    setSelectedDate(base.toISOString().split('T')[0])
  }

  const formatDate = (d: string) => { const dt = new Date(d + 'T12:00:00'); return `${DAYS_IT[dt.getDay()]} ${dt.getDate()} ${MONTHS_IT[dt.getMonth()]}` }
  const isToday = (d: string) => d === new Date().toISOString().split('T')[0]

  const filtered = catFilter === 'all' ? appointments : appointments.filter(a => a.service?.category === catFilter)

  // Raggruppa per data poi per ora
  const byDate = filtered.reduce((acc, a) => {
    if (!acc[a.date]) acc[a.date] = []
    acc[a.date].push(a)
    return acc
  }, {} as Record<string, any[]>)

  const totalRevenue = filtered.filter(a => a.status === 'completed').reduce((s, a) => s + (a.price || 0), 0)

  if (loading) return <div style={{ minHeight: '100vh', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: 'white', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/agenda" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Agenda</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>💆 Agenda Spa</h1>
        </div>
        <Link href="/dashboard/spa/appuntamenti" style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>+ Nuovo</Link>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Navigazione */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer' }}>←</button>
          <div style={{ fontSize: '17px', fontWeight: '600', color: '#f1f1f1', minWidth: '180px', textAlign: 'center' }}>{formatDate(selectedDate)}</div>
          <button onClick={() => navigate(1)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer' }}>→</button>
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} style={{ padding: '6px 12px', background: '#1f2030', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '12px' }}>Oggi</button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: '6px 10px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '13px' }} />
          {(['day','week'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', background: view === v ? '#8b5cf6' : '#111118', color: view === v ? 'white' : '#9ca3af', outline: `1px solid ${view === v ? '#8b5cf6' : '#1f2030'}` }}>
              {v === 'day' ? 'Giorno' : 'Settimana'}
            </button>
          ))}
        </div>

        {/* Stats per categoria */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setCatFilter('all')} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: catFilter === 'all' ? '#8b5cf6' : '#111118', color: catFilter === 'all' ? 'white' : '#9ca3af', outline: `1px solid ${catFilter === 'all' ? '#8b5cf6' : '#1f2030'}` }}>
            ✨ Tutti ({appointments.length})
          </button>
          {Object.entries(CAT_CFG).map(([key, cfg]) => {
            const count = appointments.filter(a => a.service?.category === key).length
            if (count === 0) return null
            return (
              <button key={key} onClick={() => setCatFilter(key)} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: catFilter === key ? cfg.color + '30' : '#111118', color: catFilter === key ? cfg.color : '#9ca3af', outline: `1px solid ${catFilter === key ? cfg.color : '#1f2030'}` }}>
                {cfg.icon} {cfg.label} ({count})
              </button>
            )
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#10b981' }}>
            💰 Ricavi: €{totalRevenue.toFixed(2)}
          </div>
        </div>

        {/* Timeline per data */}
        {Object.keys(byDate).length === 0 ? (
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💆</div>
            Nessun appuntamento per questo periodo
          </div>
        ) : Object.entries(byDate).map(([date, dayApps]) => (
          <div key={date} style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: `2px solid ${isToday(date) ? '#8b5cf6' : '#1f2030'}` }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isToday(date) ? '#8b5cf6' : '#111118', border: `1px solid ${isToday(date) ? '#8b5cf6' : '#1f2030'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: isToday(date) ? 'white' : '#f1f1f1', lineHeight: 1 }}>{new Date(date + 'T12:00:00').getDate()}</span>
                <span style={{ fontSize: '9px', color: isToday(date) ? 'rgba(255,255,255,0.8)' : '#6b7280' }}>{DAYS_IT[new Date(date + 'T12:00:00').getDay()]}</span>
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: isToday(date) ? '#8b5cf6' : '#f1f1f1' }}>{formatDate(date)}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{dayApps.length} appuntamenti · €{dayApps.reduce((s, a) => s + (a.price || 0), 0).toFixed(0)}</div>
              </div>
            </div>

            {/* Slot orari */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dayApps.map((a: any) => {
                const cat = CAT_CFG[a.service?.category] || CAT_CFG.altro
                const sc = STATUS_CFG[a.status] || { label: a.status, color: '#6b7280' }
                return (
                  <Link key={a.id} href="/dashboard/spa/appuntamenti" style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', gap: '14px', background: '#111118', border: '1px solid #1f2030', borderLeft: `3px solid ${cat.color}`, borderRadius: '10px', padding: '12px 16px', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = cat.color)}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2030'; e.currentTarget.style.borderLeftColor = cat.color }}>
                      <div style={{ minWidth: '48px', textAlign: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: cat.color }}>{a.time?.slice(0,5)}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{a.service?.duration_minutes}m</div>
                      </div>
                      <div style={{ width: '1px', background: '#1f2030' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#f1f1f1' }}>{a.guest_name}</span>
                            <span style={{ fontSize: '12px', color: cat.color, marginLeft: '8px' }}>{cat.icon} {a.service?.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {a.price && <span style={{ fontSize: '13px', fontWeight: '600', color: '#f1f1f1' }}>€{a.price}</span>}
                            <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{sc.label}</span>
                          </div>
                        </div>
                        {a.staff?.name && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>👤 {a.staff.name}</div>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
