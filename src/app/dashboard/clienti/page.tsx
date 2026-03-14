'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'
import Link from 'next/link'

export default function ClientiPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [hotelHistory, setHotelHistory] = useState<any[]>([])
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', nationality: '', document_type: 'passport', document_number: '', notes: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadClients()
    })
  }, [])

  const loadClients = async () => {
    // Carica clienti dall'anagrafica unificata (guests hotel + spa + padel)
    const [guestsRes, spaRes, padelRes] = await Promise.all([
      supabase.from('guests').select('*').order('created_at', { ascending: false }),
      supabase.from('spa_appointments').select('guest_name, guest_email, guest_phone, created_at').order('created_at', { ascending: false }),
      supabase.from('padel_bookings').select('player_name, player_email, player_phone, created_at').order('created_at', { ascending: false }),
    ])
    // Costruisci lista unificata
    const hotelGuests = (guestsRes.data || []).map(g => ({
      id: g.id, source: 'hotel',
      name: `${g.first_name} ${g.last_name}`,
      email: g.email, phone: g.phone,
      nationality: g.nationality,
      created_at: g.created_at,
    }))
    const spaGuests = (spaRes.data || []).map((a, i) => ({
      id: `spa-${i}`, source: 'spa',
      name: a.guest_name, email: a.guest_email, phone: a.guest_phone,
      created_at: a.created_at,
    }))
    const padelGuests = (padelRes.data || []).map((b, i) => ({
      id: `padel-${i}`, source: 'padel',
      name: b.player_name, email: b.player_email, phone: b.player_phone,
      created_at: b.created_at,
    }))
    // Dedup per email
    const all: any[] = []
    const seen = new Set()
    for (const c of [...hotelGuests, ...spaGuests, ...padelGuests]) {
      const key = c.email || c.name
      if (!seen.has(key)) { seen.add(key); all.push(c) }
    }
    setClients(all)
    setLoading(false)
  }

  const loadClientHistory = async (guest: any) => {
    setSelected(guest)
    if (guest.source === 'hotel') {
      const { data } = await supabase.from('reservations')
        .select('*, room_type:room_types(name)')
        .eq('guest_id', guest.id)
        .order('check_in', { ascending: false })
      setHotelHistory(data || [])
    } else {
      setHotelHistory([])
    }
  }

  const save = async () => {
    const tenantId = await getTenantId()
    const { data } = await supabase.from('guests').insert([{ ...form, tenant_id: tenantId }]).select().single()
    if (data) {
      setClients(prev => [{ id: data.id, source: 'hotel', name: `${data.first_name} ${data.last_name}`, email: data.email, phone: data.phone, created_at: data.created_at }, ...prev])
      setShowForm(false)
      setForm({ first_name: '', last_name: '', email: '', phone: '', nationality: '', document_type: 'passport', document_number: '', notes: '' })
    }
  }

  const SOURCE_COLOR: Record<string, string> = { hotel: '#3b82f6', spa: '#8b5cf6', padel: '#f59e0b', ristorante: '#10b981' }
  const STATUS_COLOR: Record<string, string> = { confirmed: '#3b82f6', checked_in: '#10b981', checked_out: '#6b7280', cancelled: '#ef4444' }
  const STATUS_LABEL: Record<string, string> = { confirmed: 'Confermata', checked_in: 'Check-in', checked_out: 'Check-out', cancelled: 'Cancellata' }

  const filtered = clients.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
  const inputStyle = { width: '100%', padding: '10px 14px', background: '#0a0a0f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <span style={{ fontSize: '20px' }}>👥</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Clienti</h1>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>{clients.length} totali</span>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>+ Nuovo cliente</button>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 65px)' }}>
        {/* Lista clienti */}
        <div style={{ flex: 1, padding: '24px 32px', borderRight: selected ? '1px solid #1f2030' : 'none' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cerca per nome, email, telefono..." style={{ ...inputStyle, marginBottom: '20px', width: '100%', maxWidth: '400px' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.length === 0 ? (
              <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                Nessun cliente trovato.
              </div>
            ) : filtered.map(c => (
              <div key={c.id} onClick={() => loadClientHistory(c)} style={{
                background: selected?.id === c.id ? '#1a2030' : '#111118',
                border: `1px solid ${selected?.id === c.id ? '#06b6d4' : '#1f2030'}`,
                borderRadius: '12px', padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#f1f1f1' }}>{c.name}</span>
                    <span style={{ background: SOURCE_COLOR[c.source] + '20', color: SOURCE_COLOR[c.source], padding: '2px 6px', borderRadius: '6px', fontSize: '11px' }}>{c.source}</span>
                    {c.nationality && <span style={{ fontSize: '12px', color: '#6b7280' }}>{c.nationality}</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    {c.email && `✉️ ${c.email}`}{c.phone && ` · 📞 ${c.phone}`}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#374151' }}>
                  {new Date(c.created_at).toLocaleDateString('it-IT')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dettaglio cliente */}
        {selected && (
          <div style={{ width: '360px', padding: '24px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#f1f1f1' }}>{selected.name}</div>
                <span style={{ background: SOURCE_COLOR[selected.source] + '20', color: SOURCE_COLOR[selected.source], padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>{selected.source}</span>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              {selected.email && <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>✉️ {selected.email}</div>}
              {selected.phone && <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>📞 {selected.phone}</div>}
              {selected.nationality && <div style={{ fontSize: '13px', color: '#9ca3af' }}>🌍 {selected.nationality}</div>}
            </div>

            {hotelHistory.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '12px' }}>SOGGIORNI HOTEL ({hotelHistory.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {hotelHistory.map(r => (
                    <div key={r.id} style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#f1f1f1' }}>{r.room_type?.name}</span>
                        <span style={{ background: (STATUS_COLOR[r.status] || '#6b7280') + '20', color: STATUS_COLOR[r.status] || '#6b7280', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' }}>{STATUS_LABEL[r.status] || r.status}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{r.check_in} → {r.check_out}</div>
                      {r.total_price && <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '500', marginTop: '4px' }}>€{Number(r.total_price).toFixed(2)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hotelHistory.length === 0 && selected.source !== 'hotel' && (
              <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                Nessuno storico soggiorni per questo cliente.
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '32px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', marginTop: 0, marginBottom: '24px' }}>Nuovo Cliente</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Nome *</label><input style={inputStyle} value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Cognome *</label><input style={inputStyle} value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Telefono</label><input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Nazionalità</label><input style={inputStyle} value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Documento</label>
                <select style={inputStyle} value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })}>
                  <option value="passport">Passaporto</option>
                  <option value="id_card">Carta d'identità</option>
                  <option value="driving_license">Patente</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Numero documento</label><input style={inputStyle} value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Note</label><input style={inputStyle} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: '#1f2030', color: '#9ca3af', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={save} disabled={!form.first_name || !form.last_name} style={{ flex: 1, padding: '10px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
