'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'
import Link from 'next/link'

export default function PrenotazioniRistorantePage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<any[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [form, setForm] = useState({ guest_name: '', guest_phone: '', guest_email: '', date: new Date().toISOString().split('T')[0], time: '20:00', guests_count: 2, table_id: '', notes: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const [resRes, tablesRes] = await Promise.all([
      supabase.from('table_reservations').select('*, table:restaurant_tables(table_number, capacity)').order('date').order('time'),
      supabase.from('restaurant_tables').select('*').order('table_number'),
    ])
    setReservations(resRes.data || [])
    setTables(tablesRes.data || [])
    setLoading(false)
  }

  const saveReservation = async () => {
    const tenantId = await getTenantId()
    const { data } = await supabase.from('table_reservations').insert([{ ...form, table_id: form.table_id || null, tenant_id: tenantId }]).select('*, table:restaurant_tables(table_number, capacity)').single()
    if (data) {
      setReservations(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)))
      if (form.table_id) await supabase.from('restaurant_tables').update({ status: 'reserved' }).eq('id', form.table_id)
      setShowForm(false)
      setForm({ guest_name: '', guest_phone: '', guest_email: '', date: new Date().toISOString().split('T')[0], time: '20:00', guests_count: 2, table_id: '', notes: '' })
    }
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('table_reservations').update({ status }).eq('id', id)
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const SC: Record<string, { label: string; color: string }> = {
    confirmed: { label: 'Confermata', color: '#3b82f6' },
    seated:    { label: 'Al tavolo',  color: '#10b981' },
    completed: { label: 'Completata', color: '#6b7280' },
    cancelled: { label: 'Cancellata', color: '#ef4444' },
    no_show:   { label: 'No show',    color: '#7c3aed' },
  }

  const filtered = reservations.filter(r => !dateFilter || r.date === dateFilter)
  const inputStyle = { width: '100%', padding: '10px 14px', background: '#0a0a0f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280' }}>Caricamento...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/ristorante" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Ristorante</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>📅 Prenotazioni Ristorante</h1>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>+ Nuova</button>
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
              Nessuna prenotazione per questa data.{' '}
              <button onClick={() => setShowForm(true)} style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>Crea la prima →</button>
            </div>
          ) : filtered.map(r => {
            const sc = SC[r.status]
            return (
              <div key={r.id} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '18px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '17px', fontWeight: '600', color: '#f1f1f1' }}>{r.guest_name}</span>
                      <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{sc.label}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {r.guest_phone && `📞 ${r.guest_phone}`}
                      {r.guest_email && ` · ✉️ ${r.guest_email}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>{r.time?.slice(0,5)}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>{r.date}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1f2030', flexWrap: 'wrap' }}>
                  <div><span style={{ fontSize: '11px', color: '#6b7280' }}>TAVOLO </span><span style={{ fontSize: '14px', color: '#f1f1f1' }}>{r.table ? `#${r.table.table_number}` : 'Da assegnare'}</span></div>
                  <div><span style={{ fontSize: '11px', color: '#6b7280' }}>OSPITI </span><span style={{ fontSize: '14px', color: '#f1f1f1' }}>{r.guests_count} persone</span></div>
                  {r.notes && <div><span style={{ fontSize: '11px', color: '#6b7280' }}>NOTE </span><span style={{ fontSize: '14px', color: '#9ca3af' }}>{r.notes}</span></div>}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {r.status === 'confirmed' && <button onClick={() => updateStatus(r.id, 'seated')} style={{ padding: '5px 12px', background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✓ Al tavolo</button>}
                  {r.status === 'seated' && <button onClick={() => updateStatus(r.id, 'completed')} style={{ padding: '5px 12px', background: '#6b728020', color: '#9ca3af', border: '1px solid #6b728040', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✓ Completata</button>}
                  {['confirmed', 'seated'].includes(r.status) && <button onClick={() => updateStatus(r.id, 'cancelled')} style={{ padding: '5px 12px', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕ Cancella</button>}
                  {r.status === 'confirmed' && <button onClick={() => updateStatus(r.id, 'no_show')} style={{ padding: '5px 12px', background: '#7c3aed20', color: '#7c3aed', border: '1px solid #7c3aed40', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>No show</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '32px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', marginTop: 0, marginBottom: '24px' }}>Nuova Prenotazione</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Nome *</label>
                <input style={inputStyle} value={form.guest_name} onChange={e => setForm({ ...form, guest_name: e.target.value })} placeholder="Nome cliente" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Telefono</label>
                <input style={inputStyle} value={form.guest_phone} onChange={e => setForm({ ...form, guest_phone: e.target.value })} placeholder="+39 333..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Email</label>
                <input style={inputStyle} value={form.guest_email} onChange={e => setForm({ ...form, guest_email: e.target.value })} placeholder="email@..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Data *</label>
                <input style={inputStyle} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Orario *</label>
                <input style={inputStyle} type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Numero ospiti</label>
                <input style={inputStyle} type="number" min="1" max="20" value={form.guests_count} onChange={e => setForm({ ...form, guests_count: parseInt(e.target.value) })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Tavolo</label>
                <select style={inputStyle} value={form.table_id} onChange={e => setForm({ ...form, table_id: e.target.value })}>
                  <option value="">Da assegnare</option>
                  {tables.filter(t => t.status === 'free').map(t => <option key={t.id} value={t.id}>Tavolo {t.table_number} ({t.capacity} posti)</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Note</label>
                <input style={inputStyle} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Intolleranze, occasione speciale..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: '#1f2030', color: '#9ca3af', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={saveReservation} disabled={!form.guest_name || !form.date || !form.time} style={{
                flex: 1, padding: '10px', background: (form.guest_name && form.date && form.time) ? '#3b82f6' : '#1f2030',
                color: 'white', border: 'none', borderRadius: '8px', cursor: (form.guest_name && form.date && form.time) ? 'pointer' : 'not-allowed', fontWeight: '500'
              }}>Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
