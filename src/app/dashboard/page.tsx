'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n-context'
import AppShell, { NavItem } from '@/components/AppShell'

const NAV_ITEMS: NavItem[] = [
  { key:'dashboard',  labelKey:'dashboard',  icon:'🏠', href:'/dashboard',            color:'#7c3aed' },
  { key:'hotel',      labelKey:'hotel',      icon:'🏨', href:'/dashboard/hotel',      color:'#2563eb' },
  { key:'restaurant', labelKey:'restaurant', icon:'🍽️', href:'/dashboard/ristorante', color:'#059669' },
  { key:'spa',        labelKey:'spa',        icon:'💆', href:'/dashboard/spa',         color:'#7c3aed' },
  { key:'padel',      labelKey:'padel',      icon:'🎾', href:'/dashboard/padel',       color:'#d97706' },
  { key:'clients',    labelKey:'clients',    icon:'👥', href:'/dashboard/clienti',     color:'#db2777' },
  { key:'staff',      labelKey:'staff',      icon:'👔', href:'/dashboard/staff',       color:'#0891b2' },
  { key:'invoices',   labelKey:'invoices',   icon:'🧾', href:'/dashboard/fatture',     color:'#dc2626' },
  { key:'agenda',     labelKey:'agenda',     icon:'📆', href:'/dashboard/agenda',      color:'#e11d48' },
  { key:'reports',    labelKey:'reports',    icon:'📊', href:'/dashboard/report',      color:'#7c3aed' },
]

