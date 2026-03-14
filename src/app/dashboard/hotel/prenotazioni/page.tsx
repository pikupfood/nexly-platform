'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { autoGenerateInvoice } from '@/lib/autoInvoice'
import PaymentModal from '@/components/PaymentModal'

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#3b82f6', pending: '#f59e0b', checked_in: '#10b981',
  checked_out: '#6b7280', cancelled: '#ef4444', no_show: '#7c3aed',
}
const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confermata', pending: 'In attesa', checked_in: 'Check-in effettuato',
  checked_out: 'Check-out effettuato', cancelled: 'Cancellata', no_show: 'No show',
}

export default function PrenotazioniPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [paymentModal, setPaymentModal] = useState<{ reservationId: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadReservations()
    })
  }, [])

  const loadReservations = async () => {
    const { data } = await supabase
      .from('reservations')
      .select('*, guest:guests(first_name,last_name,email,phone), room:rooms(room_number), room_type:room_types(name)')
      .order('check_in', { ascending: false })
    setReservations(data || [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    // Per check-out mostra prima il modal di pagamento
    if (status === 'checked_out') {
      setPaymentModal({ reservationId: id })
      return
    }
    setUpdating(id)
    await supabase.from('reservations').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    setUpdating(null)
  }

  const handlePaymentConfirm = async (payment: { method: string; note: string; isComplimentary: boolean }) => {
    if (!paymentModal) return
    const id = paymentModal.reservationId
    const r = reservations.find(x => x.id === id)
    setPaymentModal(null)
    setUpdating(id)
    await supabase.from('reservations').update({
      status: 'checked_out',
      updated_at: new Date().toISOString(),
      payment_method: payment.method,
      payment_note: payment.note || null,
      is_complimentary: payment.isComplimentary,
    }).eq('id', id)
    setReservations(prev => prev.map(x => x.id === id ? { ...x, status: 'checked_out' } : x))
    setUpdating(null)

    if (r) {
      const n = nights(r.check_in, r.check_out)
      const pricePerNight = n > 0 ? Number(r.total_price || 0) / n : Number(r.total_price || 0)
      await autoGenerateInvoice({
        source: 'hotel', sourceId: id,
        clientFirstName: r.guest?.first_name || 'Ospite',
        clientLastName: r.guest?.last_name || '',
        clientEmail: r.guest?.email,
        clientPhone: r.guest?.phone,
        items: [{ description: `Séjour ${r.room_type?.name} — ${r.check_in} → ${r.check_out} (${n} nuit${n > 1 ? 's' : ''})`, quantity: n, unit_price: pricePerNight, tax_rate: 10 }],
        taxRate: 10,
        paymentMethod: payment.method,
        paymentNote: payment.note,
        isComplimentary: payment.isComplimentary,
        router,
      })
    }
  }

  const nights = (checkin: string, checkout: string) => {
    const d1 = new Date(checkin), d2 = new Date(checkout)
    return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
  }

  const filtered = reservations.filter(r => {
    const matchStatus = filter === 'all' || r.status === filter
    const guestName = r.guest ? `${r.guest.first_name} ${r.guest.last_name}`.toLowerCase() : ''
    const matchSearch = search === '' || guestName.includes(search.toLowerCase()) ||
      r.reservation_number?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280' }}>Caricamento...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/hotel" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Hotel</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>📋 Prenotazioni</h1>
        </div>
        <Link href="/dashboard/hotel/nuova-prenotazione" style={{
          padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: '8px',
          textDecoration: 'none', fontSize: '14px', fontWeight: '500'
        }}>+ Nuova</Link>
      </div>

      <div style={{ padding: '32px' }}>
        {/* Filtri + ricerca */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per ospite o numero..."
            style={{
              padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a',
              borderRadius: '8px', color: '#f1f1f1', fontSize: '14px', outline: 'none', width: '260px'
            }}
          />
          {['all', 'confirmed', 'checked_in', 'checked_out', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px',
              background: filter === s ? '#3b82f6' : '#111118',
              color: filter === s ? 'white' : '#9ca3af',
              outline: '1px solid ' + (filter === s ? '#3b82f6' : '#1f2030'),
            }}>
              {s === 'all' ? 'Tutte' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Lista prenotazioni */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.length === 0 ? (
            <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
              Nessuna prenotazione trovata.{' '}
              <Link href="/dashboard/hotel/nuova-prenotazione" style={{ color: '#3b82f6' }}>Crea la prima →</Link>
            </div>
          ) : filtered.map(r => (
            <div key={r.id} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6b7280' }}>{r.reservation_number}</span>
                    <span style={{
                      background: `${STATUS_COLOR[r.status]}20`, color: STATUS_COLOR[r.status],
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'
                    }}>{STATUS_LABEL[r.status]}</span>
                    {r.channel && r.channel !== 'direct' && (
                      <span style={{ background: '#1f2030', color: '#9ca3af', padding: '3px 8px', borderRadius: '20px', fontSize: '11px' }}>
                        {r.channel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', marginBottom: '4px' }}>
                    {r.guest ? `${r.guest.first_name} ${r.guest.last_name}` : 'Ospite non assegnato'}
                  </div>
                  {r.guest?.email && <div style={{ fontSize: '13px', color: '#6b7280' }}>{r.guest.email} · {r.guest.phone}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#f1f1f1' }}>
                    {r.total_price ? `€${Number(r.total_price).toFixed(2)}` : '—'}
                  </div>
                  {r.total_price && <div style={{ fontSize: '12px', color: '#6b7280' }}>{nights(r.check_in, r.check_out)} notti</div>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #1f2030', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>CHECK-IN</div>
                  <div style={{ fontSize: '14px', color: '#f1f1f1', fontWeight: '500' }}>{r.check_in}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>CHECK-OUT</div>
                  <div style={{ fontSize: '14px', color: '#f1f1f1', fontWeight: '500' }}>{r.check_out}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>CAMERA</div>
                  <div style={{ fontSize: '14px', color: '#f1f1f1' }}>
                    {r.room ? `#${r.room.room_number}` : '—'} · {r.room_type?.name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>OSPITI</div>
                  <div style={{ fontSize: '14px', color: '#f1f1f1' }}>{r.adults} adulti{r.children > 0 ? ` · ${r.children} bambini` : ''}</div>
                </div>
              </div>

              {/* Azioni rapide */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                {r.status === 'confirmed' && (
                  <button onClick={() => updateStatus(r.id, 'checked_in')} disabled={updating === r.id} style={{
                    padding: '6px 14px', background: '#10b98120', color: '#10b981', border: '1px solid #10b98140',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'
                  }}>✓ Check-in</button>
                )}
                {r.status === 'checked_in' && (
                  <button onClick={() => updateStatus(r.id, 'checked_out')} disabled={updating === r.id} style={{
                    padding: '6px 14px', background: '#6b728020', color: '#9ca3af', border: '1px solid #6b728040',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'
                  }}>↑ Check-out</button>
                )}
                {(r.status === 'confirmed' || r.status === 'pending') && (
                  <button onClick={() => updateStatus(r.id, 'cancelled')} disabled={updating === r.id} style={{
                    padding: '6px 14px', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'
                  }}>✕ Cancella</button>
                )}
                <Link href={`/dashboard/fatture/nuova?source=hotel&id=${r.id}`} style={{ padding: '6px 14px', background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', borderRadius: '6px', fontSize: '12px', fontWeight: '500', textDecoration: 'none' }}>🧾 Fattura</Link>
                {r.special_requests && (
                  <span style={{ padding: '6px 14px', background: '#f59e0b20', color: '#f59e0b', borderRadius: '6px', fontSize: '12px' }}>
                    💬 {r.special_requests}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal pagamento check-out */}
      {paymentModal && (() => {
        const r = reservations.find(x => x.id === paymentModal.reservationId)
        return (
          <PaymentModal
            title={`Check-out ${r?.guest?.first_name || ''} ${r?.guest?.last_name || ''}`}
            amount={Number(r?.total_price || 0)}
            onConfirm={handlePaymentConfirm}
            onCancel={() => setPaymentModal(null)}
          />
        )
      })()}
    </div>
  )
}
