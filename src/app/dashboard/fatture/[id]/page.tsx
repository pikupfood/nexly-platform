'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function FatturaDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [invoice, setInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadInvoice()
    })
  }, [])

  const loadInvoice = async () => {
    const [invRes, itemsRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', params.id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', params.id).order('sort_order'),
    ])
    setInvoice(invRes.data)
    setItems(itemsRes.data || [])
    setLoading(false)
  }

  const updateStatus = async (status: string) => {
    const updates: any = { status }
    if (status === 'paid') updates.paid_at = new Date().toISOString()
    await supabase.from('invoices').update(updates).eq('id', params.id)
    setInvoice((prev: any) => ({ ...prev, ...updates }))
  }

  const SC: Record<string, { label: string; color: string }> = {
    draft: { label: 'Bozza', color: '#6b7280' },
    sent: { label: 'Inviata', color: '#3b82f6' },
    paid: { label: 'Pagata', color: '#10b981' },
    cancelled: { label: 'Annullata', color: '#ef4444' },
  }

  if (loading || !invoice) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  const sc = SC[invoice.status]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/fatture" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Fatture</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <span style={{ fontFamily: 'monospace', color: '#ef4444', fontWeight: '600' }}>{invoice.invoice_number}</span>
          <span style={{ background: sc.color + '20', color: sc.color, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>{sc.label}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href={`/dashboard/fatture/${params.id}/stampa`} style={{ padding: '8px 16px', background: '#1f2030', color: '#9ca3af', border: '1px solid #2a2a3a', borderRadius: '8px', fontSize: '14px', textDecoration: 'none' }}>🖨️ Stampa/PDF</Link>
          {invoice.status === 'draft' && <button onClick={() => updateStatus('sent')} style={{ padding: '8px 16px', background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>📤 Invia</button>}
          {['draft','sent'].includes(invoice.status) && <button onClick={() => updateStatus('paid')} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>✓ Pagata</button>}
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>ÉMETTEUR</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f1f1' }}>{invoice.seller_name}</div>
              <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px', whiteSpace: 'pre-line' }}>{invoice.seller_address}</div>
              {invoice.seller_siret && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>SIRET: {invoice.seller_siret}</div>}
              {invoice.seller_vat && <div style={{ fontSize: '12px', color: '#6b7280' }}>TVA: {invoice.seller_vat}</div>}
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>CLIENT</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f1f1' }}>{invoice.client_first_name} {invoice.client_last_name}</div>
              {invoice.client_address && <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>{invoice.client_address}</div>}
              {(invoice.client_postal_code || invoice.client_city) && <div style={{ fontSize: '13px', color: '#9ca3af' }}>{invoice.client_postal_code} {invoice.client_city}</div>}
              {invoice.client_email && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{invoice.client_email}</div>}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #1f2030' }}>
                {['Description', 'Qté', 'P.U. HT', 'TVA', 'Total HT'].map(h => (
                  <th key={h} style={{ padding: '10px', textAlign: h === 'Description' ? 'left' : 'right', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #1f2030' }}>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#f1f1f1' }}>{item.description}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#9ca3af', textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#9ca3af', textAlign: 'right' }}>€{Number(item.unit_price).toFixed(2)}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#9ca3af', textAlign: 'right' }}>{item.tax_rate}%</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#f1f1f1', fontWeight: '500', textAlign: 'right' }}>€{Number(item.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '240px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}><span>Sous-total HT</span><span>€{Number(invoice.subtotal).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9ca3af', marginBottom: '10px' }}><span>TVA</span><span>€{Number(invoice.tax_amount).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: '700', color: '#f1f1f1', borderTop: '2px solid #1f2030', paddingTop: '10px' }}><span>TOTAL TTC</span><span>€{Number(invoice.total).toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
