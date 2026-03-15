'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import { useStaffNav } from '@/lib/useStaffNav'

const ST_COLOR: Record<string,string> = { free:'#10b981', occupied:'#ef4444', reserved:'#f59e0b', cleaning:'#8b5cf6' }
const ST_LABEL: Record<string,string> = { free:'Libero', occupied:'Occupato', reserved:'Prenotato', cleaning:'Pulizia' }
const LOC_ICON: Record<string,string> = { sala:'🏠', terrazza:'🌿', privato:'🔒', bar:'🍸' }
const ST_NEXT: Record<string,string> = { free:'occupied', occupied:'free', reserved:'occupied', cleaning:'free' }
const ST_NEXT_LABEL: Record<string,string> = { free:'→ Occupato', occupied:'→ Libera', reserved:'→ Occupa', cleaning:'→ Libera' }

export default function RistorantePage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const { t } = useI18n()
  const [stats, setStats] = useState({ free:0, occupied:0, reserved:0, total:0, open_orders:0, today_reservations:0, revenue_today:0 })
  const [tables, setTables] = useState<any[]>([])
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string|null>(null)
  const [filterLoc, setFilterLoc] = useState('all')
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [])

  const load = async () => {
    const [tRes, ordRes, resRes] = await Promise.all([
      supabase.from('restaurant_tables').select('*').order('table_number'),
      supabase.from('restaurant_orders').select('id, status, total, created_at, table:restaurant_tables(table_number)').order('created_at', { ascending:false }).limit(8),
      supabase.from('table_reservations').select('id').eq('date', today).neq('status','cancelled'),
    ])
    const t = tRes.data || []
    const ord = ordRes.data || []
    setTables(t)
    setRecentOrders(ord)
    const revToday = ord.filter(o => o.status === 'paid').reduce((s,o) => s + Number(o.total||0), 0)
    setStats({
      total:t.length, free:t.filter(x=>x.status==='free').length,
      occupied:t.filter(x=>x.status==='occupied').length, reserved:t.filter(x=>x.status==='reserved').length,
      open_orders:ord.filter(o=>['open','preparing','ready'].includes(o.status)).length,
      today_reservations:(resRes.data||[]).length, revenue_today:revToday,
    })
    setLoading(false)
  }

  const changeStatus = async (id: string, currentStatus: string) => {
    const next = ST_NEXT[currentStatus]
    setUpdating(id)
    const { error } = await supabase.rpc('toggle_table_status', { p_id:id, p_status:next })
    if (!error) setTables(prev => prev.map(t => t.id === id ? {...t, status:next} : t))
    setUpdating(null)
  }

  const locations = [...new Set(tables.map(t => t.location).filter(Boolean))]
  const filteredTables = filterLoc === 'all' ? tables : tables.filter(t => t.location === filterLoc)

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  return (
    <AppShell title="Restaurant" tenantName={tenant?.business_name} userEmail={user?.email}>
        <Link href="/dashboard/ristorante/ordini" style={{ padding:'8px 16px', background:'#10b981', color:'white', borderRadius:'8px', textDecoration:'none', fontSize:'13px', fontWeight:'500' }}>+ Nuovo ordine</Link>

      <div style={{ padding:'20px 24px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:t('tables'),  value:stats.total,      color:'#94a3b8', icon:'🪑' },
            { label:t('free'),         value:stats.free,       color:'#10b981', icon:'✅' },
            { label:t('occupied'),       value:stats.occupied,   color:'#ef4444', icon:'🔴' },
            { label:t('reserved'),      value:stats.reserved,   color:'#f59e0b', icon:'📅' },
            { label:t('openOrders'),  value:stats.open_orders, color:'#3b82f6', icon:'📋' },
            { label:t('today'), value:stats.today_reservations, color:'#8b5cf6', icon:'👥' },
            { label:t('revenue'),   value:`€${stats.revenue_today.toFixed(0)}`, color:'#f59e0b', icon:'💶' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontSize:'16px', marginBottom:'6px' }}>{s.icon}</div>
              <div style={{ fontSize:'20px', fontWeight:'700', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Azioni rapide */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(170px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { href:'/dashboard/ristorante/ordini',       label:t('orders'),   icon:'📋', color:'#3b82f6' },
            { href:'/dashboard/ristorante/prenotazioni', label:t('reservations'), icon:'📅', color:'#f59e0b' },
            { href:'/dashboard/ristorante/menu',         label:t('menu'),      icon:'📖', color:'#8b5cf6' },
            { href:'/dashboard/fatture',                 label:'Fatture',            icon:'🧾', color:'#ef4444' },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'white', border:`1px solid ${a.color}30`, borderRadius:'10px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', transition:'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = a.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = a.color+'30'}>
                <span style={{ fontSize:'18px' }}>{a.icon}</span>
                <span style={{ color:'#0f172a', fontSize:'13px', fontWeight:'500' }}>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'16px' }}>
          {/* Mappa tavoli interattiva */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #e2e8f0' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                <h2 style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', margin:0 }}>Mappa tavoli — click per cambiare stato</h2>
                <div style={{ display:'flex', gap:'10px' }}>
                  {Object.entries(ST_COLOR).map(([k,c]) => (
                    <span key={k} style={{ fontSize:'11px', color:'#94a3b8', display:'flex', alignItems:'center', gap:'4px' }}>
                      <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:c, display:'inline-block' }} />
                      {ST_LABEL[k]}
                    </span>
                  ))}
                </div>
              </div>
              {/* Filter per location */}
              {locations.length > 0 && (
                <div style={{ display:'flex', gap:'6px' }}>
                  {['all', ...locations].map(loc => (
                    <button key={loc} onClick={() => setFilterLoc(loc)} style={{
                      padding:'4px 10px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'11px',
                      background: filterLoc === loc ? '#3b82f6' : '#1f2030',
                      color: filterLoc === loc ? 'white' : '#6b7280',
                    }}>{loc === 'all' ? 'Tutti' : `${LOC_ICON[loc]||'📍'} ${loc}`}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(88px,1fr))', gap:'8px' }}>
              {filteredTables.map(t => {
                const c = ST_COLOR[t.status]||'#6b7280'
                const isUpdating = updating === t.id
                return (
                  <div key={t.id} onClick={() => !isUpdating && changeStatus(t.id, t.status)}
                    style={{ background:`${c}12`, border:`2px solid ${c}50`, borderRadius:'10px', padding:'12px 8px', textAlign:'center', cursor:isUpdating?'wait':'pointer', transition:'all 0.15s', opacity:isUpdating?0.6:1 }}
                    title={ST_NEXT_LABEL[t.status]}
                    onMouseEnter={e => { if(!isUpdating) e.currentTarget.style.borderColor = c }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c+'50' }}>
                    <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'2px' }}>{LOC_ICON[t.location]||'🪑'}</div>
                    <div style={{ fontSize:'15px', fontWeight:'700', color:c }}>{t.table_number}</div>
                    <div style={{ fontSize:'10px', color:'#94a3b8' }}>👤{t.capacity}</div>
                    <div style={{ fontSize:'9px', color:c, marginTop:'2px' }}>{isUpdating ? '...' : ST_LABEL[t.status]}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Ordini recenti */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', margin:0 }}>Ordini recenti</h2>
              <Link href="/dashboard/ristorante/ordini" style={{ fontSize:'12px', color:'#3b82f6', textDecoration:'none' }}>Tutti →</Link>
            </div>
            {recentOrders.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>Nessun ordine</div>
            ) : (
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'6px' }}>
                {recentOrders.map(o => {
                  const sc: Record<string,string> = { open:'#3b82f6', preparing:'#f59e0b', ready:'#8b5cf6', served:'#10b981', paid:'#6b7280', cancelled:'#ef4444' }
                  const sl: Record<string,string> = { open:'Aperto', preparing:'In preparazione', ready:'Pronto', served:'Servito', paid:'Pagato', cancelled:'Cancellato' }
                  const c = sc[o.status]||'#6b7280'
                  return (
                    <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:`${c}10`, border:`1px solid ${c}25`, borderRadius:'8px' }}>
                      <div>
                        <div style={{ fontSize:'12px', fontWeight:'600', color:'#0f172a' }}>Tavolo {o.table?.table_number||'—'}</div>
                        <div style={{ fontSize:'11px', color:c }}>{sl[o.status]||o.status}</div>
                      </div>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>€{Number(o.total||0).toFixed(0)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
