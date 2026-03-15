'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'
import Link from 'next/link'
import { useStaffNav } from '@/lib/useStaffNav'

export default function NuovaPrenotazionePage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const [roomTypes, setRoomTypes] = useState<any[]>([])
  const [availableRooms, setAvailableRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1=ospite, 2=soggiorno, 3=conferma

  const [guest, setGuest] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    document_type: 'passport', document_number: '', nationality: '',
  })

  const [booking, setBooking] = useState({
    check_in: '', check_out: '', adults: 1, children: 0,
    room_type_id: '', room_id: '', channel: 'direct', special_requests: '',
  })

  const [totalPrice, setTotalPrice] = useState(0)
  const [selectedType, setSelectedType] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      supabase.from('room_types').select('*').eq('is_active', true).order('base_price').then(({ data }) => setRoomTypes(data || []))
    })
  }, [])

  useEffect(() => {
    if (booking.check_in && booking.check_out && booking.room_type_id) {
      const type = roomTypes.find(t => t.id === booking.room_type_id)
      setSelectedType(type)
      if (type) {
        const nights = Math.round((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24))
        setTotalPrice(nights * type.base_price)
        // Cerca camere disponibili
        supabase.from('rooms')
          .select('*')
          .eq('room_type_id', booking.room_type_id)
          .eq('status', 'available')
          .then(({ data }) => setAvailableRooms(data || []))
      }
    }
  }, [booking.check_in, booking.check_out, booking.room_type_id])

  const nights = booking.check_in && booking.check_out
    ? Math.round((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const handleSubmit = async () => {
    if (!guest.first_name || !guest.last_name || !booking.check_in || !booking.check_out || !booking.room_type_id) return
    setLoading(true)
    const tenantId = await getTenantId()

    // Crea ospite
    const { data: guestData, error: guestError } = await supabase
      .from('guests').insert([{ ...guest, tenant_id: tenantId }]).select().single()
    if (guestError) { setLoading(false); alert('Errore creazione ospite: ' + guestError.message); return }

    // Crea prenotazione
    const { data: resData, error: resError } = await supabase
      .from('reservations').insert([{
        guest_id: guestData.id,
        room_id: booking.room_id || null,
        room_type_id: booking.room_type_id,
        check_in: booking.check_in,
        check_out: booking.check_out,
        adults: booking.adults,
        children: booking.children,
        total_price: totalPrice,
        channel: booking.channel,
        special_requests: booking.special_requests || null,
        status: 'confirmed',
        tenant_id: tenantId,
      }]).select().single()

    if (resError) { setLoading(false); alert('Errore creazione prenotazione: ' + resError.message); return }

    // Se camera assegnata, aggiorna status
    if (booking.room_id) {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', booking.room_id)
    }

    router.push('/dashboard/hotel/prenotazioni')
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', background: 'white',
    border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  }
  const labelStyle = { display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }

  return (
    <div style={{ minHeight: '100vh', background: 'white', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/hotel/prenotazioni" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Prenotazioni</Link>
        <span style={{ color: '#2a2a3a' }}>|</span>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>➕ Nuova Prenotazione</h1>
      </div>

      <div style={{ padding: '20px 24px', maxWidth: '900px', margin: '0 auto' }}>
        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '40px' }}>
          {[{ n: 1, label: 'Dati Ospite' }, { n: 2, label: 'Soggiorno' }, { n: 3, label: 'Conferma' }].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '600', fontSize: '14px',
                  background: step >= s.n ? '#3b82f6' : '#111118',
                  color: step >= s.n ? 'white' : '#6b7280',
                  border: `2px solid ${step >= s.n ? '#3b82f6' : '#2a2a3a'}`,
                }}>{s.n}</div>
                <div style={{ fontSize: '12px', color: step >= s.n ? '#3b82f6' : '#6b7280', marginTop: '6px' }}>{s.label}</div>
              </div>
              {i < 2 && <div style={{ flex: 1, height: '2px', background: step > s.n ? '#3b82f6' : '#2a2a3a', marginBottom: '20px' }} />}
            </div>
          ))}
        </div>

        {/* Step 1: Ospite */}
        {step === 1 && (
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '20px 24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', marginBottom: '24px', marginTop: 0 }}>👤 Dati Ospite</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input style={inputStyle} value={guest.first_name} onChange={e => setGuest({ ...guest, first_name: e.target.value })} placeholder="Mario" />
              </div>
              <div>
                <label style={labelStyle}>Cognome *</label>
                <input style={inputStyle} value={guest.last_name} onChange={e => setGuest({ ...guest, last_name: e.target.value })} placeholder="Rossi" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" value={guest.email} onChange={e => setGuest({ ...guest, email: e.target.value })} placeholder="mario@email.com" />
              </div>
              <div>
                <label style={labelStyle}>Telefono</label>
                <input style={inputStyle} value={guest.phone} onChange={e => setGuest({ ...guest, phone: e.target.value })} placeholder="+39 333 1234567" />
              </div>
              <div>
                <label style={labelStyle}>Tipo documento</label>
                <select style={inputStyle} value={guest.document_type} onChange={e => setGuest({ ...guest, document_type: e.target.value })}>
                  <option value="passport">Passaporto</option>
                  <option value="id_card">Carta d'identità</option>
                  <option value="driving_license">Patente</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Numero documento</label>
                <input style={inputStyle} value={guest.document_number} onChange={e => setGuest({ ...guest, document_number: e.target.value })} placeholder="AB1234567" />
              </div>
              <div>
                <label style={labelStyle}>Nazionalità</label>
                <input style={inputStyle} value={guest.nationality} onChange={e => setGuest({ ...guest, nationality: e.target.value })} placeholder="Italiana" />
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(2)} disabled={!guest.first_name || !guest.last_name} style={{
                padding: '10px 24px', background: guest.first_name && guest.last_name ? '#3b82f6' : '#1f2030',
                color: 'white', border: 'none', borderRadius: '8px', cursor: guest.first_name && guest.last_name ? 'pointer' : 'not-allowed',
                fontSize: '14px', fontWeight: '500'
              }}>Avanti →</button>
            </div>
          </div>
        )}

        {/* Step 2: Soggiorno */}
        {step === 2 && (
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '20px 24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', marginBottom: '24px', marginTop: 0 }}>🛏️ Dettagli Soggiorno</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Check-in *</label>
                <input style={inputStyle} type="date" value={booking.check_in} onChange={e => setBooking({ ...booking, check_in: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Check-out *</label>
                <input style={inputStyle} type="date" value={booking.check_out} onChange={e => setBooking({ ...booking, check_out: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Adulti</label>
                <input style={inputStyle} type="number" min="1" value={booking.adults} onChange={e => setBooking({ ...booking, adults: parseInt(e.target.value) })} />
              </div>
              <div>
                <label style={labelStyle}>Bambini</label>
                <input style={inputStyle} type="number" min="0" value={booking.children} onChange={e => setBooking({ ...booking, children: parseInt(e.target.value) })} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Tipo camera *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                  {roomTypes.map(t => (
                    <div key={t.id} onClick={() => setBooking({ ...booking, room_type_id: t.id, room_id: '' })} style={{
                      padding: '12px', border: `1px solid ${booking.room_type_id === t.id ? '#3b82f6' : '#2a2a3a'}`,
                      borderRadius: '8px', cursor: 'pointer', background: booking.room_type_id === t.id ? '#3b82f620' : '#0a0a0f',
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#f1f1f1' }}>{t.name}</div>
                      <div style={{ fontSize: '13px', color: '#3b82f6', marginTop: '2px' }}>€{t.base_price}/notte</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>max {t.max_occupancy} ospiti</div>
                    </div>
                  ))}
                </div>
              </div>
              {availableRooms.length > 0 && (
                <div>
                  <label style={labelStyle}>Camera specifica (opzionale)</label>
                  <select style={inputStyle} value={booking.room_id} onChange={e => setBooking({ ...booking, room_id: e.target.value })}>
                    <option value="">Da assegnare</option>
                    {availableRooms.map(r => <option key={r.id} value={r.id}>Camera {r.room_number} - Piano {r.floor}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Canale</label>
                <select style={inputStyle} value={booking.channel} onChange={e => setBooking({ ...booking, channel: e.target.value })}>
                  <option value="direct">Diretto</option>
                  <option value="booking">Booking.com</option>
                  <option value="expedia">Expedia</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="phone">Telefono</option>
                  <option value="walkin">Walk-in</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Richieste speciali</label>
                <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }} value={booking.special_requests}
                  onChange={e => setBooking({ ...booking, special_requests: e.target.value })}
                  placeholder="Vista mare, letto singolo, piano alto..." />
              </div>
            </div>

            {/* Prezzo preview */}
            {nights > 0 && totalPrice > 0 && (
              <div style={{ background: '#0a1a2a', border: '1px solid #1e3a5f', borderRadius: '12px', padding: '16px', marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: '14px' }}>{nights} notti × €{selectedType?.base_price}/notte</div>
                  <div style={{ color: '#f1f1f1', fontSize: '24px', fontWeight: '700' }}>€{totalPrice.toFixed(2)}</div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={{
                padding: '10px 24px', background: '#111118', color: '#9ca3af',
                border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
              }}>← Indietro</button>
              <button onClick={() => setStep(3)} disabled={!booking.check_in || !booking.check_out || !booking.room_type_id || nights <= 0} style={{
                padding: '10px 24px', background: (booking.check_in && booking.check_out && booking.room_type_id && nights > 0) ? '#3b82f6' : '#1f2030',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: (booking.check_in && booking.check_out && booking.room_type_id && nights > 0) ? 'pointer' : 'not-allowed',
                fontSize: '14px', fontWeight: '500'
              }}>Avanti →</button>
            </div>
          </div>
        )}

        {/* Step 3: Conferma */}
        {step === 3 && (
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '20px 24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', marginBottom: '24px', marginTop: 0 }}>✅ Riepilogo Prenotazione</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', fontWeight: '500' }}>OSPITE</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1' }}>{guest.first_name} {guest.last_name}</div>
                {guest.email && <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>{guest.email}</div>}
                {guest.phone && <div style={{ fontSize: '13px', color: '#9ca3af' }}>{guest.phone}</div>}
              </div>
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', fontWeight: '500' }}>SOGGIORNO</div>
                <div style={{ fontSize: '14px', color: '#f1f1f1' }}>
                  {booking.check_in} → {booking.check_out}
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>{nights} notti · {booking.adults} adulti{booking.children > 0 ? ` · ${booking.children} bambini` : ''}</div>
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>{selectedType?.name}</div>
              </div>
            </div>

            <div style={{ background: '#0a1a2a', border: '1px solid #1e3a5f', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#9ca3af' }}>Totale prenotazione</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{nights} × €{selectedType?.base_price}</div>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#f1f1f1' }}>€{totalPrice.toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(2)} style={{
                padding: '10px 24px', background: '#111118', color: '#9ca3af',
                border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
              }}>← Indietro</button>
              <button onClick={handleSubmit} disabled={loading} style={{
                padding: '10px 28px', background: loading ? '#1e3a5f' : '#3b82f6',
                color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: '600'
              }}>{loading ? 'Salvataggio...' : '✓ Conferma Prenotazione'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