export default function DashboardPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<any>({})
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [copied, setCopied] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      let { data: tenantRow } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      if (!tenantRow) {
        const { data: newT } = await supabase.from('tenants').insert([{ user_id: session.user.id, email: session.user.email, status: 'active', onboarding_step: 5 }]).select().single()
        tenantRow = newT
      }
      setTenant(tenantRow)
      await loadKPIs()
      setLoading(false)
    })
  }, [])

  const loadKPIs = async () => {
    const [resRes, spaRes, padelRes, tableRes, ordRes, invRes] = await Promise.all([
      supabase.from('reservations').select('status, check_in, check_out, total_price').neq('status', 'cancelled'),
      supabase.from('spa_appointments').select('status, date, price'),
      supabase.from('padel_bookings').select('status, date, price'),
      supabase.from('restaurant_tables').select('status'),
      supabase.from('restaurant_orders').select('status, total'),
      supabase.from('invoices').select('status, total, invoice_date').order('invoice_date'),
    ])
    const res = resRes.data||[], spa = spaRes.data||[], padel = padelRes.data||[]
    const tables = tableRes.data||[], orders = ordRes.data||[], inv = invRes.data||[]

    const months: Record<string,number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth()-i)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      months[key] = 0
    }
    inv.filter(i=>i.status==='paid').forEach(i => {
      const key = i.invoice_date?.slice(0,7)
      if (key && months[key]!==undefined) months[key]+=Number(i.total||0)
    })
    setRevenueData(Object.entries(months).map(([m,v])=>({ label: new Date(m+'-01').toLocaleDateString('fr-FR',{month:'short'}), value:v })))

    const acts: any[] = []
    res.filter(r=>r.check_in===today&&r.status==='confirmed').forEach(()=>acts.push({icon:'📥',color:'#2563eb',text:'Check-in attendu aujourd\'hui',href:'/dashboard/hotel/prenotazioni'}))
    res.filter(r=>r.check_out===today&&r.status==='checked_in').forEach(()=>acts.push({icon:'📤',color:'#94a3b8',text:'Check-out à effectuer',href:'/dashboard/hotel/prenotazioni'}))
    spa.filter(a=>a.date===today&&a.status!=='cancelled').forEach(()=>acts.push({icon:'💆',color:'#7c3aed',text:'Rendez-vous spa aujourd\'hui',href:'/dashboard/spa'}))
    padel.filter(b=>b.date===today&&b.status!=='cancelled').forEach(()=>acts.push({icon:'🎾',color:'#d97706',text:'Réservation padel aujourd\'hui',href:'/dashboard/padel'}))
    setActivity(acts.slice(0,8))

    setKpis({
      checkin_today: res.filter(r=>r.check_in===today&&r.status==='confirmed').length,
      checkout_today: res.filter(r=>r.check_out===today&&r.status==='checked_in').length,
      rooms_occupied: res.filter(r=>r.status==='checked_in').length,
      spa_today: spa.filter(a=>a.date===today&&a.status!=='cancelled').length,
      padel_today: padel.filter(b=>b.date===today&&b.status!=='cancelled').length,
      tables_free: tables.filter(tb=>tb.status==='free').length,
      tables_total: tables.length,
      open_orders: orders.filter(o=>['open','preparing','ready'].includes(o.status)).length,
      revenue_month: inv.filter(i=>i.status==='paid'&&i.invoice_date?.startsWith(today.slice(0,7))).reduce((s,i)=>s+Number(i.total||0),0),
      revenue_today: inv.filter(i=>i.status==='paid'&&i.invoice_date===today).reduce((s,i)=>s+Number(i.total||0),0),
    })
  }

  const maxRev = Math.max(...revenueData.map(d=>d.value), 1)

  const KPIS = [
    { label:t('checkinToday'),   value:kpis.checkin_today,  color:'#2563eb', icon:'📥', bg:'#eff6ff', href:'/dashboard/hotel/prenotazioni' },
    { label:t('checkoutToday'),  value:kpis.checkout_today, color:'#0891b2', icon:'📤', bg:'#ecfeff', href:'/dashboard/hotel/prenotazioni' },
    { label:t('rooms'),          value:kpis.rooms_occupied, color:'#7c3aed', icon:'🏨', bg:'#f5f3ff', href:'/dashboard/hotel' },
    { label:t('appointments'),   value:kpis.spa_today,      color:'#db2777', icon:'💆', bg:'#fdf2f8', href:'/dashboard/spa' },
    { label:t('bookings'),       value:kpis.padel_today,    color:'#d97706', icon:'🎾', bg:'#fffbeb', href:'/dashboard/padel' },
    { label:`Tavoli lib./${kpis.tables_total||0}`, value:kpis.tables_free, color:'#059669', icon:'🪑', bg:'#f0fdf4', href:'/dashboard/ristorante' },
    { label:t('openOrders'),     value:kpis.open_orders,    color:'#dc2626', icon:'📋', bg:'#fef2f2', href:'/dashboard/ristorante/ordini' },
    { label:'Revenue oggi',      value:`€${(kpis.revenue_today||0).toFixed(0)}`, color:'#059669', icon:'💶', bg:'#f0fdf4', href:'/dashboard/fatture' },
  ]

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f8f9fc', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'"DM Sans",sans-serif' }}>
      <div style={{ color:'#94a3b8', fontSize:'14px' }}>Chargement...</div>
    </div>
  )

  const actions = (
    <div style={{ display:'flex', gap:'8px' }}>
      <button onClick={loadKPIs} style={{ padding:'6px 12px', background:'white', border:'1px solid #e2e8f0', color:'#64748b', borderRadius:'7px', cursor:'pointer', fontSize:'12px', fontWeight:'500' }}>↻</button>
      <Link href="/dashboard/hotel/nuova-prenotazione" style={{ padding:'6px 14px', background:'#2563eb', color:'white', borderRadius:'7px', textDecoration:'none', fontSize:'12px', fontWeight:'600' }}>+ Réservation</Link>
    </div>
  )

  return (
    <AppShell items={NAV_ITEMS} title={t('dashboard')} subtitle={new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'24px 28px', maxWidth:'1400px' }}>

        {/* Saluto */}
        <div style={{ marginBottom:'24px' }}>
          <h2 style={{ fontSize:'22px', fontWeight:'700', color:'#0f172a', margin:'0 0 4px', fontFamily:'"DM Sans",sans-serif' }}>
            {t('hello')}{tenant?.business_name ? `, ${tenant.business_name}` : ''} 👋
          </h2>
          <p style={{ color:'#64748b', fontSize:'13px', margin:0 }}>Voici un aperçu de votre établissement aujourd'hui</p>
        </div>

        {/* KPI grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(155px,1fr))', gap:'12px', marginBottom:'24px' }}>
          {KPIS.map(k=>(
            <Link key={k.label} href={k.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'white', border:'1px solid #e8ecf0', borderRadius:'12px', padding:'16px', cursor:'pointer', transition:'all 0.15s', borderTop:`3px solid ${k.color}` }}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';e.currentTarget.style.transform='translateY(-1px)'}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none'}}>
                <div style={{ width:'36px', height:'36px', borderRadius:'8px', background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', marginBottom:'10px' }}>{k.icon}</div>
                <div style={{ fontSize:'24px', fontWeight:'700', color:k.color, lineHeight:1 }}>{k.value??0}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px', fontWeight:'500' }}>{k.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Revenue + Attività */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'16px', marginBottom:'24px' }}>
          {/* Revenue chart */}
          <div style={{ background:'white', border:'1px solid #e8ecf0', borderRadius:'14px', padding:'20px 24px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
              <div>
                <div style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a' }}>Revenue mensile</div>
                <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>Derniers 6 mois · factures payées</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'22px', fontWeight:'700', color:'#059669' }}>€{(kpis.revenue_month||0).toLocaleString('fr-FR',{minimumFractionDigits:0})}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8' }}>ce mois</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:'8px', height:'80px' }}>
              {revenueData.map((d,i)=>(
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                  {d.value>0&&<div style={{ fontSize:'9px', color:'#94a3b8' }}>€{d.value>=1000?(d.value/1000).toFixed(1)+'k':d.value.toFixed(0)}</div>}
                  <div style={{ width:'100%', borderRadius:'4px 4px 0 0', height:`${Math.max((d.value/maxRev)*60,d.value>0?4:2)}px`, background:i===revenueData.length-1?'#059669':'#d1fae5', transition:'height 0.3s' }} />
                  <div style={{ fontSize:'9px', color:'#cbd5e1' }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Attività oggi */}
          <div style={{ background:'white', border:'1px solid #e8ecf0', borderRadius:'14px', padding:'16px 18px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'14px' }}>Activité du jour</div>
            {activity.length===0 ? (
              <div style={{ color:'#cbd5e1', fontSize:'12px', textAlign:'center', padding:'20px 0' }}>Aucune activité</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {activity.map((a,i)=>(
                  <Link key={i} href={a.href} style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:'10px', padding:'7px 10px', borderRadius:'8px', background:'#f8f9fc', transition:'background 0.12s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'}
                    onMouseLeave={e=>e.currentTarget.style.background='#f8f9fc'}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:`${a.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', flexShrink:0 }}>{a.icon}</div>
                    <div style={{ fontSize:'12px', color:'#475569', lineHeight:1.3 }}>{a.text}</div>
                    <span style={{ marginLeft:'auto', fontSize:'11px', color:'#94a3b8' }}>→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Portale prenotazioni */}
        {tenant && (
          <div style={{ background:'white', border:'1px solid #e8ecf0', borderRadius:'12px', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <div style={{ width:'32px', height:'32px', background:'#eff6ff', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }}>🔗</div>
            <div>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'#0f172a' }}>Portail de réservation</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', fontFamily:'monospace' }}>{tenant.booking_url||`https://nexly-booking.vercel.app/${tenant.slug||'...'}`}</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:'6px' }}>
              <button onClick={()=>{navigator.clipboard?.writeText(tenant.booking_url||'');setCopied(true);setTimeout(()=>setCopied(false),2000)}}
                style={{ padding:'6px 12px', background:copied?'#f0fdf4':'#f8f9fc', border:`1px solid ${copied?'#86efac':'#e2e8f0'}`, color:copied?'#059669':'#64748b', borderRadius:'7px', cursor:'pointer', fontSize:'11px', fontWeight:'500', transition:'all 0.2s' }}>
                {copied?'✓ Copié':'📋 Copier'}
              </button>
              <a href={tenant.booking_url} target="_blank" rel="noreferrer"
                style={{ padding:'6px 12px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:'7px', textDecoration:'none', fontSize:'11px', fontWeight:'500' }}>
                ↗ Ouvrir
              </a>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
