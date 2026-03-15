'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useStaffNav } from '@/lib/useStaffNav'
import { useI18n } from '@/lib/i18n-context'
import { autoGenerateInvoice } from '@/lib/autoInvoice'
import PaymentModal from '@/components/PaymentModal'

const STATUS_FLOW: Record<string,string> = { open:'preparing', preparing:'ready', ready:'served', served:'paid' }
const STATUS_COLOR: Record<string,string> = { open:'#3b82f6', preparing:'#f59e0b', ready:'#8b5cf6', served:'#10b981', paid:'#6b7280', cancelled:'#ef4444' }
const STATUS_LABEL: Record<string,string> = { open:'Aperto', preparing:'In preparazione', ready:'Pronto', served:'Servito', paid:'Pagato', cancelled:'Cancellato' }
const STATUS_ICON: Record<string,string> = { open:'📝', preparing:'👨‍🍳', ready:'🔔', served:'🍽️', paid:'✅', cancelled:'✕' }

export default function OrdiniPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const { t } = useI18n()
  const [orders, setOrders] = useState<any[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [showNew, setShowNew] = useState(false)
  const [paymentModal, setPaymentModal] = useState<any>(null)
  const [updating, setUpdating] = useState<string|null>(null)
  const [newOrder, setNewOrder] = useState({ table_id: '', items: [] as {id:string;name:string;price:number;qty:number}[], notes: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [])

  const load = async () => {
    const [ordRes, tabRes, menuRes] = await Promise.all([
      supabase.from('restaurant_orders').select('*, table:restaurant_tables(table_number,location), items:restaurant_order_items(*, menu_item:menu_items(name,price))').order('created_at', { ascending: false }),
      supabase.from('restaurant_tables').select('*').order('table_number'),
      supabase.from('menu_items').select('*, category:menu_categories(name)').eq('is_active', true).order('sort_order'),
    ])
    setOrders(ordRes.data || [])
    setTables(tabRes.data || [])
    setMenuItems(menuRes.data || [])
    setLoading(false)
  }

  const nextStatus = async (o: any) => {
    const next = STATUS_FLOW[o.status]
    if (!next) return
    if (next === 'paid') { setPaymentModal(o); return }
    setUpdating(o.id)
    await supabase.from('restaurant_orders').update({ status: next }).eq('id', o.id)
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: next } : x))
    // Se servito → aggiorna status tavolo a libero
    if (next === 'served') {
      await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', o.table_id)
    }
    setUpdating(null)
  }

  const handlePayment = async (payment: any) => {
    if (!paymentModal) return
    const o = paymentModal
    setPaymentModal(null)
    setUpdating(o.id)
    await supabase.from('restaurant_orders').update({ status: 'paid', payment_method: payment.method }).eq('id', o.id)
    await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', o.table_id)
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: 'paid' } : x))
    await autoGenerateInvoice({
      source: 'ristorante', sourceId: o.id,
      clientFirstName: `Tavolo`, clientLastName: o.table?.table_number || '',
      items: [{ description: `Ordine tavolo ${o.table?.table_number} — ${new Date().toLocaleDateString('it-IT')}`, quantity: 1, unit_price: Number(o.total || 0), tax_rate: 10 }],
      taxRate: 10, paymentMethod: payment.method, isComplimentary: payment.isComplimentary, router,
    })
    setUpdating(null)
  }

  const createOrder = async () => {
    if (!newOrder.table_id || newOrder.items.length === 0) return
    const total = newOrder.items.reduce((s,i) => s + i.price * i.qty, 0)
    const { data: ord, error } = await supabase.from('restaurant_orders').insert([{
      table_id: newOrder.table_id, status: 'open', total, notes: newOrder.notes
    }]).select().single()
    if (error || !ord) { alert('Errore: ' + error?.message); return }
    // Inserisci items
    const itemRows = newOrder.items.map(i => ({ order_id: ord.id, menu_item_id: i.id, quantity: i.qty, unit_price: i.price, subtotal: i.price * i.qty }))
    await supabase.from('restaurant_order_items').insert(itemRows)
    // Segna tavolo come occupato
    await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', newOrder.table_id)
    setShowNew(false)
    setNewOrder({ table_id: '', items: [], notes: '' })
    await load()
  }

  const addItem = (item: any) => {
    setNewOrder(prev => {
      const existing = prev.items.find(i => i.id === item.id)
      if (existing) return { ...prev, items: prev.items.map(i => i.id === item.id ? {...i, qty: i.qty+1} : i) }
      return { ...prev, items: [...prev.items, { id: item.id, name: item.name, price: Number(item.price), qty: 1 }] }
    })
  }

  const removeItem = (id: string) => setNewOrder(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }))

  const filtered = filter === 'active'
    ? orders.filter(o => ['open','preparing','ready','served'].includes(o.status))
    : filter === 'all' ? orders : orders.filter(o => o.status === filter)

  // Raggruppa per stato (Kanban)
  const byStatus = ['open','preparing','ready','served'].reduce((acc, s) => {
    acc[s] = filtered.filter(o => o.status === s)
    return acc
  }, {} as Record<string,any[]>)

  const totalActive = ['open','preparing','ready','served'].reduce((s, st) => s + (byStatus[st]?.length||0), 0)

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  const IS: any = { padding:'8px 10px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', width:'100%', boxSizing:'border-box', outline:'none' }

  return (
    <div style={{ minHeight:'100vh', background:'white', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ borderBottom:'1px solid #e2e8f0', padding:'14px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'white', zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <Link href="/dashboard/ristorante" style={{ color:'#94a3b8', textDecoration:'none', fontSize:'13px' }}>← Restaurant</Link>
          <span style={{ color:'#2a2a3a' }}>|</span>
          <h1 style={{ fontSize:'17px', fontWeight:'600', color:'#0f172a', margin:0 }}>📋 Ordini</h1>
          {totalActive > 0 && <span style={{ background:'#ef444420', color:'#f87171', padding:'2px 10px', borderRadius:'12px', fontSize:'12px' }}>{totalActive} attivi</span>}
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {['active','paid','all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'7px 12px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'12px', background:filter===f?'#10b981':'#111118', color:filter===f?'white':'#9ca3af', outline:`1px solid ${filter===f?'#10b981':'#1f2030'}` }}>
              {f==='active'?'Attivi':f==='paid'?'Pagati':'Tutti'}
            </button>
          ))}
          <button onClick={() => setShowNew(v=>!v)} style={{ padding:'8px 16px', background:showNew?'#374151':'#10b981', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'500' }}>
            {showNew ? '✕ Chiudi' : '+ Nuovo ordine'}
          </button>
        </div>
      </div>

      <div style={{ padding:'20px 24px' }}>
        {/* Form nuovo ordine */}
        {showNew && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'20px 24px', marginBottom:'20px' }}>
            <h3 style={{ color:'#0f172a', fontSize:'14px', fontWeight:'600', margin:'0 0 16px' }}>Nuovo ordine</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <div>
                <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px' }}>Tavolo *</div>
                <select style={IS} value={newOrder.table_id} onChange={e => setNewOrder(p => ({...p, table_id: e.target.value}))}>
                  <option value="">Seleziona tavolo...</option>
                  {tables.map(t => <option key={t.id} value={t.id}>Tavolo {t.table_number} ({t.location}) — {t.status==='free'?'🟢 Libero':'🔴 Occupato'}</option>)}
                </select>
                <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'12px', marginBottom:'6px' }}>Note</div>
                <input style={IS} value={newOrder.notes} onChange={e => setNewOrder(p => ({...p, notes: e.target.value}))} placeholder="Note per la cucina..." />
                {newOrder.items.length > 0 && (
                  <div style={{ marginTop:'12px', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', padding:'12px' }}>
                    <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'8px' }}>ORDINE</div>
                    {newOrder.items.map(item => (
                      <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
                        <span style={{ fontSize:'13px', color:'#d1d5db' }}>{item.qty}x {item.name}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'13px', color:'#f59e0b' }}>€{(item.price*item.qty).toFixed(0)}</span>
                          <button onClick={() => removeItem(item.id)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'12px' }}>✕</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop:'1px solid #1f2030', marginTop:'8px', paddingTop:'8px', display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>Totale</span>
                      <span style={{ fontSize:'15px', fontWeight:'700', color:'#10b981' }}>€{newOrder.items.reduce((s,i)=>s+i.price*i.qty,0).toFixed(2)}</span>
                    </div>
                    <button onClick={createOrder} disabled={!newOrder.table_id} style={{ width:'100%', marginTop:'12px', padding:'10px', background:newOrder.table_id?'#10b981':'#374151', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>
                      ✓ Conferma ordine
                    </button>
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px' }}>Aggiungi piatti</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'360px', overflowY:'auto' }}>
                  {menuItems.map(item => (
                    <div key={item.id} onClick={() => addItem(item)}
                      style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'8px', cursor:'pointer', transition:'border-color 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#10b981'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='#2a2a3a'}>
                      <div>
                        <div style={{ fontSize:'13px', color:'#0f172a' }}>{item.name}</div>
                        <div style={{ fontSize:'10px', color:'#94a3b8' }}>{item.category?.name}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontSize:'13px', fontWeight:'600', color:'#f59e0b' }}>€{Number(item.price).toFixed(0)}</span>
                        <span style={{ fontSize:'16px', color:'#10b981' }}>+</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Kanban view (solo per ordini attivi) */}
        {filter === 'active' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
            {Object.entries(byStatus).map(([status, statusOrders]) => {
              const c = STATUS_COLOR[status]
              return (
                <div key={status} style={{ background:'white', border:`1px solid ${c}30`, borderRadius:'12px', overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', background:`${c}15`, borderBottom:`1px solid ${c}30`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'12px', fontWeight:'700', color:c }}>{STATUS_ICON[status]} {STATUS_LABEL[status]}</span>
                    <span style={{ fontSize:'11px', background:`${c}20`, color:c, padding:'1px 8px', borderRadius:'10px' }}>{statusOrders.length}</span>
                  </div>
                  <div style={{ padding:'8px', display:'flex', flexDirection:'column', gap:'6px', minHeight:'80px' }}>
                    {statusOrders.length === 0 && <div style={{ fontSize:'11px', color:'#94a3b8', textAlign:'center', padding:'12px' }}>—</div>}
                    {statusOrders.map(o => (
                      <div key={o.id} style={{ background:'white', border:`1px solid ${c}30`, borderRadius:'8px', padding:'10px 12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                          <span style={{ fontSize:'13px', fontWeight:'700', color:'#0f172a' }}>Tav. {o.table?.table_number}</span>
                          <span style={{ fontSize:'12px', fontWeight:'600', color:'#f59e0b' }}>€{Number(o.total||0).toFixed(0)}</span>
                        </div>
                        <div style={{ fontSize:'10px', color:'#94a3b8', marginBottom:'8px' }}>
                          {new Date(o.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
                          {o.notes && ` · ${o.notes}`}
                        </div>
                        {o.items?.slice(0,3).map((item: any,i: number) => (
                          <div key={i} style={{ fontSize:'11px', color:'#64748b' }}>
                            {item.quantity}x {item.menu_item?.name}
                          </div>
                        ))}
                        {STATUS_FLOW[status] && (
                          <button onClick={() => nextStatus(o)} disabled={updating===o.id}
                            style={{ width:'100%', marginTop:'8px', padding:'5px', background:`${c}20`, color:c, border:`1px solid ${c}40`, borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>
                            {updating===o.id ? '...' : `→ ${STATUS_LABEL[STATUS_FLOW[status]]}`}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Lista per filtri non-kanban */}
        {filter !== 'active' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {filtered.map(o => {
              const c = STATUS_COLOR[o.status]
              return (
                <div key={o.id} style={{ background:'white', border:`1px solid ${c}30`, borderRadius:'12px', padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a' }}>Tavolo {o.table?.table_number}</div>
                    <div style={{ fontSize:'12px', color:'#94a3b8' }}>{new Date(o.created_at).toLocaleString('it-IT')}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <span style={{ background:`${c}20`, color:c, padding:'3px 10px', borderRadius:'12px', fontSize:'12px' }}>{STATUS_ICON[o.status]} {STATUS_LABEL[o.status]}</span>
                    <span style={{ fontSize:'16px', fontWeight:'700', color:'#f59e0b' }}>€{Number(o.total||0).toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <div style={{ textAlign:'center', color:'#94a3b8', padding:'40px', fontSize:'13px' }}>Nessun ordine</div>}
          </div>
        )}
      </div>

      {paymentModal && (
        <PaymentModal
          title={`Chiudi conto — Tavolo ${paymentModal.table?.table_number}`}
          amount={Number(paymentModal.total||0)}
          onConfirm={handlePayment}
          onCancel={() => setPaymentModal(null)}
        />
      )}
    </div>
  )
}
