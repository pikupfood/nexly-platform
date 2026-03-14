'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'
import Link from 'next/link'
import { autoGenerateInvoice } from '@/lib/autoInvoice'
import PaymentModal from '@/components/PaymentModal'

const SC: Record<string, { label: string; color: string }> = {
  confirmed:   { label: 'Confermata', color: '#3b82f6' },
  in_progress: { label: 'In corso',   color: '#f59e0b' },
  completed:   { label: 'Completata', color: '#10b981' },
  cancelled:   { label: 'Cancellata', color: '#ef4444' },
}

export default function PadelPrenotazioniPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [courts, setCourts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [form, setForm] = useState({ player_name: '', player_phone: '', player_email: '', court_id: '', date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '10:30', players_count: 4, notes: '' })
  const [paymentModal, setPaymentModal] = useState<{ bookingId: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const [bookRes, courtRes] = await Promise.all([
      supabase.from('padel_bookings').select('*, court:padel_courts(name, price_per_hour)').order('date').order('start_time'),
      supabase.from('padel_courts').select('*').eq('is_active', true).order('name'),
    ])
    setBookings(bookRes.data || [])
    setCourts(courtRes.data || [])
    setLoading(false)
  }

  const save = async () => {
    const tenantId = await getTenantId()
    const court = courts.find(c => c.id === form.court_id)
    const hours = court ? (new Date(`2000-01-01T${form.end_time}`).getTime() - new Date(`2000-01-01T${form.start_time}`).getTime()) / 3600000 : 0
    const price = court ? hours * court.price_per_hour : null
    const { data } = await supabase.from('padel_bookings').insert([{ ...form, price, tenant_id: tenantId }]).select('*, court:padel_courts(name, price_per_hour)').single()
    if (data) { setBookings(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date))); setShowForm(false) }
  }

  const updateStatus = async (id: string, status: string) => {
    if (status === 'completed') {
      setPaymentModal({ bookingId: id })
      return
    }
    await supabase.from('padel_bookings').update({ status }).eq('id', id)
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
  }

  const handlePaymentConfirm = async (payment: { method: string; note: string; isComplimentary: boolean }) => {
    if (!paymentModal) return
    const id = paymentModal.bookingId
    const b = bookings.find(x => x.id === id)
    setPaymentModal(null)

    await supabase.from('padel_bookings').update({
      status: 'completed',
      payment_method: payment.method,
      payment_note: payment.note || null,
      is_complimentary: payment.isComplimentary,
    }).eq('id', id)
    setBookings(prev => prev.map(x => x.id === id ? { ...x, status: 'completed' } : x))

    if (b) {
      const hrs = (new Date(`2000-01-01T${b.end_time}`).getTime() - new Date(`2000-01-01T${b.start_time}`).getTime()) / 3600000
      const nameParts = (b.player_name || 'Giocatore').split(' ')
      await autoGenerateInvoice({
        source: 'padel', sourceId: id,
        clientFirstName: nameParts[0] || 'Giocatore',
        clientLastName: nameParts.slice(1).join(' ') || '',
        clientEmail: b.player_email, clientPhone: b.player_phone,
        items: [{ description: `Padel — ${b.court?.name} — ${b.date} ${b.start_time?.slice(0,5)}-${b.end_time?.slice(0,5)} (${hrs}h)`, quantity: 1, unit_price: Number(b.price || 0), tax_rate: 20 }],
        taxRate: 20, paymentMethod: payment.method, paymentNote: payment.note,
        isComplimentary: payment.isComplimentary,
        router,
      })
    }
  }

  const filtered = bookings.filter(b => !dateFilter || b.date === dateFilter)
  const inputStyle = { width: '100%', padding: '10px 14px', background: '#0a0a0f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/padel" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Padel</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>📋 Prenotazioni Padel</h1>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>+ Nuova</button>
      </div>

      <div style={{ padding: '32px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '14px' }} />
          <button onClick={() => setDateFilter('')} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '13px' }}>Tutte le date</button>
          <span style={{ color: '#6b7280', fontSize: '14px' }}>{filtered.length} prenotazioni</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.length === 0 ? (
            <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
              Nessuna prenotazione. <button onClick={() => setShowForm(true)} style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}>Crea la prima →</button>
            </div>
          ) : filtered.map(b => {
            const sc = SC[b.status]
            const hours = (new Date(`2000-01-01T${b.end_time}`).getTime() - new Date(`2000-01-01T${b.start_time}`).getTime()) / 3600000
            return (
              <div key={b.id} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '18px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '17px', fontWeight: '600', color: '#f1f1f1' }}>{b.player_name}</span>
                      <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{sc.label}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#f59e0b', fontWeight: '500' }}>{b.court?.name}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>{b.players_count} giocatori · {hours}h</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>{b.start_time?.slice(0,5)} - {b.end_time?.slice(0,5)}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>{b.date}</div>
                    {b.price && <div style={{ fontSize: '14px', color: '#f1f1f1', fontWeight: '500' }}>€{Number(b.price).toFixed(2)}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {b.status === 'confirmed' && <button onClick={() => updateStatus(b.id, 'in_progress')} style={{ padding: '5px 12px', background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>▶ Inizia</button>}
                  {b.status === 'in_progress' && <button onClick={() => updateStatus(b.id, 'completed')} style={{ padding: '5px 12px', background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✓ Completa</button>}
                  {['confirmed', 'in_progress'].includes(b.status) && <button onClick={() => updateStatus(b.id, 'cancelled')} style={{ padding: '5px 12px', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕ Cancella</button>}
                  <Link href={`/dashboard/fatture/nuova?source=padel&id=${b.id}`} style={{ padding: '5px 12px', background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', borderRadius: '6px', fontSize: '12px', fontWeight: '500', textDecoration: 'none' }}>🧾 Fattura</Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '32px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', marginTop: 0, marginBottom: '24px' }}>Nuova Prenotazione Padel</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Nome giocatore *</label><input style={inputStyle} value={form.player_name} onChange={e => setForm({ ...form, player_name: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Telefono</label><input style={inputStyle} value={form.player_phone} onChange={e => setForm({ ...form, player_phone: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Email</label><input style={inputStyle} value={form.player_email} onChange={e => setForm({ ...form, player_email: e.target.value })} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Campo *</label>
                <select style={inputStyle} value={form.court_id} onChange={e => setForm({ ...form, court_id: e.target.value })}>
                  <option value="">— Seleziona campo —</option>
                  {courts.map(c => <option key={c.id} value={c.id}>{c.name} · €{c.price_per_hour}/h</option>)}
                </select>
              </div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Data *</label><input style={inputStyle} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Giocatori</label><input style={inputStyle} type="number" min="2" max="4" value={form.players_count} onChange={e => setForm({ ...form, players_count: parseInt(e.target.value) })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Inizio</label><input style={inputStyle} type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Fine</label><input style={inputStyle} type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: '#1f2030', color: '#9ca3af', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={save} disabled={!form.player_name || !form.court_id || !form.date} style={{ flex: 1, padding: '10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>Salva</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pagamento */}
      {paymentModal && (() => {
        const b = bookings.find(x => x.id === paymentModal.bookingId)
        return (
          <PaymentModal
            title={`Padel ${b?.court?.name || ''} — ${b?.player_name || ''}`}
            amount={Number(b?.price || 0)}
            onConfirm={handlePaymentConfirm}
            onCancel={() => setPaymentModal(null)}
          />
        )
      })()}
    </div>
  )
}
