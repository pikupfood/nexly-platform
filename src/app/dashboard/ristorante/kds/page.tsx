'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Dept = 'cucina' | 'pizzeria' | 'bar'

const DEPT_CFG: Record<Dept, { label: string; icon: string; color: string; bg: string; accent: string }> = {
  cucina:   { label:'CUCINA',   icon:'👨‍🍳', color:'#f59e0b', bg:'#0f0b00',  accent:'#f59e0b' },
  pizzeria: { label:'PIZZERIA', icon:'🍕',   color:'#ef4444', bg:'#0f0000',  accent:'#ef4444' },
  bar:      { label:'BAR',      icon:'🍸',   color:'#3b82f6', bg:'#000a0f',  accent:'#3b82f6' },
}

export default function KDSPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [activeDept, setActiveDept] = useState<Dept>('cucina')
  const [loading, setLoading] = useState(true)
  const [updatingItem, setUpdatingItem] = useState<string|null>(null)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [newOrderAlert, setNewOrderAlert] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })

    // Real-time subscription
    const sub = supabase.channel('kds-realtime')
      .on('postgres_changes', { event: 'INSERT', schema:'public', table:'restaurant_orders' }, () => {
        load(); setNewOrderAlert(true); setTimeout(()=>setNewOrderAlert(false), 3000)
      })
      .on('postgres_changes', { event: 'UPDATE', schema:'public', table:'order_items' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema:'public', table:'restaurant_orders' }, () => load())
      .subscribe()

    // Auto-refresh ogni 30 secondi
    const interval = setInterval(() => { load(); setLastUpdate(new Date()) }, 30000)
    return () => { supabase.removeChannel(sub); clearInterval(interval) }
  }, [])

  const load = async () => {
    const { data } = await supabase
      .from('restaurant_orders')
      .select('*, table:restaurant_tables(table_number,location), items:order_items(id,quantity,price,notes,name,department,status,fire_status,course,seat,menu_item_id)')
      .in('status', ['open','preparing','ready'])
      .order('created_at', { ascending: true }) // FIFO
    setOrders(data || [])
    setLoading(false)
  }

  const markItemReady = async (itemId: string) => {
    setUpdatingItem(itemId)
    await supabase.rpc('pos_update_item_status', { p_item_id: itemId, p_status: 'ready' })
    setOrders(prev => prev.map(o => ({
      ...o,
      items: (o.items||[]).map((i:any) => i.id === itemId ? {...i, status:'ready'} : i)
    })))
    setUpdatingItem(null)
  }

  const markOrderReady = async (orderId: string) => {
    await supabase.rpc('pos_update_order_status', { p_order_id: orderId, p_status: 'ready' })
    setOrders(prev => prev.map(o => o.id === orderId ? {...o, status:'ready'} : o))
  }

  // KDS: mostra solo ordini con items FIRED (sparati dal POS) per questo reparto
  const deptOrders = orders.filter(o =>
    (o.items||[]).some((i:any) => i.department === activeDept && i.fire_status === 'fired' && i.status !== 'served')
  )

  const cfg = DEPT_CFG[activeDept]

  // Calcola tempo dall'ordine
  const elapsed = (createdAt: string) => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    return mins < 1 ? 'adesso' : `${mins}m fa`
  }

  const isUrgent = (createdAt: string) => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    return activeDept === 'pizzeria' ? mins >= 15 : activeDept === 'cucina' ? mins >= 20 : mins >= 8
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#000', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#94a3b8' }}>Caricamento KDS...</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:cfg.bg, fontFamily:'system-ui,sans-serif', transition:'background 0.3s' }}>
      
      {/* Alert nuovo ordine */}
      {newOrderAlert && (
        <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:100, background:cfg.color, color:'white', padding:'20px 40px', borderRadius:'16px', fontSize:'24px', fontWeight:'900', boxShadow:'0 0 60px '+cfg.color+'80' }}>
          🔔 NUOVO ORDINE!
        </div>
      )}

      {/* Header KDS */}
      <div style={{ padding:'16px 24px', borderBottom:`2px solid ${cfg.color}30`, display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <Link href="/dashboard/ristorante/pos" style={{ color:cfg.color+'80', textDecoration:'none', fontSize:'13px' }}>← POS</Link>
          
          {/* Selettore reparto */}
          <div style={{ display:'flex', gap:'6px' }}>
            {(Object.entries(DEPT_CFG) as [Dept, typeof DEPT_CFG[Dept]][]).map(([dept, dcfg]) => {
              const count = orders.filter(o=>(o.items||[]).some((i:any)=>i.department===dept&&i.status==='pending')).length
              return (
                <button key={dept} onClick={()=>setActiveDept(dept)} style={{
                  padding:'10px 20px', borderRadius:'10px', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'700',
                  background: activeDept===dept ? dcfg.color : 'rgba(255,255,255,0.06)',
                  color: activeDept===dept ? 'black' : dcfg.color,
                  boxShadow: activeDept===dept ? `0 0 20px ${dcfg.color}60` : 'none',
                  transition:'all 0.2s', position:'relative',
                }}>
                  {dcfg.icon} {dcfg.label}
                  {count > 0 && (
                    <span style={{ position:'absolute', top:'-6px', right:'-6px', background:'#ef4444', color:'white', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', fontWeight:'900', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
          <span style={{ fontSize:'24px', fontWeight:'900', color:cfg.color, textShadow:`0 0 20px ${cfg.color}` }}>
            {cfg.icon} {cfg.label}
          </span>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'20px', fontWeight:'900', color:'white' }}>{deptOrders.length} ordini</div>
            <div style={{ fontSize:'10px', color:'#94a3b8' }}>aggiorn. {lastUpdate.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
        </div>
      </div>

      {/* Grid ordini */}
      <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'14px' }}>
        {deptOrders.length === 0 ? (
          <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:'80px 0' }}>
            <div style={{ fontSize:'60px', marginBottom:'16px', opacity:0.4 }}>✅</div>
            <div style={{ fontSize:'20px', fontWeight:'700', color:cfg.color+'60' }}>Nessun ordine in attesa per {cfg.label}</div>
          </div>
        ) : deptOrders.map(order => {
          const deptItems = (order.items||[]).filter((i:any) => i.department === activeDept)
          const otherItems = (order.items||[]).filter((i:any) => i.department !== activeDept)
          const pendingItems = deptItems.filter((i:any) => i.status === 'pending')
          const readyItems = deptItems.filter((i:any) => i.status === 'ready')
          const urgent = isUrgent(order.created_at)

          return (
            <div key={order.id} style={{
              background: urgent ? `${cfg.color}12` : 'rgba(255,255,255,0.04)',
              border: `2px solid ${urgent ? cfg.color : cfg.color+'30'}`,
              borderRadius:'16px', overflow:'hidden',
              boxShadow: urgent ? `0 0 30px ${cfg.color}30` : 'none',
              animation: urgent ? 'pulse 2s infinite' : 'none',
            }}>
              
              {/* Header ordine */}
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${cfg.color}20`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  {/* Numero tavolo IN GRANDE */}
                  <div style={{ fontSize:'32px', fontWeight:'900', color:'white', lineHeight:1 }}>
                    {order.suite_name || `T.${order.table?.table_number}`}
                  </div>
                  <div style={{ fontSize:'12px', color:cfg.color, fontWeight:'700' }}>
                    {order.order_number}
                    {order.customer_name && ` · ${order.customer_name}`}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'16px', fontWeight:'900', color: urgent ? '#ef4444' : cfg.color }}>
                    {elapsed(order.created_at)}
                  </div>
                  {urgent && <div style={{ fontSize:'10px', color:'#ef4444', fontWeight:'700' }}>⚠️ URGENTE</div>}
                </div>
              </div>

              {/* Items del REPARTO CORRENTE — IN GRANDE */}
              <div style={{ padding:'14px 18px' }}>
                <div style={{ marginBottom:'10px' }}>
                  {pendingItems.map((item:any) => (
                    <div key={item.id} style={{ marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', background:`${cfg.color}10`, border:`1px solid ${cfg.color}30`, borderRadius:'10px', padding:'10px 14px' }}>
                      <div style={{ flex:1 }}>
                        {/* Nome prodotto IN GRANDE */}
                        <div style={{ fontSize:'22px', fontWeight:'900', color:cfg.color, lineHeight:1.1 }}>
                          {item.quantity > 1 && <span style={{ background:cfg.color, color:'black', padding:'1px 6px', borderRadius:'4px', marginRight:'6px', fontSize:'18px' }}>{item.quantity}×</span>}
                          {item.name}
                        </div>
                        {item.notes && (
                          <div style={{ fontSize:'13px', color:'#f59e0b', marginTop:'4px', fontWeight:'600' }}>
                            📝 {item.notes}
                          </div>
                        )}
                      </div>
                      <button onClick={()=>markItemReady(item.id)} disabled={updatingItem===item.id}
                        style={{ padding:'8px 14px', background:cfg.color, color:'black', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'800', marginLeft:'10px', flexShrink:0 }}>
                        {updatingItem===item.id ? '...' : '✓ PRONTO'}
                      </button>
                    </div>
                  ))}
                  {readyItems.map((item:any) => (
                    <div key={item.id} style={{ marginBottom:'4px', padding:'8px 12px', background:'#10b98110', border:'1px solid #10b98130', borderRadius:'8px', display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'16px', fontWeight:'700', color:'#10b981', textDecoration:'line-through' }}>
                        {item.quantity}× {item.name}
                      </span>
                      <span style={{ fontSize:'11px', color:'#10b981', fontWeight:'700' }}>✓ PRONTO</span>
                    </div>
                  ))}
                </div>

                {/* Altri reparti IN PICCOLO (contesto) */}
                {otherItems.length > 0 && (
                  <div style={{ borderTop:`1px dashed ${cfg.color}20`, paddingTop:'8px' }}>
                    <div style={{ fontSize:'10px', color:'#94a3b8', marginBottom:'4px' }}>Anche nell'ordine:</div>
                    {otherItems.map((item:any, i:number) => {
                      const oCfg = DEPT_CFG[item.department as Dept]
                      return (
                        <div key={i} style={{ fontSize:'12px', color:'#94a3b8', display:'flex', gap:'4px', alignItems:'center' }}>
                          <span style={{ fontSize:'10px' }}>{oCfg?.icon}</span>
                          <span>{item.quantity}× {item.name}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Bottone tutto pronto */}
                {pendingItems.length === 0 && order.status !== 'ready' && (
                  <button onClick={()=>markOrderReady(order.id)} style={{ width:'100%', marginTop:'8px', padding:'10px', background:'#10b981', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'14px', fontWeight:'800' }}>
                    ✅ TUTTO PRONTO — INVIA IN SALA
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px ${cfg.color}30; }
          50% { box-shadow: 0 0 40px ${cfg.color}70; }
        }
      `}</style>
    </div>
  )
}
