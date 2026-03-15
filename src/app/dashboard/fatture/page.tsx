'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import { useStaffNav } from '@/lib/useStaffNav'

const SC: Record<string,{label:string;color:string}> = {
  draft:     { label:'Bozza',      color:'#94a3b8' },
  sent:      { label:'Inviata',    color:'#3b82f6' },
  paid:      { label:'Pagata',     color:'#10b981' },
  cancelled: { label:'Annullata',  color:'#ef4444' },
  refunded:  { label:'Rimborsata', color:'#f59e0b' },
}
const SOURCE_ICON: Record<string,string> = { hotel:'🏨', ristorante:'🍽️', spa:'💆', padel:'🎾', altro:'📋' }

export default function FatturePage() {
  const router = useRouter()
  const { t } = useI18n()
  const { backHref } = useStaffNav()
  const [invoices, setInvoices] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [stats, setStats] = useState({ total:0, paid:0, draft:0, revenue:0, revenue_month:0, avg_invoice:0 })
  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0,7) + '-01'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [])

  const load = async () => {
    const { data } = await supabase.from('invoices').select('*').order('invoice_date', { ascending:false })
    const all = data || []
    setInvoices(all)
    const paid = all.filter(i => i.status === 'paid')
    const revenue = paid.reduce((s,i) => s + Number(i.total||0), 0)
    const revMonth = paid.filter(i => i.invoice_date >= monthStart).reduce((s,i) => s + Number(i.total||0), 0)
    setStats({
      total:all.length, paid:paid.length, draft:all.filter(i=>i.status==='draft').length,
      revenue, revenue_month:revMonth, avg_invoice: paid.length > 0 ? revenue/paid.length : 0,
    })
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status }
    if (status === 'paid') updates.paid_at = new Date().toISOString()
    await supabase.from('invoices').update(updates).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? {...i,...updates} : i))
  }

  const exportCSV = () => {
    const rows = filtered.map(i => [i.invoice_number, `${i.client_first_name} ${i.client_last_name}`, i.invoice_date, i.status, i.total, i.source].join(','))
    const csv = ['N°,Cliente,Data,Stato,Totale,Fonte', ...rows].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `fatture_${today}.csv`
    a.click()
  }

  const filtered = invoices.filter(i => {
    const matchStatus = filter === 'all' || i.status === filter
    const name = `${i.client_first_name} ${i.client_last_name}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || i.invoice_number?.includes(search)
    const matchFrom = !dateFrom || i.invoice_date >= dateFrom
    const matchTo = !dateTo || i.invoice_date <= dateTo
    return matchStatus && matchSearch && matchFrom && matchTo
  })

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  return (
    <AppShell title="Factures" tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'20px 24px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Totale fatture', value:stats.total,       color:'#94a3b8', icon:'📄' },
            { label:'Pagate',         value:stats.paid,        color:'#10b981', icon:'✅' },
            { label:'Bozze',          value:stats.draft,       color:'#f59e0b', icon:'📝' },
            { label:'Revenue totale', value:`€${stats.revenue.toFixed(0)}`,       color:'#a855f7', icon:'💰' },
            { label:'Revenue mese',   value:`€${stats.revenue_month.toFixed(0)}`,  color:'#10b981', icon:'📅' },
            { label:'Media fattura',  value:`€${stats.avg_invoice.toFixed(0)}`,    color:'#3b82f6', icon:'📊' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontSize:'16px', marginBottom:'6px' }}>{s.icon}</div>
              <div style={{ fontSize:'20px', fontWeight:'700', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtri */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cerca cliente o numero..." style={{ padding:'8px 12px', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#0f172a', fontSize:'13px', outline:'none', width:'220px' }} />
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ padding:'8px 10px', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#64748b', fontSize:'12px', outline:'none' }} />
          <span style={{ color:'#94a3b8', fontSize:'12px' }}>→</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ padding:'8px 10px', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#64748b', fontSize:'12px', outline:'none' }} />
          {['all','draft','sent','paid','cancelled'].map(s => (
            <button key={s} onClick={()=>setFilter(s)} style={{ padding:'7px 13px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'12px', background:filter===s?'#ef4444':'#111118', color:filter===s?'white':'#9ca3af', outline:`1px solid ${filter===s?'#ef4444':'#1f2030'}` }}>
              {s==='all'?'Tutte':SC[s]?.label||s}
            </button>
          ))}
          {(search||dateFrom||dateTo) && <button onClick={()=>{setSearch('');setDateFrom('');setDateTo('')}} style={{ padding:'7px 12px', background:'none', border:'1px solid #e2e8f0', color:'#94a3b8', borderRadius:'7px', cursor:'pointer', fontSize:'12px' }}>✕ Reset</button>}
          <span style={{ fontSize:'12px', color:'#94a3b8', marginLeft:'auto' }}>{filtered.length} risultati</span>
        </div>

        {/* Lista fatture */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding:'60px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>
              Nessuna fattura trovata. <Link href="/dashboard/fatture/nuova" style={{ color:'#ef4444' }}>Crea la prima →</Link>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #e2e8f0' }}>
                  {['N°', 'Cliente', 'Data', 'Fonte', 'Stato', 'Totale', 'Azioni'].map(h => (
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'11px', color:'#94a3b8', fontWeight:'500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, i) => {
                  const sc = SC[inv.status] || SC.draft
                  return (
                    <tr key={inv.id} style={{ borderBottom: i < filtered.length-1 ? '1px solid #1f2030' : 'none' }}>
                      <td style={{ padding:'12px 16px', fontSize:'12px', color:'#94a3b8', fontFamily:'monospace' }}>
                        <Link href={`/dashboard/fatture/${inv.id}`} style={{ color:'#3b82f6', textDecoration:'none' }}>{inv.invoice_number}</Link>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:'13px', color:'#0f172a', fontWeight:'500' }}>
                        {inv.client_first_name} {inv.client_last_name}
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:'12px', color:'#64748b' }}>{inv.invoice_date}</td>
                      <td style={{ padding:'12px 16px', fontSize:'14px' }}>{SOURCE_ICON[inv.source]||'📋'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ background:`${sc.color}20`, color:sc.color, padding:'2px 9px', borderRadius:'12px', fontSize:'11px', fontWeight:'500' }}>{sc.label}</span>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:'14px', fontWeight:'700', color:'#0f172a' }}>€{Number(inv.total||0).toFixed(2)}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:'4px' }}>
                          <Link href={`/dashboard/fatture/${inv.id}`} style={{ padding:'4px 8px', background:'#3b82f620', color:'#60a5fa', borderRadius:'5px', textDecoration:'none', fontSize:'11px' }}>👁️</Link>
                          <Link href={`/dashboard/fatture/${inv.id}/stampa`} style={{ padding:'4px 8px', background:'#f1f5f9', color:'#64748b', borderRadius:'5px', textDecoration:'none', fontSize:'11px' }}>🖨️</Link>
                          {inv.status === 'draft' && (
                            <button onClick={()=>updateStatus(inv.id,'sent')} style={{ padding:'4px 8px', background:'#3b82f620', color:'#60a5fa', border:'none', borderRadius:'5px', cursor:'pointer', fontSize:'11px' }}>Invia</button>
                          )}
                          {inv.status === 'sent' && (
                            <button onClick={()=>updateStatus(inv.id,'paid')} style={{ padding:'4px 8px', background:'#10b98120', color:'#34d399', border:'none', borderRadius:'5px', cursor:'pointer', fontSize:'11px' }}>Paga</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  )
}
