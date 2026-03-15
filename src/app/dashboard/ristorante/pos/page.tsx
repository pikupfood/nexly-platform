'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useStaffNav } from '@/lib/useStaffNav'
import PaymentModal from '@/components/PaymentModal'
import { autoGenerateInvoice } from '@/lib/autoInvoice'

// ─── Tipi ─────────────────────────────────────────────────────────────────────
type Dept = 'cucina' | 'pizzeria' | 'bar'
type Course = 1 | 2 | 3 | 4
type CartItem = {
  menu_item_id: string; name: string; price: number
  quantity: number; notes: string; department: Dept
  course: Course; seat?: number; fire_status: 'hold' | 'fired'
}
type POSView = 'pos' | 'orders' | 'tables'

const DEPT: Record<Dept, { label:string; icon:string; color:string; bg:string; kds:string }> = {
  cucina:   { label:'Cucina',   icon:'👨‍🍳', color:'#f59e0b', bg:'#f59e0b12', kds:'Cucina' },
  pizzeria: { label:'Pizzeria', icon:'🍕',   color:'#ef4444', bg:'#ef444412', kds:'Pizzeria' },
  bar:      { label:'Bar',      icon:'🍸',   color:'#3b82f6', bg:'#3b82f612', kds:'Bar' },
}
const COURSES: Record<Course, { label:string; short:string; color:string }> = {
  1: { label:'Entrée',  short:'E', color:'#10b981' },
  2: { label:'Plat',    short:'P', color:'#3b82f6' },
  3: { label:'Dessert', short:'D', color:'#8b5cf6' },
  4: { label:'Extra',   short:'X', color:'#94a3b8' },
}
const ST_COLOR: Record<string,string> = { open:'#3b82f6', preparing:'#f59e0b', ready:'#10b981', served:'#8b5cf6', paid:'#6b7280' }
const ST_LABEL: Record<string,string> = { open:'Aperto', preparing:'In prepar.', ready:'Pronto', served:'Servito', paid:'Pagato' }

