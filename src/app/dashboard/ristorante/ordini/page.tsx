'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'
import Link from 'next/link'
import { autoGenerateInvoice } from '@/lib/autoInvoice'
import PaymentModal from '@/components/PaymentModal'

const OS: Record<string, { label: string; color: string }> = {
  open:      { label: 'Aperto',     color: '#3b82f6' },
  preparing: { label: 'In cucina',  color: '#f59e0b' },
  ready:     { label: 'Pronto',     color: '#10b981' },
  served:    { label: 'Servito',    color: '#6b7280' },
  paid:      { label: 'Pagato',     color: '#4ade80' },
  cancelled: { label: 'Cancellato', color: '#ef4444' },
}

export default function OrdiniPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeOrder, setActiveOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [filter, setFilter] = useState('active')
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [newOrderTable, setNewOrderTable] = useState('')
  const [activeCat, setActiveCat] = useState('')
  const [paymentModal, setPaymentModal] = useState<{ orderId: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadAll()
    })
  }, [])

  const loadAll = async () => {
    const [ordersRes, tablesRes, itemsRes, catsRes] = await Promise.all([
      supabase.from('restaurant_orders').select('*, table:restaurant_tables(table_number)').order('created_at', { ascending: false }),
      supabase.from('restaurant_tables').select('*').order('table_number'),
      supabase.from('menu_items').select('*, category:menu_categories(name)').eq('is_available', true).order('sort_order'),
      supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order'),
    ])
    setOrders(ordersRes.data || [])
    setTables(tablesRes.data || [])
    setMenuItems(itemsRes.data || [])
    setCategories(catsRes.data || [])
    if (catsRes.data?.length) setActiveCat(catsRes.data[0].id)
    setLoading(false)
  }

  const loadOrderItems = async (orderId: string) => {
    const { data } = await supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at')
    setOrderItems(data || [])
  }

  const openOrder = async (order: any) => {
    setActiveOrder(order)
    await loadOrderItems(order.id)
  }

  const createOrder = async () => {
    if (!newOrderTable) return
    const tenantId = await getTenantId()
    const { data } = await supabase.from('restaurant_orders').insert([{ table_id: newOrderTable, tenant_id: tenantId }]).select('*, table:restaurant_tables(table_number)').single()
    if (data) {
      await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', newOrderTable)
      setOrders(prev => [data, ...prev])
      setShowNewOrder(false)
      setNewOrderTable('')
      setActiveOrder(data)
      setOrderItems([])
    }
  }

  const addItem = async (item: any) => {
    if (!activeOrder) return
    const existing = orderItems.find(oi => oi.menu_item_id === item.id)
    if (existing) {
      await supabase.from('order_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
      setOrderItems(prev => prev.map(oi => oi.id === existing.id ? { ...oi, quantity: oi.quantity + 1 } : oi))
    } else {
      const { data } = await supabase.from('order_items').insert([{
        order_id: activeOrder.id, menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, tenant_id: await getTenantId()
      }]).select().single()
      if (data) setOrderItems(prev => [...prev, data])
    }
    // Aggiorna totale
    const newTotal = [...orderItems, { price: item.price, quantity: 1 }]
      .reduce((sum, oi) => sum + (oi.price * (oi.id === existing?.id ? oi.quantity + 1 : oi.quantity)), 0)
    updateTotal(newTotal)
  }

  const removeItem = async (itemId: string) => {
    const item = orderItems.find(oi => oi.id === itemId)
    if (!item) return
    if (item.quantity > 1) {
      await supabase.from('order_items').update({ quantity: item.quantity - 1 }).eq('id', itemId)
      setOrderItems(prev => prev.map(oi => oi.id === itemId ? { ...oi, quantity: oi.quantity - 1 } : oi))
    } else {
      await supabase.from('order_items').delete().eq('id', itemId)
      setOrderItems(prev => prev.filter(oi => oi.id !== itemId))
    }
    const updated = orderItems.map(oi => oi.id === itemId ? { ...oi, quantity: Math.max(0, oi.quantity - 1) } : oi).filter(oi => oi.quantity > 0)
    const newTotal = updated.reduce((sum, oi) => sum + oi.price * oi.quantity, 0)
    updateTotal(newTotal)
  }

  const updateTotal = async (total: number) => {
    if (!activeOrder) return
    await supabase.from('restaurant_orders').update({ total, updated_at: new Date().toISOString() }).eq('id', activeOrder.id)
    setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, total } : o))
    setActiveOrder((prev: any) => prev ? { ...prev, total } : prev)
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    // Per il pagamento, mostra prima il modal
    if (status === 'paid') {
      setPaymentModal({ orderId })
      return
    }
    await supabase.from('restaurant_orders').update({ status }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    if (activeOrder?.id === orderId) setActiveOrder((prev: any) => ({ ...prev, status }))
  }

  const handlePaymentConfirm = async (payment: { method: string; note: string; isComplimentary: boolean }) => {
    if (!paymentModal) return
    const orderId = paymentModal.orderId
    const order = orders.find(o => o.id === orderId)
    setPaymentModal(null)

    // Aggiorna ordine
    await supabase.from('restaurant_orders').update({
      status: 'paid',
      payment_method: payment.method,
      payment_note: payment.note || null,
      is_complimentary: payment.isComplimentary,
    }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'paid' } : o))
    if (activeOrder?.id === orderId) setActiveOrder((prev: any) => ({ ...prev, status: 'paid' }))
    if (order?.table_id) await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', order.table_id)

    // Genera fattura automatica
    const items = orderItems.map(oi => ({
      description: `${oi.name} × ${oi.quantity}`,
      quantity: oi.quantity,
      unit_price: Number(oi.price),
      tax_rate: 10,
    }))
    await autoGenerateInvoice({
      source: 'ristorante',
      sourceId: orderId,
      clientFirstName: 'Cliente',
      clientLastName: `Tavolo ${order?.table?.table_number || ''}`,
      items,
      taxRate: 10,
      paymentMethod: payment.method,
      paymentNote: payment.note,
      isComplimentary: payment.isComplimentary,
      router,
    })
  }

  const orderTotal = orderItems.reduce((sum, oi) => sum + oi.price * oi.quantity, 0)
  const filtered = orders.filter(o => filter === 'all' ? true : filter === 'active' ? ['open','preparing','ready'].includes(o.status) : o.status === filter)
  const catItems = menuItems.filter(i => i.category_id === activeCat)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280' }}>Caricamento...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/ristorante" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Ristorante</Link>
          <span style={{ color: '#2a2a3a' }}>|</span>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>📋 Ordini</h1>
        </div>
        <button onClick={() => setShowNewOrder(true)} style={{
          padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none',
          borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500'
        }}>+ Nuovo Ordine</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Colonna sinistra: lista ordini */}
        <div style={{ width: '280px', borderRight: '1px solid #1f2030', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #1f2030' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[['active','Attivi'],['all','Tutti'],['paid','Pagati']].map(([k,l]) => (
                <button key={k} onClick={() => setFilter(k)} style={{
                  padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px',
                  background: filter === k ? '#3b82f6' : '#1f2030', color: filter === k ? 'white' : '#9ca3af',
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 16px', fontSize: '13px' }}>Nessun ordine</div>
            ) : filtered.map(order => {
              const sc = OS[order.status]
              return (
                <div key={order.id} onClick={() => openOrder(order)} style={{
                  background: activeOrder?.id === order.id ? '#1a2030' : '#111118',
                  border: `1px solid ${activeOrder?.id === order.id ? '#3b82f6' : '#1f2030'}`,
                  borderRadius: '10px', padding: '14px', marginBottom: '8px', cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', color: '#f1f1f1', fontSize: '15px' }}>
                      Tavolo {order.table?.table_number || '—'}
                    </span>
                    <span style={{ background: sc.color + '20', color: sc.color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                      {sc.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>{order.order_number}</div>
                  <div style={{ fontSize: '14px', color: '#f1f1f1', fontWeight: '500', marginTop: '6px' }}>
                    €{Number(order.total || 0).toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Colonna centrale: ordine attivo */}
        {activeOrder ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1f2030' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1f2030', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: '600', color: '#f1f1f1' }}>Tavolo {activeOrder.table?.table_number}</span>
                <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '12px', fontFamily: 'monospace' }}>{activeOrder.order_number}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {activeOrder.status === 'open' && (
                  <button onClick={() => updateOrderStatus(activeOrder.id, 'preparing')} style={{
                    padding: '6px 14px', background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                  }}>👨‍🍳 Invia cucina</button>
                )}
                {activeOrder.status === 'preparing' && (
                  <button onClick={() => updateOrderStatus(activeOrder.id, 'ready')} style={{
                    padding: '6px 14px', background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                  }}>✅ Pronto</button>
                )}
                {activeOrder.status === 'ready' && (
                  <button onClick={() => updateOrderStatus(activeOrder.id, 'served')} style={{
                    padding: '6px 14px', background: '#6b728020', color: '#9ca3af', border: '1px solid #6b728040', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                  }}>🍽️ Servito</button>
                )}
                {['served','open','preparing','ready'].includes(activeOrder.status) && (
                  <button onClick={() => updateOrderStatus(activeOrder.id, 'paid')} style={{
                    padding: '6px 14px', background: '#4ade8020', color: '#4ade80', border: '1px solid #4ade8040', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                  }}>💳 Paga €{orderTotal.toFixed(2)}</button>
                )}
                <Link href={`/dashboard/fatture/nuova?source=ristorante&id=${activeOrder.id}`} style={{ padding: '6px 14px', background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', borderRadius: '6px', fontSize: '12px', fontWeight: '500', textDecoration: 'none' }}>🧾 Fattura</Link>
              </div>
            </div>

            {/* Items ordine */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {orderItems.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px', fontSize: '14px' }}>
                  Ordine vuoto — aggiungi piatti dal menu →
                </div>
              ) : orderItems.map(oi => (
                <div key={oi.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: '1px solid #1f2030'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: '#f1f1f1' }}>{oi.name}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>€{Number(oi.price).toFixed(2)} × {oi.quantity}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#f1f1f1', minWidth: '60px', textAlign: 'right' }}>
                      €{(oi.price * oi.quantity).toFixed(2)}
                    </span>
                    {['open','preparing'].includes(activeOrder.status) && (
                      <button onClick={() => removeItem(oi.id)} style={{
                        width: '24px', height: '24px', background: '#ef444420', color: '#ef4444',
                        border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', lineHeight: '1'
                      }}>−</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totale */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #1f2030', background: '#0d0d14' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#9ca3af', fontSize: '14px' }}>Totale</span>
                <span style={{ fontSize: '28px', fontWeight: '700', color: '#f1f1f1' }}>€{orderTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: '14px', borderRight: '1px solid #1f2030' }}>
            Seleziona un ordine o creane uno nuovo
          </div>
        )}

        {/* Colonna destra: menu */}
        {activeOrder && ['open', 'preparing'].includes(activeOrder.status) && (
          <div style={{ width: '320px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #1f2030' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '10px' }}>MENU</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
                    padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px',
                    background: activeCat === c.id ? '#3b82f6' : '#1f2030',
                    color: activeCat === c.id ? 'white' : '#9ca3af',
                  }}>{c.name}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {catItems.map(item => (
                <div key={item.id} onClick={() => addItem(item)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px', background: '#111118', border: '1px solid #1f2030',
                  borderRadius: '8px', marginBottom: '8px', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1f2030')}
                >
                  <div>
                    <div style={{ fontSize: '13px', color: '#f1f1f1', fontWeight: '500' }}>{item.name}</div>
                    {item.is_vegetarian && <span style={{ fontSize: '10px', color: '#10b981' }}>🌿 </span>}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6' }}>€{Number(item.price).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal nuovo ordine */}
      {showNewOrder && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '32px', width: '360px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f1f1', marginTop: 0, marginBottom: '20px' }}>Nuovo Ordine</h2>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Seleziona tavolo</label>
            <select value={newOrderTable} onChange={e => setNewOrderTable(e.target.value)} style={{
              width: '100%', padding: '10px 14px', background: '#0a0a0f', border: '1px solid #2a2a3a',
              borderRadius: '8px', color: '#f1f1f1', fontSize: '14px', marginBottom: '20px'
            }}>
              <option value="">— Scegli tavolo —</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>
                  Tavolo {t.table_number} ({t.location}) · {t.status === 'free' ? 'Libero' : t.status}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowNewOrder(false)} style={{
                flex: 1, padding: '10px', background: '#1f2030', color: '#9ca3af',
                border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer'
              }}>Annulla</button>
              <button onClick={createOrder} disabled={!newOrderTable} style={{
                flex: 1, padding: '10px', background: newOrderTable ? '#3b82f6' : '#1f2030',
                color: 'white', border: 'none', borderRadius: '8px', cursor: newOrderTable ? 'pointer' : 'not-allowed', fontWeight: '500'
              }}>Crea Ordine</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pagamento */}
      {paymentModal && (
        <PaymentModal
          title={`Pagamento Tavolo ${orders.find(o => o.id === paymentModal.orderId)?.table?.table_number || ''}`}
          amount={orderTotal}
          onConfirm={handlePaymentConfirm}
          onCancel={() => setPaymentModal(null)}
        />
      )}
    </div>
  )
}
