'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'
import Link from 'next/link'
import { autoGenerateInvoice } from '@/lib/autoInvoice'
import PaymentModal from '@/components/PaymentModal'

const SC: Record<string, { label: string; color: string }> = {
  confirmed:   { label: 'Confermato',  color: '#3b82f6' },
  in_progress: { label: 'In corso',    color: '#f59e0b' },
  completed:   { label: 'Completato',  color: '#10b981' },
  cancelled:   { label: 'Cancellato',  color: '#ef4444' },
  no_show:     { label: 'No show',     color: '#7c3aed' },
}

const CAT_FILTER = [
  { key: 'all',      label: 'Tutti',     icon: '✨' },
  { key: 'massaggio', label: 'Massaggi', icon: '💆' },
  { key: 'piscina',  label: 'Piscina',   icon: '🏊' },
  { key: 'jacuzzi',  label: 'Jacuzzi',   icon: '🛁' },
  { key: 'viso',     label: 'Viso',      icon: '✨' },
  { key: 'corpo',    label: 'Corpo',     icon: '🧖' },
]

export default function SpaAppointmentsPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [dateFilter, setDateFilter] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [paymentModal, setPaymentModal] = useState<{ appointmentId: string } | null>(null)
  const [form, setForm] = useState({ guest_name: '', guest_phone: '', guest_email: '', service_id: '', staff_id: '', date: new Date().toISOString().split('T')[0], time: '10:00', notes: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const [appRes, svcRes, staffRes] = await Promise.all([
      supabase.from('spa_appointments').select('*, service:spa_services(name,price,duration_minutes,category), staff:spa_staff(name)').order('date').order('time'),
      supabase.from('spa_services').select('*').eq('is_active', true).order('category').order('sort_order'),
      supabase.from('spa_staff').select('*').eq('is_active', true),
    ])
    setAppointments(appRes.data || [])
    setServices(svcRes.data || [])
    setStaff(staffRes.data || [])
    setLoading(false)
  }

  const save = async () => {
    const tenantId = await getTenantId()
    const svc = services.find(s => s.id === form.service_id)
    const { data } = await supabase.from('spa_appointments').insert([{ ...form, price: svc?.price || null, staff_id: form.staff_id || null, tenant_id: tenantId }])
      .select('*, service:spa_services(name,price,duration_minutes,category), staff:spa_staff(name)').single()
    if (data) { setAppointments(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date))); setShowForm(false); setForm({ guest_name: '', guest_phone: '', guest_email: '', service_id: '', staff_id: '', date: new Date().toISOString().split('T')[0], time: '10:00', notes: '' }) }
  }

  const updateStatus = async (id: string, status: string) => {
    if (status === 'completed') {
      setPaymentModal({ appointmentId: id })
      return
    }
    await supabase.from('spa_appointments').update({ status }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  const handlePaymentConfirm = async (payment: { method: string; note: string; isComplimentary: boolean }) => {
    if (!paymentModal) return
    const id = paymentModal.appointmentId
    const a = appointments.find(x => x.id === id)
    setPaymentModal(null)

    await supabase.from('spa_appointments').update({
      status: 'completed',
      payment_method: payment.method,
      payment_note: payment.note || null,
      is_complimentary: payment.isComplimentary,
    }).eq('id', id)
    setAppointments(prev => prev.map(x => x.id === id ? { ...x, status: 'completed' } : x))

    if (a && (a.price || payment.isComplimentary)) {
      const catTax: Record<string, number> = { massaggio: 20, piscina: 20, jacuzzi: 20, viso: 20, corpo: 20, altro: 20 }
      const taxRate = catTax[a.service?.category] || 20
      const nameParts = (a.guest_name || 'Cliente').split(' ')
      await autoGenerateInvoice({
        source: 'spa', sourceId: id,
        clientFirstName: nameParts[0] || 'Cliente',
        clientLastName: nameParts.slice(1).join(' ') || '',
        clientEmail: a.guest_email, clientPhone: a.guest_phone,
        items: [{ description: a.service?.name || 'Servizio Spa', quantity: 1, unit_price: Number(a.price || 0), tax_rate: taxRate }],
        taxRate, paymentMethod: payment.method, paymentNote: payment.note,
        isComplimentary: payment.isComplimentary,
        router,
      })
    }
  }

  const filtered = appointments.filter(a => {
    const matchDate = !dateFilter || a.date === dateFilter
    const matchCat = catFilter === 'all' || a.service?.category === catFilter
    return matchDate && matchCat
  })

  // Raggruppa per sezione quando filtro è 'all'
  const grouped = catFilter === 'all'
    ? CAT_FILTER.filter(c => c.key !== 'all').reduce((acc, cat) => {
        const items = filtered.filter(a => a.service?.category === cat.key)
        if (items.length > 0) acc[cat.key] = { label: cat.label, icon: cat.icon, items }
        return acc
      }, {} as Record<string, any>)
    : null

  const inputStyle = { width: '100%', padding: '10px 14px', background: '#0a0a0f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  const AppointmentCard = ({ a }: { a: any }) => {
    const sc = SC[a.status]
    return (
      <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '18px 24px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '17px', fontWeight: '600', color: '#f1f1f1' }}>{a.guest_name}</span>
              <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{sc.label}</span>
            </div>
            <div style={{ fontSize: '14px', color: '#8b5cf6', fontWeight: '500' }}>{a.service?.name}</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>{a.service?.duration_minutes} min · {a.staff?.name || 'Staff da assegnare'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#f1f1f1' }}>{a.time?.slice(0,5)}</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>{a.date}</div>
            {a.price && <div style={{ fontSize: '14px', color: '#8b5cf6', fontWeight: '500' }}>€{a.price}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {a.status === 'confirmed' && <button onClick={() => updateStatus(a.id, 'in_progress')} style={{ padding: '5px 12px', background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>▶ Inizia</button>}
          {a.status === 'in_progress' && <button onClick={() => updateStatus(a.id, 'completed')} style={{ padding: '5px 12px', background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✓ Completa</button>}
          {['confirmed', 'in_progress'].includes(a.status) && <button onClick={() => updateStatus(a.id, 'cancelled')} style={{ padding: '5px 12px', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕ Cancella</button>}
          <Link href={`/dashboard/fatture/nuova?source=spa&id=${a.id}`} style={{ padding: '5px 12px', background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', borderRadius: '6px', fontSize: '12px', fontWeight: '500', textDecoration: 'none' }}>🧾 Fattura</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/spa" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Spa</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>📅 Appuntamenti</h1>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>+ Nuovo</button>
      </div>

      <div style={{ padding: '32px' }}>
        {/* Filtri data + sezione */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '14px' }} />
          <button onClick={() => setDateFilter('')} style={{ padding: '8px 14px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '13px' }}>Tutti</button>
          <div style={{ width: '1px', height: '30px', background: '#1f2030' }} />
          {CAT_FILTER.map(c => (
            <button key={c.key} onClick={() => setCatFilter(c.key)} style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px',
              background: catFilter === c.key ? '#8b5cf6' : '#111118',
              color: catFilter === c.key ? 'white' : '#9ca3af',
              outline: '1px solid ' + (catFilter === c.key ? '#8b5cf6' : '#1f2030'),
            }}>{c.icon} {c.label}</button>
          ))}
          <span style={{ color: '#6b7280', fontSize: '14px' }}>{filtered.length} appuntamenti</span>
        </div>

        {/* Lista raggruppata o filtrata */}
        {grouped ? (
          Object.entries(grouped).length === 0 ? (
            <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
              Nessun appuntamento. <button onClick={() => setShowForm(true)} style={{ color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer' }}>Crea il primo →</button>
            </div>
          ) : Object.entries(grouped).map(([key, group]: any) => (
            <div key={key} style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{group.icon}</span> {group.label.toUpperCase()} <span style={{ color: '#374151', fontWeight: '400' }}>({group.items.length})</span>
              </div>
              {group.items.map((a: any) => <AppointmentCard key={a.id} a={a} />)}
            </div>
          ))
        ) : (
          <div>
            {filtered.length === 0 ? (
              <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                Nessun appuntamento. <button onClick={() => setShowForm(true)} style={{ color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer' }}>Crea il primo →</button>
              </div>
            ) : filtered.map(a => <AppointmentCard key={a.id} a={a} />)}
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '32px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', marginTop: 0, marginBottom: '24px' }}>Nuovo Appuntamento</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Nome cliente *</label>
                <input style={inputStyle} value={form.guest_name} onChange={e => setForm({ ...form, guest_name: e.target.value })} placeholder="Nome e cognome" />
              </div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Telefono</label><input style={inputStyle} value={form.guest_phone} onChange={e => setForm({ ...form, guest_phone: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Email</label><input style={inputStyle} value={form.guest_email} onChange={e => setForm({ ...form, guest_email: e.target.value })} /></div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Servizio *</label>
                <select style={inputStyle} value={form.service_id} onChange={e => setForm({ ...form, service_id: e.target.value })}>
                  <option value="">— Seleziona servizio —</option>
                  {CAT_FILTER.filter(c => c.key !== 'all').map(cat => {
                    const catSvcs = services.filter(s => s.category === cat.key)
                    if (catSvcs.length === 0) return null
                    return (
                      <optgroup key={cat.key} label={`${cat.icon} ${cat.label}`}>
                        {catSvcs.map(s => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min · €{s.price}</option>)}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Operatore</label>
                <select style={inputStyle} value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })}>
                  <option value="">— Da assegnare —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Data *</label><input style={inputStyle} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Orario *</label><input style={inputStyle} type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Note</label><input style={inputStyle} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Allergie, preferenze..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: '#1f2030', color: '#9ca3af', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={save} disabled={!form.guest_name || !form.service_id || !form.date} style={{ flex: 1, padding: '10px', background: (form.guest_name && form.service_id && form.date) ? '#8b5cf6' : '#1f2030', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>Salva</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pagamento */}
      {paymentModal && (() => {
        const a = appointments.find(x => x.id === paymentModal.appointmentId)
        return (
          <PaymentModal
            title={`${a?.service?.name || 'Servizio Spa'} — ${a?.guest_name || ''}`}
            amount={Number(a?.price || 0)}
            onConfirm={handlePaymentConfirm}
            onCancel={() => setPaymentModal(null)}
          />
        )
      })()}
    </div>
  )
}
