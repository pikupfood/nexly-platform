'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import { useStaffNav } from '@/lib/useStaffNav'

const STATUS_COLOR: Record<string,string> = { confirmed:'#3b82f6', pending:'#f59e0b', checked_in:'#10b981', checked_out:'#6b7280', cancelled:'#ef4444', no_show:'#7c3aed' }
const STATUS_LABEL: Record<string,string> = { confirmed:'Confermata', pending:'In attesa', checked_in:'Check-in', checked_out:'Check-out', cancelled:'Cancellata', no_show:'No show' }

export default function HotelPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const { t } = useI18n()
  const [stats, setStats] = useState({ total_rooms:0, available:0, occupied:0, maintenance:0, today_checkins:0, today_checkouts:0, occupancy_rate:0, week_revenue:0 })
  const [recent, setRecent] = useState<any[]>([])
  const [todayCheckins, setTodayCheckins] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [])

  const load = async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id
    const { data: t } = await supabase.from('tenants').select('id').eq('user_id', uid||'').single()
    const [statsRes, resRes] = await Promise.all([
      t ? supabase.rpc('get_hotel_stats', { p_tenant_id: t.id }) : Promise.resolve({ data: null }),
      supabase.from('reservations')
        .select('*, guest:guests(first_name,last_name,email,phone), room:rooms(room_number), room_type:room_types(name)')
        .order('created_at', { ascending: false }).limit(15),
    ])
    const s = statsRes.data || {}
    const all = resRes.data || []
    const occupied = s.occupied||0, total = s.total_rooms||0
    // Revenue settimana
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7)
    const weekRev = all.filter(r => r.status === 'checked_out' && new Date(r.check_out) >= weekAgo)
      .reduce((sum, r) => sum + Number(r.total_price||0), 0)
    setStats({ total_rooms:total, available:s.available||0, occupied, maintenance:s.maintenance||0,
      today_checkins:s.checkin_today||0, today_checkouts:s.checkout_today||0,
      occupancy_rate: total > 0 ? Math.round((occupied/total)*100) : 0, week_revenue: weekRev })
    setTodayCheckins(all.filter(r => (r.check_in === today && r.status === 'confirmed') || (r.check_out === today && r.status === 'checked_in')))
    setRecent(all)
    setLoading(false)
  }

  const nights = (a: string, b: string) => Math.round((new Date(b).getTime()-new Date(a).getTime())/(864e5))

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  return (
    <AppShell title="Hôtel" tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'20px 24px' }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(155px,1fr))', gap:'12px', marginBottom:'20px' }}>
          {[
            { label:t('totalRooms'), value:stats.total_rooms, color:'#94a3b8', icon:'🛏️' },
            { label:t('available'),   value:stats.available,   color:'#10b981', icon:'✅' },
            { label:t('occupied'),      value:stats.occupied,    color:'#3b82f6', icon:'🔑' },
            { label:t('maintenance'),  value:stats.maintenance, color:'#f59e0b', icon:'🔧' },
            { label:t('checkinToday'), value:stats.today_checkins,  color:'#8b5cf6', icon:'📥' },
            { label:t('checkoutToday'),value:stats.today_checkouts, color:'#06b6d4', icon:'📤' },
            { label:t('occupancyRate'),   value:`${stats.occupancy_rate}%`, color: stats.occupancy_rate > 70 ? '#10b981' : '#f59e0b', icon:'📊' },
            { label:t('revenue'), value:`€${stats.week_revenue.toFixed(0)}`, color:'#a855f7', icon:'💶' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 14px' }}>
              <div style={{ fontSize:'18px', marginBottom:'6px' }}>{s.icon}</div>
              <div style={{ fontSize:'22px', fontWeight:'700', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Azioni rapide */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { href:'/dashboard/hotel/nuova-prenotazione', label:t('newReservation'), icon:'➕', color:'#3b82f6' },
            { href:'/dashboard/hotel/prenotazioni',       label:t('reservations'), icon:'📋', color:'#10b981' },
            { href:'/dashboard/hotel/camere',             label:t('rooms'), icon:'🛏️', color:'#8b5cf6' },
            { href:'/dashboard/agenda/hotel',             label:t('agenda') + ' hotel', icon:'📆', color:'#f43f5e' },
            { href:'/dashboard/report',                   label:'Report',        icon:'📊', color:'#a855f7' },
            { href:'/dashboard/fatture',                  label:'Fatture',       icon:'🧾', color:'#ef4444' },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'white', border:`1px solid ${a.color}30`, borderRadius:'10px', padding:'16px 14px', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', transition:'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = a.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = a.color+'30'}>
                <span style={{ fontSize:'18px' }}>{a.icon}</span>
                <span style={{ color:'#0f172a', fontSize:'13px', fontWeight:'500' }}>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Check-in/out oggi */}
        {todayCheckins.length > 0 && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden', marginBottom:'20px' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', margin:0 }}>⚡ Azioni necessarie oggi</h2>
              <span style={{ fontSize:'12px', background:'#ef444420', color:'#f87171', padding:'2px 10px', borderRadius:'12px' }}>{todayCheckins.length} movimenti</span>
            </div>
            <div style={{ padding:'12px 20px', display:'flex', flexDirection:'column', gap:'8px' }}>
              {todayCheckins.map(r => {
                const isCI = r.check_in === today && r.status === 'confirmed'
                const c = isCI ? '#10b981' : '#3b82f6'
                return (
                  <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:`${c}10`, border:`1px solid ${c}30`, borderRadius:'10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <div style={{ fontSize:'16px' }}>{isCI ? '📥' : '📤'}</div>
                      <div>
                        <div style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a' }}>
                          {r.guest ? `${r.guest.first_name} ${r.guest.last_name}` : '—'}
                        </div>
                        <div style={{ fontSize:'12px', color:'#94a3b8' }}>
                          {r.room_type?.name} · {nights(r.check_in, r.check_out)} notti · €{Number(r.total_price||0).toFixed(0)}
                        </div>
                      </div>
                    </div>
                    <Link href="/dashboard/hotel/prenotazioni" style={{ padding:'6px 14px', background:c+'20', color:c, border:`1px solid ${c}40`, borderRadius:'8px', textDecoration:'none', fontSize:'12px', fontWeight:'500' }}>
                      {isCI ? t('checkin') + ' →' : t('checkout') + ' →'}
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Prenotazioni recenti */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', margin:0 }}>Prenotazioni recenti</h2>
            <Link href="/dashboard/hotel/prenotazioni" style={{ fontSize:'12px', color:'#3b82f6', textDecoration:'none' }}>Vedi tutte →</Link>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>
              Nessuna prenotazione. <Link href="/dashboard/hotel/nuova-prenotazione" style={{ color:'#3b82f6' }}>Crea la prima →</Link>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #e2e8f0' }}>
                  {['N°', 'Ospite', 'Camera', 'Check-in', 'Check-out', 'Stato', '€'].map(h => (
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'11px', color:'#94a3b8', fontWeight:'500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.slice(0,10).map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: i < 9 ? '1px solid #1f2030' : 'none' }}>
                    <td style={{ padding:'12px 16px', fontSize:'12px', color:'#94a3b8', fontFamily:'monospace' }}>{r.reservation_number}</td>
                    <td style={{ padding:'12px 16px', fontSize:'13px', color:'#0f172a', fontWeight:'500' }}>
                      {r.guest ? `${r.guest.first_name} ${r.guest.last_name}` : '—'}
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:'12px', color:'#64748b' }}>{r.room_type?.name||'—'}</td>
                    <td style={{ padding:'12px 16px', fontSize:'12px', color:'#64748b' }}>{r.check_in}</td>
                    <td style={{ padding:'12px 16px', fontSize:'12px', color:'#64748b' }}>{r.check_out}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ background:`${STATUS_COLOR[r.status]||'#6b7280'}20`, color:STATUS_COLOR[r.status]||'#6b7280', padding:'2px 8px', borderRadius:'12px', fontSize:'11px', fontWeight:'500' }}>
                        {STATUS_LABEL[r.status]||r.status}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:'13px', color:'#0f172a', fontWeight:'600' }}>
                      {r.total_price ? `€${Number(r.total_price).toFixed(0)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  )
}
