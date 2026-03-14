'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const SC: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Bozza',       color: '#6b7280' },
  sent:      { label: 'Inviata',     color: '#3b82f6' },
  paid:      { label: 'Pagata',      color: '#10b981' },
  cancelled: { label: 'Annullata',   color: '#ef4444' },
  refunded:  { label: 'Rimborsata',  color: '#f59e0b' },
}

const SOURCE_ICON: Record<string, string> = {
  hotel: '🏨', ristorante: '🍽️', spa: '💆', padel: '🎾', altro: '📋'
}

export default function FatturePage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ total: 0, paid: 0, draft: 0, revenue: 0 })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadInvoices()
    })
  }, [])

  const loadInvoices = async () => {
    const { data } = await supabase.from('invoices').select('*').order('invoice_date', { ascending: false })
    const all = data || []
    setInvoices(all)
    setStats({
      total: all.length,
      paid: all.filter(i => i.status === 'paid').length,
      draft: all.filter(i => i.status === 'draft').length,
      revenue: all.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0),
    })
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status }
    if (status === 'paid') updates.paid_at = new Date().toISOString()
    await supabase.from('invoices').update(updates).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const filtered = invoices.filter(i => {
    const matchStatus = filter === 'all' || i.status === filter
    const name = `${i.client_first_name} ${i.client_last_name}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || i.invoice_number?.includes(search)
    return matchStatus && matchSearch
  })

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <span style={{ fontSize: '20px' }}>🧾</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Fatture</h1>
        </div>
        <Link href="/dashboard/fatture/nuova" style={{ padding: '8px 16px', background: '#ef4444', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>+ Nuova fattura</Link>
      </div>

      <div style={{ padding: '32px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Totale fatture', value: stats.total, color: '#6b7280', icon: '🧾' },
            { label: 'Pagate', value: stats.paid, color: '#10b981', icon: '✅' },
            { label: 'Bozze', value: stats.draft, color: '#f59e0b', icon: '📝' },
            { label: 'Ricavi incassati', value: `€${stats.revenue.toFixed(2)}`, color: '#ef4444', icon: '💰' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtri */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cerca cliente o numero..." style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '14px', outline: 'none', width: '240px' }} />
          {['all', 'draft', 'sent', 'paid', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: filter === s ? '#ef4444' : '#111118', color: filter === s ? 'white' : '#9ca3af', outline: '1px solid ' + (filter === s ? '#ef4444' : '#1f2030') }}>
              {s === 'all' ? 'Tutte' : SC[s]?.label}
            </button>
          ))}
        </div>

        {/* Lista fatture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.length === 0 ? (
            <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
              Nessuna fattura. <Link href="/dashboard/fatture/nuova" style={{ color: '#ef4444' }}>Crea la prima →</Link>
            </div>
          ) : filtered.map(inv => {
            const sc = SC[inv.status]
            return (
              <div key={inv.id} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '18px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#ef4444', fontWeight: '600' }}>{inv.invoice_number}</span>
                      {inv.source && <span style={{ fontSize: '13px' }}>{SOURCE_ICON[inv.source]}</span>}
                      <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{sc.label}</span>
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: '600', color: '#f1f1f1' }}>{inv.client_first_name} {inv.client_last_name}</div>
                    {inv.client_email && <div style={{ fontSize: '13px', color: '#6b7280' }}>{inv.client_email}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '26px', fontWeight: '700', color: '#f1f1f1' }}>€{Number(inv.total).toFixed(2)}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>TVA {inv.tax_rate}% · {inv.invoice_date}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #1f2030', flexWrap: 'wrap' }}>
                  <Link href={`/dashboard/fatture/${inv.id}`} style={{ padding: '6px 14px', background: '#1f2030', color: '#9ca3af', border: '1px solid #2a2a3a', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>👁 Visualizza</Link>
                  <Link href={`/dashboard/fatture/${inv.id}/stampa`} style={{ padding: '6px 14px', background: '#1f2030', color: '#9ca3af', border: '1px solid #2a2a3a', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>🖨️ Stampa/PDF</Link>
                  {inv.status === 'draft' && <button onClick={() => updateStatus(inv.id, 'sent')} style={{ padding: '6px 14px', background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>📤 Invia</button>}
                  {['draft', 'sent'].includes(inv.status) && <button onClick={() => updateStatus(inv.id, 'paid')} style={{ padding: '6px 14px', background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>✓ Segna pagata</button>}
                  {['draft', 'sent'].includes(inv.status) && <button onClick={() => updateStatus(inv.id, 'cancelled')} style={{ padding: '6px 14px', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕ Annulla</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
