// @nexly-1773582529
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import { useStaffNav } from '@/lib/useStaffNav'

export default function ReportPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d'|'30d'|'90d'|'year'>('30d')
  const [data, setData] = useState<any>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [period])

  const load = async () => {
    setLoading(true)
    const now = new Date()
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
    const from = new Date(now); from.setDate(from.getDate() - days)
    const fromStr = from.toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    const [resRes, spaRes, padelRes, invRes, tblResRes] = await Promise.all([
      supabase.from('reservations').select('status, check_in, check_out, total_price, channel, created_at').gte('created_at', from.toISOString()),
      supabase.from('spa_appointments').select('status, date, price, created_at').gte('created_at', from.toISOString()),
      supabase.from('padel_bookings').select('status, date, price, created_at').gte('created_at', from.toISOString()),
      supabase.from('invoices').select('status, total, invoice_date, source').gte('invoice_date', fromStr),
      supabase.from('table_reservations').select('status, date, guests_count, created_at').gte('created_at', from.toISOString()),
    ])

    const res = resRes.data || []
    const spa = spaRes.data || []
    const padel = padelRes.data || []
    const inv = invRes.data || []
    const tblRes = tblResRes.data || []

    // Revenue per fonte
    const revBySource: Record<string,number> = { hotel:0, spa:0, padel:0, ristorante:0, altro:0 }
    inv.filter(i=>i.status==='paid').forEach(i => {
      const src = i.source || 'altro'
      revBySource[src] = (revBySource[src]||0) + Number(i.total||0)
    })

    // Revenue giornaliera ultimi N giorni (max 30 per UI)
    const chartDays = Math.min(days, 30)
    const dailyRev: {label:string;value:number}[] = []
    for (let i = chartDays-1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i)
      const ds = d.toISOString().split('T')[0]
      const val = inv.filter(iv => iv.status==='paid' && iv.invoice_date === ds).reduce((s,iv)=>s+Number(iv.total||0),0)
      dailyRev.push({ label: d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'}), value:val })
    }

    // Occupazione hotel
    const occupancyDays = res.filter(r=>['confirmed','checked_in','checked_out'].includes(r.status))
    
    setData({
      // KPI principali
      total_revenue: Object.values(revBySource).reduce((s,v)=>s+v, 0),
      hotel_res: res.length,
      spa_appts: spa.length,
      padel_bks: padel.length,
      table_res: tblRes.length,
      invoices_paid: inv.filter(i=>i.status==='paid').length,
      invoices_total: inv.length,
      
      // Revenue per fonte
      revBySource,
      
      // Grafici
      dailyRev,
      
      // Canali prenotazione hotel
      channels: res.reduce((acc:any, r) => { acc[r.channel||'direct']=(acc[r.channel||'direct']||0)+1; return acc }, {}),
      
      // Performance spa
      spa_revenue: spa.filter(a=>a.status==='completed').reduce((s,a)=>s+Number(a.price||0),0),
      spa_completed: spa.filter(a=>a.status==='completed').length,
      spa_noshow: spa.filter(a=>a.status==='no_show').length,
      
      // Performance padel
      padel_revenue: padel.filter(b=>b.status==='completed').reduce((s,b)=>s+Number(b.price||0),0),
      padel_completed: padel.filter(b=>b.status==='completed').length,
    })
    setLoading(false)
  }

  const maxRev = Math.max(...(data.dailyRev||[]).map((d:any)=>d.value), 1)
  const totalRevSources = Object.values(data.revBySource||{}).reduce((s:any,v:any)=>s+v, 0) as number

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  return (
    <AppShell title="Rapports" tenantName={tenant?.business_name} userEmail={user?.email}>
        <div style={{ display:'flex', gap:'6px' }}>
          {([['7d','7g'],['30d','30g'],['90d','90g'],['year','Anno']] as const).map(([k,l]) => (
            <button key={k} onClick={()=>setPeriod(k)} style={{
              padding:'6px 12px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'12px',
              background: period===k?'#a855f7':'#111118', color:period===k?'white':'#9ca3af',
              outline:`1px solid ${period===k?'#a855f7':'#1f2030'}`,
            }}>{l}</button>
          ))}
          <button onClick={load} style={{ padding:'6px 12px', background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#94a3b8', borderRadius:'7px', cursor:'pointer', fontSize:'12px' }}>↻</button>

      <div style={{ padding:'20px 24px' }}>
        {/* KPI principali */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px,1fr))', gap:'10px', marginBottom:'24px' }}>
          {[
            { label:'Revenue totale', value:`€${(data.total_revenue||0).toLocaleString('it-IT',{minimumFractionDigits:0})}`, color:'#10b981', icon:'💶' },
            { label:'Prenotazioni hotel', value:data.hotel_res||0, color:'#3b82f6', icon:'🏨' },
            { label:'Appuntam. spa', value:data.spa_appts||0, color:'#8b5cf6', icon:'💆' },
            { label:'Prenotaz. padel', value:data.padel_bks||0, color:'#f59e0b', icon:'🎾' },
            { label:'Prenotaz. ristorante', value:data.table_res||0, color:'#10b981', icon:'🍽️' },
            { label:'Fatture pagate', value:`${data.invoices_paid||0}/${data.invoices_total||0}`, color:'#ef4444', icon:'🧾' },
          ].map(k => (
            <div key={k.label} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontSize:'16px', marginBottom:'6px' }}>{k.icon}</div>
              <div style={{ fontSize:'20px', fontWeight:'700', color:k.color }}>{k.value}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'3px' }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'16px', marginBottom:'20px' }}>
          {/* Grafico revenue giornaliero */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'20px 24px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', marginBottom:'4px' }}>Revenue giornaliero</div>
            <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'16px' }}>
              Ultimi {Math.min(parseInt(period), 30)} giorni · fatture pagate
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:'90px', overflowX:'auto' }}>
              {(data.dailyRev||[]).map((d:any, i:number) => (
                <div key={i} style={{ flex:'0 0 auto', width:'28px', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' }}>
                  {d.value > 0 && <div style={{ fontSize:'8px', color:'#94a3b8', whiteSpace:'nowrap' }}>€{d.value>=1000?(d.value/1000).toFixed(1)+'k':d.value.toFixed(0)}</div>}
                  <div style={{
                    width:'100%', borderRadius:'3px 3px 0 0',
                    height:`${Math.max((d.value/maxRev)*65, d.value>0?4:2)}px`,
                    background: d.value > 0 ? '#10b981' : '#1f2030',
                  }} />
                  <div style={{ fontSize:'8px', color:'#94a3b8', transform:'rotate(-45deg)', transformOrigin:'top left', marginTop:'4px', whiteSpace:'nowrap' }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue per fonte */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'20px 24px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', marginBottom:'16px' }}>Revenue per modulo</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { src:'hotel', label:'Hotel', color:'#3b82f6', icon:'🏨' },
                { src:'spa', label:'Spa', color:'#8b5cf6', icon:'💆' },
                { src:'padel', label:'Padel', color:'#f59e0b', icon:'🎾' },
                { src:'ristorante', label:'Ristorante', color:'#10b981', icon:'🍽️' },
              ].map(s => {
                const val = (data.revBySource||{})[s.src]||0
                const pct = totalRevSources > 0 ? (val/totalRevSources)*100 : 0
                return (
                  <div key={s.src}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                      <span style={{ fontSize:'12px', color:'#d1d5db' }}>{s.icon} {s.label}</span>
                      <span style={{ fontSize:'12px', fontWeight:'600', color:s.color }}>€{val.toFixed(0)}</span>
                    </div>
                    <div style={{ height:'5px', background:'#f1f5f9', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:s.color, borderRadius:'3px', transition:'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Dettaglio moduli */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          {/* Spa stats */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'18px 22px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#8b5cf6', marginBottom:'12px' }}>💆 Spa performance</div>
            {[
              { label:'Revenue completati', value:`€${(data.spa_revenue||0).toFixed(0)}`, color:'#10b981' },
              { label:'Appuntamenti completati', value:data.spa_completed||0, color:'#8b5cf6' },
              { label:'No show', value:data.spa_noshow||0, color:'#ef4444' },
              { label:'Tasso no-show', value:data.spa_appts>0?`${Math.round((data.spa_noshow||0)/data.spa_appts*100)}%`:'—', color:'#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #e2e8f0' }}>
                <span style={{ fontSize:'12px', color:'#64748b' }}>{s.label}</span>
                <span style={{ fontSize:'13px', fontWeight:'600', color:s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Padel stats */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'18px 22px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#f59e0b', marginBottom:'12px' }}>🎾 Padel performance</div>
            {[
              { label:'Revenue completate', value:`€${(data.padel_revenue||0).toFixed(0)}`, color:'#10b981' },
              { label:'Prenotazioni completate', value:data.padel_completed||0, color:'#f59e0b' },
              { label:'Canali hotel', value:Object.entries(data.channels||{}).map(([k,v])=>`${k}: ${v}`).join(', ')||'—', color:'#94a3b8' },
            ].map(s => (
              <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #e2e8f0', gap:'8px' }}>
                <span style={{ fontSize:'12px', color:'#64748b', flexShrink:0 }}>{s.label}</span>
                <span style={{ fontSize:'12px', fontWeight:'600', color:s.color, textAlign:'right' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Link ai report dettagliati per modulo */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'10px', marginTop:'20px' }}>
          {[
            { href:'/dashboard/report/hotel',      label:'Report Hotel',       icon:'🏨', color:'#3b82f6' },
            { href:'/dashboard/report/ristorante',  label:'Report Ristorante', icon:'🍽️', color:'#10b981' },
            { href:'/dashboard/report/spa',         label:'Report Spa',        icon:'💆', color:'#8b5cf6' },
            { href:'/dashboard/report/padel',       label:'Report Padel',      icon:'🎾', color:'#f59e0b' },
          ].map(m => (
            <Link key={m.href} href={m.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'white', border:`1px solid ${m.color}30`, borderRadius:'10px', padding:'16px 14px', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', transition:'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor=m.color}
                onMouseLeave={e => e.currentTarget.style.borderColor=m.color+'30'}>
                <span style={{ fontSize:'20px' }}>{m.icon}</span>
                <span style={{ fontSize:'13px', fontWeight:'500', color:'#0f172a' }}>{m.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