// ─── Modal prodotto ────────────────────────────────────────────────────────────
function ProductModal({ item, onAdd, onClose }: { item:any; onAdd:(c:CartItem)=>void; onClose:()=>void }) {
  const dept = (item.department || item.category?.department || 'cucina') as Dept
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [course, setCourse] = useState<Course>(2)
  const [seat, setSeat] = useState<number|undefined>(undefined)
  const [price, setPrice] = useState(Number(item.price || 0))
  const cfg = DEPT[dept]

  const confirm = () => {
    onAdd({ menu_item_id: item.id, name: item.name, price, quantity: qty, notes: note, department: dept, course, seat, fire_status: 'hold' })
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'white', border:`2px solid ${cfg.color}40`, borderRadius:'20px', padding:'24px', width:'100%', maxWidth:'420px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
          <div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a' }}>{item.name}</div>
            {item.description && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>{item.description}</div>}
            <div style={{ display:'flex', gap:'6px', marginTop:'6px', flexWrap:'wrap' }}>
              <span style={{ background:cfg.bg, color:cfg.color, padding:'2px 8px', borderRadius:'8px', fontSize:'11px', fontWeight:'600' }}>{cfg.icon} {cfg.label}</span>
              {item.is_vegetarian && <span style={{ background:'#10b98120', color:'#10b981', padding:'2px 8px', borderRadius:'8px', fontSize:'11px' }}>🥗 Veg</span>}
              {item.is_vegan && <span style={{ background:'#10b98120', color:'#10b981', padding:'2px 8px', borderRadius:'8px', fontSize:'11px' }}>🌱 Vegan</span>}
              {item.allergens && <span style={{ background:'#f59e0b20', color:'#f59e0b', padding:'2px 8px', borderRadius:'8px', fontSize:'11px' }}>⚠️ {item.allergens}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'20px', padding:'0 0 0 12px' }}>✕</button>
        </div>

        {/* Prezzo */}
        <div style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px', letterSpacing:'0.05em' }}>PREZZO</div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'24px', fontWeight:'900', color:cfg.color }}>€</span>
            <input type="number" step="0.50" min="0" value={price} onChange={e=>setPrice(Number(e.target.value))}
              style={{ fontSize:'24px', fontWeight:'900', color:cfg.color, background:'transparent', border:'none', borderBottom:`2px solid ${cfg.color}`, outline:'none', width:'80px' }} />
          </div>
        </div>

        {/* Quantità */}
        <div style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px', letterSpacing:'0.05em' }}>QUANTITÀ</div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            {[1,2,3,4,5,6].map(n=>(
              <button key={n} onClick={()=>setQty(n)} style={{ width:'40px', height:'40px', borderRadius:'10px', border:'none', cursor:'pointer', fontSize:'15px', fontWeight:'700', background:qty===n?cfg.color:'#1f2030', color:qty===n?'black':'#9ca3af' }}>{n}</button>
            ))}
            <input type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,parseInt(e.target.value)||1))}
              style={{ width:'50px', padding:'8px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#0f172a', fontSize:'14px', textAlign:'center', outline:'none' }} />
          </div>
        </div>

        {/* Corso */}
        <div style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px', letterSpacing:'0.05em' }}>CORSO</div>
          <div style={{ display:'flex', gap:'6px' }}>
            {([1,2,3,4] as Course[]).map(c=>{
              const cc = COURSES[c]
              return (
                <button key={c} onClick={()=>setCourse(c)} style={{ flex:1, padding:'8px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'700', background:course===c?cc.color:'#1f2030', color:course===c?'white':'#6b7280', outline:`1px solid ${course===c?cc.color:'#2a2a3a'}` }}>
                  {cc.short} {cc.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Posto */}
        <div style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px', letterSpacing:'0.05em' }}>POSTO (opzionale)</div>
          <div style={{ display:'flex', gap:'6px' }}>
            {[undefined,1,2,3,4,5,6].map(n=>(
              <button key={n??'all'} onClick={()=>setSeat(n)} style={{ padding:'6px 10px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600', background:seat===n?'#4b5563':'#1f2030', color:seat===n?'white':'#6b7280', outline:`1px solid ${seat===n?'#4b5563':'#2a2a3a'}` }}>
                {n===undefined?'Tutti':n}
              </button>
            ))}
          </div>
        </div>

        {/* Nota */}
        <div style={{ marginBottom:'20px' }}>
          <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px', letterSpacing:'0.05em' }}>NOTA AL REPARTO</div>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="es. senza aglio, ben cotta, ghiaccio a parte..."
            style={{ width:'100%', padding:'10px 12px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#0f172a', fontSize:'13px', outline:'none', resize:'none', height:'60px', boxSizing:'border-box' }} />
        </div>

        {/* Bottone conferma */}
        <button onClick={confirm} style={{ width:'100%', padding:'14px', background:cfg.color, color:'black', border:'none', borderRadius:'12px', cursor:'pointer', fontSize:'16px', fontWeight:'900' }}>
          + Aggiungi — €{(price*qty).toFixed(2)}
        </button>
      </div>
    </div>
  )
}

// ─── Componente principale POS ─────────────────────────────────────────────────
export default function POSPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()

  // Auth + dati
  const [tenantId, setTenantId] = useState<string|null>(null)
  const [tables, setTables] = useState<any[]>([])
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // POS state
  const [view, setView] = useState<POSView>('pos')
  const [selectedTable, setSelectedTable] = useState<any>(null)
  const [suiteName, setSuiteName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [covers, setCovers] = useState(2)
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCat, setActiveCat] = useState('all')
  const [deptFilter, setDeptFilter] = useState<Dept|'all'>('all')
  const [searchMenu, setSearchMenu] = useState('')
  const [courseView, setCourseView] = useState<Course|'all'>('all')
  const [sending, setSending] = useState(false)
  const [productModal, setProductModal] = useState<any>(null)
  const [paymentModal, setPaymentModal] = useState<any>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [updatingOrder, setUpdatingOrder] = useState<string|null>(null)
  // Ordine aperto corrente (per aggiungere items)
  const [openOrderId, setOpenOrderId] = useState<string|null>(null)
  const [editingOrder, setEditingOrder] = useState<any>(null)
  // Editing menu item
  const [editItem, setEditItem] = useState<any>(null)
  const [editItemForm, setEditItemForm] = useState<any>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      const { data: t } = await supabase.from('tenants').select('id').eq('user_id', session.user.id).single()
      if (t?.id) { setTenantId(t.id) }
      else {
        const { data: prof } = await supabase.rpc('get_staff_profile', { p_user_id: session.user.id })
        setTenantId(prof?.tenant_id || null)
      }
      await loadData()
    })
    const sub = supabase.channel('pos-rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'restaurant_orders' }, () => loadActiveOrders())
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const loadData = async () => {
    const [tblR, menuR, catR] = await Promise.all([
      supabase.from('restaurant_tables').select('*').order('table_number'),
      supabase.from('menu_items').select('*, category:menu_categories(id,name,department,kds_target)').eq('is_active', true).order('sort_order'),
      supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order'),
    ])
    setTables(tblR.data||[])
    setMenuItems(menuR.data||[])
    setCategories(catR.data||[])
    await loadActiveOrders()
    setLoading(false)
  }

  const loadActiveOrders = async () => {
    const { data } = await supabase.from('restaurant_orders')
      .select('*, table:restaurant_tables(table_number,location), items:order_items(id,quantity,price,notes,name,department,status,fire_status,course,seat,menu_item_id)')
      .in('status', ['open','preparing','ready','served'])
      .order('created_at', { ascending: true })
    setActiveOrders(data||[])
  }

  // ─── Carrello ─────────────────────────────────────────────────────────────
  const addToCart = (item: CartItem) => {
    setCart(prev => [...prev, item])
  }

  const removeCartItem = (idx: number) => setCart(prev => prev.filter((_,i)=>i!==idx))
  const updateCartQty = (idx: number, delta: number) => setCart(prev => {
    const next = [...prev]; const nq = next[idx].quantity + delta
    if (nq <= 0) return next.filter((_,i)=>i!==idx)
    next[idx] = {...next[idx], quantity: nq}; return next
  })
  const updateCartNote = (idx: number, note: string) => setCart(prev => {
    const next=[...prev]; next[idx]={...next[idx],notes:note}; return next
  })

  const cartByCourse = (course: Course) => cart.filter(c=>c.course===course)
  const cartTotal = cart.reduce((s,c)=>s+c.price*c.quantity, 0)
  const cartCount = cart.reduce((s,c)=>s+c.quantity, 0)

  // ─── Invia ordine ─────────────────────────────────────────────────────────
  const sendOrder = async () => {
    if (!tenantId || !selectedTable || cart.length===0) return
    setSending(true)
    // Se c'è un ordine aperto su questo tavolo → aggiungi items
    const existingOrder = activeOrders.find(o => o.table_id === selectedTable.id)
    if (existingOrder && openOrderId) {
      const { error } = await supabase.rpc('pos_add_items_to_order', {
        p_order_id: openOrderId,
        p_items: cart.map(c=>({ menu_item_id:c.menu_item_id, name:c.name, price:c.price, quantity:c.quantity, notes:c.notes||null, department:c.department, course:c.course, seat:c.seat||null, fire_status:'hold' }))
      })
      if (error) { alert('Errore: '+error.message); setSending(false); return }
      flash(`✅ Articoli aggiunti all'ordine ${existingOrder.order_number}`)
    } else {
      // Nuovo ordine — items entrée (course=1) sparati subito, piatti (course=2+) in hold
      const { data, error } = await supabase.rpc('pos_create_order', {
        p_tenant_id: tenantId, p_table_id: selectedTable.id,
        p_suite_name: suiteName||null, p_customer_name: customerName||null,
        p_covers: covers,
        p_items: cart.map(c=>({ menu_item_id:c.menu_item_id, name:c.name, price:c.price, quantity:c.quantity, notes:c.notes||null, department:c.department, course:c.course, seat:c.seat||null, fire_status: c.course===1?'fired':'hold' }))
      })
      if (error) { alert('Errore: '+error.message); setSending(false); return }
      flash(`🚀 Ordine ${data?.order_number} inviato!`)
      setOpenOrderId(data?.order_id||null)
    }
    setCart([])
    await loadActiveOrders()
    setSending(false)
  }

  // ─── Fire corso ────────────────────────────────────────────────────────────
  const fireCourse = async (orderId: string, course: Course) => {
    setUpdatingOrder(orderId)
    const { data, error } = await supabase.rpc('pos_fire_course', { p_order_id: orderId, p_course: course })
    if (error) { alert(error.message); } else {
      flash(`🔥 Corso ${COURSES[course].label} sparato al KDS! (${data} articoli)`)
    }
    await loadActiveOrders()
    setUpdatingOrder(null)
  }

  // ─── Avanza stato ordine ───────────────────────────────────────────────────
  const advanceOrder = async (order: any) => {
    const FLOW: Record<string,string> = { open:'preparing', preparing:'ready', ready:'served', served:'paid' }
    const next = FLOW[order.status]
    if (!next) return
    if (next === 'paid') { setPaymentModal(order); return }
    setUpdatingOrder(order.id)
    await supabase.rpc('pos_update_order_status', { p_order_id: order.id, p_status: next })
    setActiveOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:next}:o))
    setUpdatingOrder(null)
  }

  const handlePayment = async (payment: any) => {
    if (!paymentModal) return
    const order = paymentModal; setPaymentModal(null)
    setUpdatingOrder(order.id)
    await supabase.rpc('pos_update_order_status', { p_order_id: order.id, p_status: 'paid' })
    await supabase.from('restaurant_orders').update({ payment_method:payment.method, payment_note:payment.note||null, is_complimentary:payment.isComplimentary }).eq('id', order.id)
    const items = (order.items||[]).map((i:any)=>({ description:i.name, quantity:i.quantity, unit_price:Number(i.price||0), tax_rate:10 }))
    if (items.length) await autoGenerateInvoice({ source:'ristorante', sourceId:order.id, clientFirstName:order.customer_name||'Cliente', clientLastName:'', items, taxRate:10, paymentMethod:payment.method, paymentNote:payment.note, isComplimentary:payment.isComplimentary, router })
    setActiveOrders(prev=>prev.filter(o=>o.id!==order.id))
    setUpdatingOrder(null)
  }

  // ─── Edit prodotto ─────────────────────────────────────────────────────────
  const openEditItem = (item: any) => {
    setEditItem(item)
    setEditItemForm({ name:item.name, description:item.description||'', price:item.price, department:item.department||item.category?.department||'cucina', is_vegetarian:item.is_vegetarian, is_vegan:item.is_vegan, allergens:item.allergens||'', kitchen_note:item.kitchen_note||'', is_available:item.is_available, is_active:item.is_active })
  }

  const saveEditItem = async () => {
    if (!editItem) return
    setSavingEdit(true)
    const { error } = await supabase.from('menu_items').update({ ...editItemForm, price:Number(editItemForm.price) }).eq('id', editItem.id)
    if (!error) {
      setMenuItems(prev=>prev.map(m=>m.id===editItem.id?{...m,...editItemForm}:m))
      flash('✅ Prodotto aggiornato')
      setEditItem(null)
    } else alert('Errore: '+error.message)
    setSavingEdit(false)
  }

  // ─── Flash message ─────────────────────────────────────────────────────────
  const flash = (msg: string) => { setSuccessMsg(msg); setTimeout(()=>setSuccessMsg(''), 3000) }

  // ─── Menu filtrato ─────────────────────────────────────────────────────────
  const filteredMenu = menuItems.filter(m => {
    const mDept = m.department || m.category?.department || 'cucina'
    return (activeCat==='all'||m.category_id===activeCat) && (deptFilter==='all'||mDept===deptFilter) && (!searchMenu||m.name.toLowerCase().includes(searchMenu.toLowerCase()))
  })

  const IS: any = { padding:'8px 10px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#94a3b8', fontSize:'16px' }}>Caricamento POS...</div>
    </div>
  )

  return (
    <div style={{ height:'100vh', background:'#080810', fontFamily:'"Inter",system-ui,sans-serif', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ═══ TOP BAR ════════════════════════════════════════════════════════ */}
      <div style={{ borderBottom:'1px solid #1a1a2e', padding:'0 20px', height:'52px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'white', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <Link href={backHref} style={{ color:'#94a3b8', textDecoration:'none', fontSize:'12px' }}>←</Link>
          <Link href="/dashboard/ristorante" style={{ color:'#94a3b8', textDecoration:'none', fontSize:'12px' }}>Ristorante</Link>
          <span style={{ color:'#1f2030' }}>|</span>
          <span style={{ fontSize:'14px', fontWeight:'800', color:'#0f172a' }}>🍽️ POS</span>
          {selectedTable && (
            <span style={{ background:'#10b98130', color:'#10b981', padding:'3px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:'700' }}>
              T.{selectedTable.table_number} {suiteName&&`· ${suiteName}`}
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
          {successMsg && <span style={{ fontSize:'12px', color:'#10b981', background:'#10b98115', padding:'4px 12px', borderRadius:'8px', fontWeight:'600' }}>{successMsg}</span>}
          {(['pos','orders','tables'] as POSView[]).map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:'6px 14px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'700',
              background:view===v?'#10b981':'#1a1a25', color:view===v?'black':'#9ca3af', outline:`1px solid ${view===v?'#10b981':'#2a2a3a'}` }}>
              {v==='pos'?'🧾 POS':v==='orders'?`📋 Ordini (${activeOrders.length})`:'🪑 Tavoli'}
            </button>
          ))}
          <Link href="/dashboard/ristorante/kds" style={{ padding:'6px 12px', background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:'8px', textDecoration:'none', fontSize:'12px', fontWeight:'700' }}>📺 KDS</Link>
        </div>
      </div>

      {/* ═══ VISTA TAVOLI ════════════════════════════════════════════════════ */}
      {view==='tables' && (
        <div style={{ flex:1, padding:'20px', overflowY:'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:'10px' }}>
            {tables.map(t=>{
              const order = activeOrders.find(o=>o.table_id===t.id)
              const c = t.status==='free'?'#10b981':t.status==='occupied'?'#ef4444':'#f59e0b'
              return (
                <div key={t.id} onClick={()=>{ setSelectedTable(t); if(order) setOpenOrderId(order.id); setView('pos') }}
                  style={{ background:`${c}12`, border:`2px solid ${c}40`, borderRadius:'14px', padding:'16px', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=c} onMouseLeave={e=>e.currentTarget.style.borderColor=c+'40'}>
                  <div style={{ fontSize:'28px', fontWeight:'900', color:c }}>T.{t.table_number}</div>
                  <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>{t.capacity} posti · {t.location}</div>
                  {order && <div style={{ fontSize:'10px', color:c, marginTop:'4px', fontWeight:'700' }}>#{order.order_number}</div>}
                  <div style={{ fontSize:'11px', color:c, marginTop:'2px', fontWeight:'600' }}>{t.status==='free'?'Libero':t.status==='occupied'?'Occupato':'Prenotato'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ VISTA ORDINI ════════════════════════════════════════════════════ */}
      {view==='orders' && (
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:'12px' }}>
            {activeOrders.length===0 ? (
              <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:'60px', color:'#374151' }}>
                <div style={{ fontSize:'48px' }}>✅</div>
                <div style={{ fontSize:'16px', marginTop:'12px' }}>Nessun ordine attivo</div>
              </div>
            ) : activeOrders.map(order=>{
              const sc = ST_COLOR[order.status]
              const FLOW: Record<string,{label:string}> = { open:{label:'▶ Preparazione'}, preparing:{label:'✓ Pronto'}, ready:{label:'🍽️ Servito'}, served:{label:'💳 Paga'} }
              const sf = FLOW[order.status]
              // Corsi hold (non ancora sparati)
              const holdCourses = [...new Set((order.items||[]).filter((i:any)=>i.fire_status==='hold').map((i:any)=>i.course as Course))].sort()
              return (
                <div key={order.id} style={{ background:'white', border:`2px solid ${sc}40`, borderRadius:'16px', overflow:'hidden' }}>
                  {/* Header */}
                  <div style={{ padding:'12px 16px', background:`${sc}10`, borderBottom:`1px solid ${sc}20`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:'18px', fontWeight:'900', color:'#0f172a' }}>
                        {order.suite_name || `Tavolo ${order.table?.table_number}`}
                        {order.customer_name && <span style={{ fontSize:'13px', color:'#64748b', fontWeight:'400', marginLeft:'8px' }}>· {order.customer_name}</span>}
                      </div>
                      <div style={{ fontSize:'11px', color:sc, fontWeight:'700' }}>{order.order_number} · {ST_LABEL[order.status]} · {order.covers} cop.</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'20px', fontWeight:'900', color:'#0f172a' }}>€{Number(order.total||0).toFixed(2)}</div>
                      <div style={{ fontSize:'10px', color:'#94a3b8' }}>{new Date(order.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  </div>
                  {/* Items per corso */}
                  <div style={{ padding:'10px 14px' }}>
                    {([1,2,3,4] as Course[]).map(c=>{
                      const cItems = (order.items||[]).filter((i:any)=>i.course===c)
                      if (!cItems.length) return null
                      const cc = COURSES[c]
                      const firedItems = cItems.filter((i:any)=>i.fire_status==='fired')
                      const holdItems = cItems.filter((i:any)=>i.fire_status==='hold')
                      return (
                        <div key={c} style={{ marginBottom:'8px' }}>
                          <div style={{ fontSize:'10px', color:cc.color, fontWeight:'800', letterSpacing:'0.07em', marginBottom:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
                            {cc.short} {cc.label.toUpperCase()}
                            {holdItems.length>0 && (
                              <button onClick={()=>fireCourse(order.id, c)} disabled={updatingOrder===order.id}
                                style={{ padding:'2px 8px', background:`${cc.color}25`, color:cc.color, border:`1px solid ${cc.color}40`, borderRadius:'6px', cursor:'pointer', fontSize:'10px', fontWeight:'800' }}>
                                🔥 Spara al KDS
                              </button>
                            )}
                          </div>
                          {cItems.map((item:any,i:number)=>(
                            <div key={i} style={{ fontSize:'12px', color:item.fire_status==='hold'?'#6b7280':'#d1d5db', display:'flex', gap:'6px', alignItems:'center', marginBottom:'2px' }}>
                              <span style={{ color:cc.color, fontWeight:'700' }}>{item.quantity}×</span>
                              <span style={{ textDecoration:item.fire_status==='hold'?'none':'none' }}>{item.name}</span>
                              {item.seat && <span style={{ color:'#94a3b8', fontSize:'10px' }}>S{item.seat}</span>}
                              {item.notes && <span style={{ color:'#f59e0b', fontSize:'10px' }}>📝 {item.notes}</span>}
                              {item.fire_status==='hold' && <span style={{ color:'#94a3b8', fontSize:'9px', marginLeft:'auto' }}>⏸ HOLD</span>}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                    {/* Bottoni azioni */}
                    <div style={{ display:'flex', gap:'6px', marginTop:'10px', borderTop:'1px solid #1f2030', paddingTop:'10px' }}>
                      <button onClick={()=>{ setSelectedTable(tables.find(t=>t.id===order.table_id)); setOpenOrderId(order.id); setView('pos') }}
                        style={{ flex:1, padding:'7px', background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                        ✏️ Modifica
                      </button>
                      {sf && (
                        <button onClick={()=>advanceOrder(order)} disabled={updatingOrder===order.id}
                          style={{ flex:2, padding:'7px', background:`${sc}20`, color:sc, border:`1px solid ${sc}40`, borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'800' }}>
                          {updatingOrder===order.id?'...':sf.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ VISTA POS PRINCIPALE ═══════════════════════════════════════════ */}
      {view==='pos' && (
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 360px', overflow:'hidden' }}>

          {/* ── SINISTRA: Menu ─────────────────────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid #1a1a2e' }}>

            {/* Barra filtri */}
            <div style={{ padding:'10px 14px', background:'white', borderBottom:'1px solid #1a1a2e', flexShrink:0 }}>
              <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                <div style={{ flex:1, position:'relative' }}>
                  <span style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontSize:'14px' }}>🔍</span>
                  <input value={searchMenu} onChange={e=>setSearchMenu(e.target.value)} placeholder="Cerca prodotto..."
                    style={{ ...IS, paddingLeft:'32px', width:'100%' }} />
                </div>
                {/* Filtro reparto */}
                {(['all','cucina','pizzeria','bar'] as const).map(d=>{
                  const c = d==='all'?'#6b7280':DEPT[d as Dept]?.color||'#6b7280'
                  return (
                    <button key={d} onClick={()=>setDeptFilter(d)} style={{ padding:'7px 12px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'700',
                      background:deptFilter===d?c:'#1a1a25', color:deptFilter===d?'black':'#6b7280', outline:`1px solid ${deptFilter===d?c:'#2a2a3a'}` }}>
                      {d==='all'?'Tutti':DEPT[d as Dept].icon+' '+DEPT[d as Dept].label}
                    </button>
                  )
                })}
              </div>
              {/* Categorie scroll */}
              <div style={{ display:'flex', gap:'5px', overflowX:'auto', paddingBottom:'2px' }}>
                <button onClick={()=>setActiveCat('all')} style={{ padding:'4px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'11px', background:activeCat==='all'?'#10b981':'#1a1a25', color:activeCat==='all'?'black':'#9ca3af', whiteSpace:'nowrap', flexShrink:0, fontWeight:'600' }}>
                  Tutto
                </button>
                {categories.map(c=>{
                  const deptColor = DEPT[(c.department as Dept)]?.color||'#6b7280'
                  return (
                    <button key={c.id} onClick={()=>setActiveCat(c.id)} style={{
                      padding:'4px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap', flexShrink:0, fontWeight:'600',
                      background:activeCat===c.id?deptColor:'#1a1a25', color:activeCat===c.id?'black':'#9ca3af',
                    }}>
                      {c.name} {c.department!=='cucina'&&DEPT[c.department as Dept]?.icon}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Grid prodotti */}
            <div style={{ flex:1, overflowY:'auto', padding:'10px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:'7px', alignContent:'start' }}>
              {filteredMenu.map(item=>{
                const dept = (item.department||item.category?.department||'cucina') as Dept
                const cfg = DEPT[dept]
                const inCart = cart.filter(c=>c.menu_item_id===item.id).reduce((s,c)=>s+c.quantity,0)
                return (
                  <div key={item.id} style={{ position:'relative' }}>
                    <div onClick={()=>setProductModal(item)}
                      style={{ background:cfg.bg, border:`1.5px solid ${inCart>0?cfg.color:cfg.color+'35'}`, borderRadius:'11px', padding:'10px 8px', cursor:'pointer', transition:'all 0.1s', height:'100%' }}
                      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'}
                      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                      {inCart>0 && (
                        <div style={{ position:'absolute', top:'5px', left:'5px', width:'20px', height:'20px', borderRadius:'50%', background:cfg.color, color:'black', fontSize:'10px', fontWeight:'900', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>
                          {inCart}
                        </div>
                      )}
                      {!item.is_available && (
                        <div style={{ position:'absolute', top:'5px', right:'5px', background:'#ef444490', color:'white', fontSize:'9px', fontWeight:'700', padding:'1px 5px', borderRadius:'5px' }}>86'd</div>
                      )}
                      <div style={{ position:'absolute', top:'5px', right:'5px', fontSize:'12px' }}>{cfg.icon}</div>
                      <div style={{ fontSize:'13px', fontWeight:'700', color:'#0f172a', marginTop:'6px', lineHeight:1.3 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize:'9px', color:'#94a3b8', marginTop:'2px', lineHeight:1.3 }}>{item.description.slice(0,40)}{item.description.length>40?'...':''}</div>}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'6px' }}>
                        <span style={{ fontSize:'14px', fontWeight:'800', color:cfg.color }}>€{Number(item.price).toFixed(2)}</span>
                        <span style={{ fontSize:'10px' }}>{item.is_vegan?'🌱':item.is_vegetarian?'🥗':''}</span>
                      </div>
                    </div>
                    {/* Edit button */}
                    <button onClick={e=>{e.stopPropagation();openEditItem(item)}}
                      style={{ position:'absolute', bottom:'4px', right:'4px', width:'18px', height:'18px', borderRadius:'5px', background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#94a3b8', cursor:'pointer', fontSize:'9px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      ✏️
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── DESTRA: Scontrino ─────────────────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', background:'#0a0a12', overflow:'hidden' }}>

            {/* Info tavolo */}
            <div style={{ padding:'10px 14px', borderBottom:'1px solid #1a1a2e', flexShrink:0 }}>
              {/* Seleziona tavolo */}
              <div style={{ marginBottom:'8px' }}>
                <div style={{ fontSize:'9px', color:'#94a3b8', letterSpacing:'0.08em', marginBottom:'4px' }}>TAVOLO</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                  {tables.map(t=>{
                    const hasOrder = activeOrders.find(o=>o.table_id===t.id)
                    const sel = selectedTable?.id===t.id
                    return (
                      <button key={t.id} onClick={()=>{ setSelectedTable(t); if(hasOrder) setOpenOrderId(hasOrder.id); else setOpenOrderId(null) }}
                        style={{ padding:'4px 9px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'700',
                          background:sel?'#10b981':hasOrder?'#ef444420':'#1a1a25',
                          color:sel?'black':hasOrder?'#f87171':'#9ca3af',
                          outline:`1px solid ${sel?'#10b981':hasOrder?'#ef444440':'#2a2a3a'}` }}>
                        {t.table_number}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'6px' }}>
                <div>
                  <div style={{ fontSize:'9px', color:'#94a3b8', letterSpacing:'0.06em', marginBottom:'3px' }}>SUITE / NOTA</div>
                  <input value={suiteName} onChange={e=>setSuiteName(e.target.value)} placeholder="Suite 12, Terrazza..."
                    style={{ ...IS, width:'100%', fontSize:'12px', padding:'6px 8px' }} />
                </div>
                <div>
                  <div style={{ fontSize:'9px', color:'#94a3b8', letterSpacing:'0.06em', marginBottom:'3px' }}>CLIENTE</div>
                  <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Nome..."
                    style={{ ...IS, width:'100%', fontSize:'12px', padding:'6px 8px' }} />
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{ fontSize:'9px', color:'#94a3b8', letterSpacing:'0.06em' }}>COPERTI:</div>
                {[1,2,3,4,5,6,8,10].map(n=>(
                  <button key={n} onClick={()=>setCovers(n)} style={{ width:'26px', height:'26px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'700', background:covers===n?'#3b82f6':'#1a1a25', color:covers===n?'white':'#6b7280' }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Filtro corso nello scontrino */}
            {cart.length>0 && (
              <div style={{ padding:'6px 14px', borderBottom:'1px solid #1a1a2e', display:'flex', gap:'4px', flexShrink:0 }}>
                {(['all',1,2,3,4] as const).map(c=>{
                  const count = c==='all'?cart.length:cartByCourse(c as Course).length
                  if (c!=='all' && count===0) return null
                  const cc = c==='all'?{label:'Tutti',color:'#94a3b8'}:COURSES[c as Course]
                  return (
                    <button key={c} onClick={()=>setCourseView(c as any)} style={{ padding:'4px 10px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'700',
                      background:courseView===c?cc.color:'#1a1a25', color:courseView===c?'black':'#6b7280' }}>
                      {c==='all'?'Tutti':cc.label} ({count})
                    </button>
                  )
                })}
              </div>
            )}

            {/* Lista items carrello */}
            <div style={{ flex:1, overflowY:'auto', padding:'8px 12px' }}>
              {cart.length===0 ? (
                <div style={{ textAlign:'center', padding:'30px 0', color:'#1f2030' }}>
                  <div style={{ fontSize:'32px', marginBottom:'8px' }}>🍽️</div>
                  <div style={{ fontSize:'12px' }}>Clicca un prodotto per aggiungerlo</div>
                </div>
              ) : (
                ([1,2,3,4] as Course[]).map(c=>{
                  const items = cartByCourse(c).filter(()=>courseView==='all'||courseView===c)
                  if (!items.length && courseView!=='all') return null
                  const allItems = cartByCourse(c)
                  if (!allItems.length) return null
                  const cc = COURSES[c]
                  const displayItems = courseView==='all'||courseView===c ? allItems : []
                  if (!displayItems.length) return null
                  return (
                    <div key={c} style={{ marginBottom:'12px' }}>
                      <div style={{ fontSize:'10px', color:cc.color, fontWeight:'800', letterSpacing:'0.07em', padding:'4px 0', borderBottom:`1px solid ${cc.color}20`, marginBottom:'6px' }}>
                        {cc.short} {cc.label.toUpperCase()} ({allItems.reduce((s,i)=>s+i.quantity,0)} art.)
                      </div>
                      {displayItems.map((item,i)=>{
                        const globalIdx = cart.indexOf(item)
                        const cfg = DEPT[item.department]
                        return (
                          <div key={globalIdx} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'9px', padding:'8px 10px', marginBottom:'5px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'3px' }}>
                              <div style={{ fontSize:'13px', fontWeight:'700', color:'#0f172a', flex:1 }}>
                                <span style={{ fontSize:'10px' }}>{cfg.icon}</span> {item.name}
                                {item.seat && <span style={{ fontSize:'10px', color:'#94a3b8', marginLeft:'4px' }}>S{item.seat}</span>}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:'5px', marginLeft:'8px' }}>
                                <button onClick={()=>updateCartQty(globalIdx,-1)} style={{ width:'20px', height:'20px', borderRadius:'50%', background:'#2a2a3a', border:'none', color:'#0f172a', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                                <span style={{ fontSize:'13px', fontWeight:'800', color:'#0f172a', minWidth:'16px', textAlign:'center' }}>{item.quantity}</span>
                                <button onClick={()=>updateCartQty(globalIdx,1)} style={{ width:'20px', height:'20px', borderRadius:'50%', background:'#2a2a3a', border:'none', color:'#0f172a', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                                <span style={{ fontSize:'13px', fontWeight:'800', color:cfg.color, minWidth:'48px', textAlign:'right' }}>€{(item.price*item.quantity).toFixed(2)}</span>
                                <button onClick={()=>removeCartItem(globalIdx)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'14px', padding:'0 2px' }}>✕</button>
                              </div>
                            </div>
                            {item.notes && <div style={{ fontSize:'10px', color:'#f59e0b' }}>📝 {item.notes}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>

            {/* Totale + Invia */}
            <div style={{ borderTop:'1px solid #1a1a2e', padding:'10px 14px', background:'#080810', flexShrink:0 }}>
              {cart.length>0 && (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'11px', color:'#94a3b8' }}>{cartCount} art. · {covers} cop.</span>
                    {/* breakdown per reparto */}
                    <div style={{ display:'flex', gap:'6px' }}>
                      {(['cucina','pizzeria','bar'] as Dept[]).map(d=>{
                        const n = cart.filter(c=>c.department===d).reduce((s,c)=>s+c.quantity,0)
                        if (!n) return null
                        return <span key={d} style={{ fontSize:'10px', color:DEPT[d].color }}>{DEPT[d].icon}{n}</span>
                      })}
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
                    <span style={{ fontSize:'20px', fontWeight:'900', color:'#0f172a' }}>Totale</span>
                    <span style={{ fontSize:'20px', fontWeight:'900', color:'#10b981' }}>€{cartTotal.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div style={{ display:'flex', gap:'6px' }}>
                {cart.length>0 && (
                  <button onClick={()=>setCart([])} style={{ padding:'11px 14px', background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#94a3b8', borderRadius:'10px', cursor:'pointer', fontSize:'13px', fontWeight:'700' }}>🗑️</button>
                )}
                <button onClick={sendOrder} disabled={!selectedTable||cart.length===0||sending}
                  style={{ flex:1, padding:'12px', borderRadius:'10px', border:'none', cursor:selectedTable&&cart.length>0?'pointer':'not-allowed',
                    background:selectedTable&&cart.length>0?'#10b981':'#1a1a25', color:selectedTable&&cart.length>0?'black':'#4b5563',
                    fontSize:'14px', fontWeight:'900', transition:'all 0.15s' }}>
                  {sending?'⏳...':!selectedTable?'Seleziona tavolo':cart.length===0?'Aggiungi prodotti':openOrderId?`➕ Aggiungi all'ordine`:`🚀 INVIA ORDINE`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL PRODOTTO ══════════════════════════════════════════════════ */}
      {productModal && <ProductModal item={productModal} onAdd={addToCart} onClose={()=>setProductModal(null)} />}

      {/* ═══ MODAL EDIT PRODOTTO ═════════════════════════════════════════════ */}
      {editItem && editItemForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }} onClick={()=>setEditItem(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'20px', padding:'24px', width:'100%', maxWidth:'500px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'18px', fontWeight:'800', color:'#0f172a', margin:0 }}>✏️ Modifica prodotto</h2>
              <button onClick={()=>setEditItem(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'20px' }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              {[
                { key:'name',        label:'Nome',        type:'text',   ph:'Nome prodotto' },
                { key:'price',       label:'Prezzo',      type:'number', ph:'0.00' },
                { key:'description', label:'Descrizione', type:'text',   ph:'Descrizione...' },
                { key:'allergens',   label:'Allergeni',   type:'text',   ph:'Glutine, lattosio...' },
                { key:'kitchen_note',label:'Nota KDS',    type:'text',   ph:'Nota per la cucina...' },
              ].map(f=>(
                <div key={f.key} style={{ gridColumn: f.key==='description'||f.key==='kitchen_note'?'1/-1':'auto' }}>
                  <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'4px' }}>{f.label}</div>
                  <input type={f.type} value={(editItemForm as any)[f.key]||''} placeholder={f.ph}
                    onChange={e=>setEditItemForm((p:any)=>({...p,[f.key]:e.target.value}))}
                    style={{ ...IS, width:'100%' }} />
                </div>
              ))}
              <div>
                <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'4px' }}>Reparto</div>
                <select value={editItemForm.department} onChange={e=>setEditItemForm((p:any)=>({...p,department:e.target.value}))} style={{ ...IS, width:'100%' }}>
                  <option value="cucina">👨‍🍳 Cucina</option>
                  <option value="pizzeria">🍕 Pizzeria</option>
                  <option value="bar">🍸 Bar</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:'12px', alignItems:'center', paddingTop:'14px' }}>
                {[{k:'is_vegetarian',l:'🥗 Veg'},{k:'is_vegan',l:'🌱 Vegan'},{k:'is_available',l:'✅ Disponibile'},{k:'is_active',l:'👁️ Attivo'}].map(f=>(
                  <label key={f.k} style={{ display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', fontSize:'12px', color:'#64748b' }}>
                    <input type="checkbox" checked={(editItemForm as any)[f.k]||false} onChange={e=>setEditItemForm((p:any)=>({...p,[f.k]:e.target.checked}))} />
                    {f.l}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px', marginTop:'20px' }}>
              <button onClick={saveEditItem} disabled={savingEdit} style={{ flex:1, padding:'12px', background:'#10b981', color:'black', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'14px', fontWeight:'800' }}>
                {savingEdit?'Salvando...':'✓ Salva modifiche'}
              </button>
              <button onClick={()=>setEditItem(null)} style={{ padding:'12px 20px', background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#94a3b8', borderRadius:'10px', cursor:'pointer', fontSize:'13px' }}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModal && (
        <PaymentModal title={`Chiudi conto — ${paymentModal.suite_name||'Tavolo '+paymentModal.table?.table_number}`} amount={Number(paymentModal.total||0)} onConfirm={handlePayment} onCancel={()=>setPaymentModal(null)} />
      )}
    </div>
  )
}
