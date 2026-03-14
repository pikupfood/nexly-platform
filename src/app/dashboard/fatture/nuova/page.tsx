'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'
import Link from 'next/link'

const TVA_RATES = [
  { value: 20, label: '20% — Taux normal' },
  { value: 10, label: '10% — Taux réduit (hôtellerie, restauration)' },
  { value: 5.5, label: '5.5% — Taux réduit (alimentation)' },
  { value: 0, label: '0% — Exonéré' },
]

interface Item {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  total: number
}

function NuovaFatturaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  // Dati venditore
  const [seller, setSeller] = useState({
    name: 'Nexly Hub SAS',
    address: '',
    siret: '',
    vat: '',
    ape: '5510Z',
  })

  // Dati cliente
  const [client, setClient] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    address: '', city: '', postal_code: '', country: 'France',
    siret: '', vat_number: '',
  })

  // Dati fattura
  const [invoice, setInvoice] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    source: 'altro',
    source_id: '',
    payment_method: 'card',
    notes: '',
    tax_rate: 10,
  })

  // Righe
  const [items, setItems] = useState<Item[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 10, total: 0 }
  ])

  // Dati pre-popolamento da source
  const [sourceOptions, setSourceOptions] = useState<{ hotel: any[], spa: any[], padel: any[], ristorante: any[] }>({ hotel: [], spa: [], padel: [], ristorante: [] })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadSourceOptions()
    })
  }, [])

  const loadSourceOptions = async () => {
    const [hotelRes, spaRes, padelRes, ristoranteRes] = await Promise.all([
      supabase.from('reservations').select('id, reservation_number, total_price, check_in, check_out, guest:guests(first_name,last_name,email,phone), room_type:room_types(name)').in('status', ['confirmed','checked_in','checked_out']).order('check_in', { ascending: false }).limit(50),
      supabase.from('spa_appointments').select('id, appointment_number, guest_name, guest_email, guest_phone, price, service:spa_services(name)').in('status', ['confirmed','in_progress','completed']).order('date', { ascending: false }).limit(50),
      supabase.from('padel_bookings').select('id, booking_number, player_name, player_email, player_phone, price, court:padel_courts(name), date, start_time, end_time').in('status', ['confirmed','in_progress','completed']).order('date', { ascending: false }).limit(50),
      supabase.from('restaurant_orders').select('id, order_number, total, table:restaurant_tables(table_number)').in('status', ['open','preparing','ready','served','paid']).order('created_at', { ascending: false }).limit(50),
    ])
    setSourceOptions({
      hotel: hotelRes.data || [],
      spa: spaRes.data || [],
      padel: padelRes.data || [],
      ristorante: ristoranteRes.data || [],
    })

    // Pre-popola se arriva da un modulo
    const src = searchParams.get('source')
    const srcId = searchParams.get('id')
    if (src && srcId) {
      setInvoice(prev => ({ ...prev, source: src, source_id: srcId }))
      await prefillFromSource(src, srcId, { hotel: hotelRes.data || [], spa: spaRes.data || [], padel: padelRes.data || [], ristorante: ristoranteRes.data || [] })
    }
    setPageLoading(false)
  }

  const prefillFromSource = async (src: string, srcId: string, opts: any) => {
    if (src === 'hotel') {
      const r = opts.hotel.find((x: any) => x.id === srcId)
      if (r) {
        setClient(prev => ({ ...prev, first_name: r.guest?.first_name || '', last_name: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '' }))
        const nights = Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000)
        setItems([{ description: `Séjour ${r.room_type?.name} — ${r.check_in} au ${r.check_out} (${nights} nuit${nights > 1 ? 's' : ''})`, quantity: nights, unit_price: r.total_price / nights, tax_rate: 10, total: r.total_price }])
      }
    } else if (src === 'spa') {
      const a = opts.spa.find((x: any) => x.id === srcId)
      if (a) {
        const nameParts = a.guest_name.split(' ')
        setClient(prev => ({ ...prev, first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || '', email: a.guest_email || '', phone: a.guest_phone || '' }))
        setItems([{ description: `Soin Spa — ${a.service?.name}`, quantity: 1, unit_price: a.price || 0, tax_rate: 20, total: a.price || 0 }])
      }
    } else if (src === 'padel') {
      const b = opts.padel.find((x: any) => x.id === srcId)
      if (b) {
        const nameParts = b.player_name.split(' ')
        setClient(prev => ({ ...prev, first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || '', email: b.player_email || '', phone: b.player_phone || '' }))
        setItems([{ description: `Padel — ${b.court?.name} — ${b.date} ${b.start_time?.slice(0,5)}-${b.end_time?.slice(0,5)}`, quantity: 1, unit_price: b.price || 0, tax_rate: 20, total: b.price || 0 }])
      }
    } else if (src === 'ristorante') {
      const o = opts.ristorante.find((x: any) => x.id === srcId)
      if (o) {
        setItems([{ description: `Restauration — Table ${o.table?.table_number} — ${o.order_number}`, quantity: 1, unit_price: o.total || 0, tax_rate: 10, total: o.total || 0 }])
      }
    }
  }

  const handleSourceChange = async (src: string, srcId: string) => {
    setInvoice(prev => ({ ...prev, source: src, source_id: srcId }))
    if (srcId) await prefillFromSource(src, srcId, sourceOptions)
  }

  const updateItem = (idx: number, field: keyof Item, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.total = updated.quantity * updated.unit_price
      return updated
    }))
  }

  const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, tax_rate: invoice.tax_rate, total: 0 }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const taxAmount = items.reduce((s, i) => s + (i.total * i.tax_rate / 100), 0)
  const total = subtotal + taxAmount

  const handleSubmit = async (status: 'draft' | 'sent') => {
    if (!client.first_name || !client.last_name) return
    setLoading(true)
    const tenantId = await getTenantId()

    // Genera numero fattura
    const { data: numData } = await supabase.rpc('next_invoice_number')
    const invoiceNumber = numData || `${new Date().getFullYear()}-${Date.now()}`

    const { data: inv, error } = await supabase.from('invoices').insert([{
      invoice_number: invoiceNumber,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || null,
      client_first_name: client.first_name,
      client_last_name: client.last_name,
      client_email: client.email || null,
      client_phone: client.phone || null,
      client_address: client.address || null,
      client_city: client.city || null,
      client_postal_code: client.postal_code || null,
      client_country: client.country,
      client_siret: client.siret || null,
      client_vat_number: client.vat_number || null,
      source: invoice.source,
      source_id: invoice.source_id || null,
      status,
      payment_method: invoice.payment_method || null,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      subtotal,
      tax_rate: invoice.tax_rate,
      tax_amount: taxAmount,
      total,
      seller_name: seller.name,
      seller_address: seller.address,
      seller_siret: seller.siret,
      seller_vat: seller.vat,
      seller_ape: seller.ape,
      notes: invoice.notes || null,
      tenant_id: tenantId,
    }]).select().single()

    if (error || !inv) { setLoading(false); alert('Errore: ' + error?.message); return }

    // Inserisci righe
    await supabase.from('invoice_items').insert(items.map((item, i) => ({
      invoice_id: inv.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      total: item.total,
      sort_order: i,
      tenant_id: tenantId,
    })))

    router.push(`/dashboard/fatture/${inv.id}/stampa`)
  }

  const inputStyle = { width: '100%', padding: '9px 12px', background: '#0a0a0f', border: '1px solid #2a2a3a', borderRadius: '7px', color: '#f1f1f1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }

  if (pageLoading) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/fatture" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Fatture</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>🧾 Nuova Fattura</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => handleSubmit('draft')} disabled={loading || !client.first_name || !client.last_name} style={{ padding: '8px 16px', background: '#1f2030', color: '#9ca3af', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
            💾 Salva bozza
          </button>
          <button onClick={() => handleSubmit('sent')} disabled={loading || !client.first_name || !client.last_name} style={{ padding: '8px 20px', background: (!client.first_name || !client.last_name) ? '#1f2030' : '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
            {loading ? 'Salvataggio...' : '✓ Crea & Stampa'}
          </button>
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* Col sinistra */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Collegamento a servizio */}
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '14px' }}>🔗 COLLEGA A UN SERVIZIO (opzionale)</div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Origine</label>
              <select style={inputStyle} value={invoice.source} onChange={e => setInvoice(prev => ({ ...prev, source: e.target.value, source_id: '' }))}>
                <option value="altro">— Manuale —</option>
                <option value="hotel">🏨 Hotel</option>
                <option value="ristorante">🍽️ Ristorante</option>
                <option value="spa">💆 Spa</option>
                <option value="padel">🎾 Padel</option>
              </select>
            </div>
            {invoice.source !== 'altro' && (
              <div>
                <label style={labelStyle}>Seleziona record</label>
                <select style={inputStyle} value={invoice.source_id} onChange={e => handleSourceChange(invoice.source, e.target.value)}>
                  <option value="">— Seleziona —</option>
                  {invoice.source === 'hotel' && sourceOptions.hotel.map(r => <option key={r.id} value={r.id}>{r.reservation_number} · {r.guest?.first_name} {r.guest?.last_name} · €{r.total_price}</option>)}
                  {invoice.source === 'spa' && sourceOptions.spa.map(a => <option key={a.id} value={a.id}>{a.appointment_number} · {a.guest_name} · {a.service?.name}</option>)}
                  {invoice.source === 'padel' && sourceOptions.padel.map(b => <option key={b.id} value={b.id}>{b.booking_number} · {b.player_name} · {b.court?.name}</option>)}
                  {invoice.source === 'ristorante' && sourceOptions.ristorante.map(o => <option key={o.id} value={o.id}>{o.order_number} · Tavolo {o.table?.table_number} · €{o.total}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Dati cliente */}
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '14px' }}>👤 CLIENT / DESTINATAIRE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>Prénom *</label><input style={inputStyle} value={client.first_name} onChange={e => setClient(p => ({ ...p, first_name: e.target.value }))} placeholder="Jean" /></div>
              <div><label style={labelStyle}>Nom *</label><input style={inputStyle} value={client.last_name} onChange={e => setClient(p => ({ ...p, last_name: e.target.value }))} placeholder="Dupont" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={client.email} onChange={e => setClient(p => ({ ...p, email: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Téléphone</label><input style={inputStyle} value={client.phone} onChange={e => setClient(p => ({ ...p, phone: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Adresse</label><input style={inputStyle} value={client.address} onChange={e => setClient(p => ({ ...p, address: e.target.value }))} /></div>
              <div><label style={labelStyle}>Code postal</label><input style={inputStyle} value={client.postal_code} onChange={e => setClient(p => ({ ...p, postal_code: e.target.value }))} /></div>
              <div><label style={labelStyle}>Ville</label><input style={inputStyle} value={client.city} onChange={e => setClient(p => ({ ...p, city: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Pays</label><input style={inputStyle} value={client.country} onChange={e => setClient(p => ({ ...p, country: e.target.value }))} /></div>
              <div><label style={labelStyle}>SIRET (si entreprise)</label><input style={inputStyle} value={client.siret} onChange={e => setClient(p => ({ ...p, siret: e.target.value }))} /></div>
              <div><label style={labelStyle}>N° TVA intracommunautaire</label><input style={inputStyle} value={client.vat_number} onChange={e => setClient(p => ({ ...p, vat_number: e.target.value }))} /></div>
            </div>
          </div>

          {/* Dati venditore */}
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '14px' }}>🏢 VENDEUR / ÉMETTEUR</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><label style={labelStyle}>Raison sociale</label><input style={inputStyle} value={seller.name} onChange={e => setSeller(p => ({ ...p, name: e.target.value }))} /></div>
              <div><label style={labelStyle}>Adresse complète</label><input style={inputStyle} value={seller.address} onChange={e => setSeller(p => ({ ...p, address: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={labelStyle}>SIRET</label><input style={inputStyle} value={seller.siret} onChange={e => setSeller(p => ({ ...p, siret: e.target.value }))} /></div>
                <div><label style={labelStyle}>N° TVA</label><input style={inputStyle} value={seller.vat} onChange={e => setSeller(p => ({ ...p, vat: e.target.value }))} /></div>
                <div><label style={labelStyle}>Code APE/NAF</label><input style={inputStyle} value={seller.ape} onChange={e => setSeller(p => ({ ...p, ape: e.target.value }))} /></div>
              </div>
            </div>
          </div>
        </div>

        {/* Col destra */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Dati fattura */}
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '14px' }}>📄 INFORMATIONS FACTURE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>Date de facture</label><input style={inputStyle} type="date" value={invoice.invoice_date} onChange={e => setInvoice(p => ({ ...p, invoice_date: e.target.value }))} /></div>
              <div><label style={labelStyle}>Date d'échéance</label><input style={inputStyle} type="date" value={invoice.due_date} onChange={e => setInvoice(p => ({ ...p, due_date: e.target.value }))} /></div>
              <div><label style={labelStyle}>Mode de paiement</label>
                <select style={inputStyle} value={invoice.payment_method} onChange={e => setInvoice(p => ({ ...p, payment_method: e.target.value }))}>
                  <option value="card">Carte bancaire</option>
                  <option value="cash">Espèces</option>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="check">Chèque</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div><label style={labelStyle}>TVA par défaut</label>
                <select style={inputStyle} value={invoice.tax_rate} onChange={e => setInvoice(p => ({ ...p, tax_rate: parseFloat(e.target.value) }))}>
                  {TVA_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Righe */}
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af' }}>📋 PRESTATIONS</div>
              <button onClick={addItem} style={{ padding: '4px 10px', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>+ Ligne</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ background: '#0a0a0f', borderRadius: '8px', padding: '12px', border: '1px solid #1f2030' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <input style={inputStyle} value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description de la prestation..." />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                    <div><label style={labelStyle}>Qté</label><input style={inputStyle} type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                    <div><label style={labelStyle}>Prix unitaire HT</label><input style={inputStyle} type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} /></div>
                    <div><label style={labelStyle}>TVA %</label>
                      <select style={inputStyle} value={item.tax_rate} onChange={e => updateItem(idx, 'tax_rate', parseFloat(e.target.value))}>
                        {TVA_RATES.map(r => <option key={r.value} value={r.value}>{r.value}%</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444', textAlign: 'right', marginBottom: '4px' }}>€{item.total.toFixed(2)}</div>
                      {items.length > 1 && <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: '16px' }}>✕</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totali */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #1f2030', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                <span>Sous-total HT</span><span>€{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9ca3af', marginBottom: '10px' }}>
                <span>TVA</span><span>€{taxAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '22px', fontWeight: '700', color: '#f1f1f1' }}>
                <span>TOTAL TTC</span><span>€{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Note */}
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '20px' }}>
            <label style={labelStyle}>Notes / Mentions légales supplémentaires</label>
            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }} value={invoice.notes} onChange={e => setInvoice(p => ({ ...p, notes: e.target.value }))} placeholder="Pénalités de retard, conditions de paiement..." />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NuovaFatturaPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>}>
      <NuovaFatturaForm />
    </Suspense>
  )
}
