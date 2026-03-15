// @nexly-1773582529
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

const CAT_CFG: Record<string,{icon:string;label:string}> = {
  food:        { icon:'🥘', label:'Alimentation' },
  beverage:    { icon:'🍷', label:'Boissons' },
  cleaning:    { icon:'🧹', label:'Nettoyage' },
  linen:       { icon:'🛏️', label:'Linge' },
  maintenance: { icon:'🔧', label:'Maintenance' },
  tech:        { icon:'💻', label:'Technologie' },
  other:       { icon:'📦', label:'Autre' },
}

export default function FornitoriPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'suppliers'|'orders'>('suppliers')
  const [showForm, setShowForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [form, setForm] = useState({ name:'', contact_name:'', email:'', phone:'', address:'', category:'food', payment_terms:30, notes:'' })
  const [orderForm, setOrderForm] = useState({ supplier_id:'', items:'', expected_at:'', notes:'' })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(tn); setTenantId(tn?.id||null)
      load()
    })
  }, [])

  const load = async () => {
    const [supRes, ordRes] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('purchase_orders').select('*, supplier:suppliers(name)').order('created_at', { ascending:false }).limit(20),
    ])
    setSuppliers(supRes.data||[])
    setOrders(ordRes.data||[])
    setLoading(false)
  }

  const saveSup = async () => {
    if (!form.name||!tenantId) return
    setSaving(true)
    const { data, error } = await supabase.from('suppliers').insert([{ ...form, tenant_id:tenantId, payment_terms:Number(form.payment_terms) }]).select().single()
    if (!error&&data) { setSuppliers(p=>[...p,data]); setShowForm(false); setForm({ name:'', contact_name:'', email:'', phone:'', address:'', category:'food', payment_terms:30, notes:'' }) }
    else if (error) alert(error.message)
    setSaving(false)
  }

  const saveOrder = async () => {
    if (!orderForm.supplier_id||!tenantId) return
    setSaving(true)
    let itemsArr: any[] = []
    try { itemsArr = orderForm.items ? JSON.parse(orderForm.items) : [] } catch { itemsArr = [] }
    const po_number = 'PO-' + Date.now().toString().slice(-6)
    const { data, error } = await supabase.from('purchase_orders').insert([{
      tenant_id:tenantId, supplier_id:orderForm.supplier_id, po_number,
      items: itemsArr, expected_at:orderForm.expected_at||null, notes:orderForm.notes, status:'draft'
    }]).select('*, supplier:suppliers(name)').single()
    if (!error&&data) { setOrders(p=>[data,...p]); setShowOrderForm(false) }
    else if (error) alert(error.message)
    setSaving(false)
  }

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from('purchase_orders').update({ status }).eq('id', id)
    setOrders(p=>p.map(o=>o.id===id?{...o,status}:o))
  }

  const IS: any = { padding:'8px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }
  const ST_COLOR: Record<string,string> = { draft:'#94a3b8', sent:'#3b82f6', confirmed:'#f59e0b', received:'#10b981', cancelled:'#ef4444' }
  const ST_LABEL: Record<string,string> = { draft:'Brouillon', sent:'Envoyé', confirmed:'Confirmé', received:'Reçu', cancelled:'Annulé' }

  const actions = (
    <div style={{ display:'flex', gap:'6px' }}>
      {tab==='suppliers' && <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'7px 14px', background:'#78716c', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>+ Fournisseur</button>}
      {tab==='orders' && <button onClick={()=>setShowOrderForm(v=>!v)} style={{ padding:'7px 14px', background:'#78716c', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>+ Bon de commande</button>}
    </div>
  )

  return (
    <AppShell title={t('suppliers')} subtitle={`${suppliers.length} fournisseurs`} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'16px 20px' }}>
        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'16px', background:'#f1f5f9', borderRadius:'10px', padding:'3px', width:'fit-content' }}>
          {[{k:'suppliers',l:'Fournisseurs'},{k:'orders',l:'Bons de commande'}].map(tb=>(
            <button key={tb.k} onClick={()=>setTab(tb.k as any)} style={{ padding:'6px 16px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600', background:tab===tb.k?'white':'transparent', color:tab===tb.k?'#0f172a':'#64748b', boxShadow:tab===tb.k?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>
              {tb.l}
            </button>
          ))}
        </div>

        {/* Form fournisseur */}
        {showForm && tab==='suppliers' && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>Nouveau fournisseur</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'10px', marginBottom:'10px' }}>
              {[{k:'name',l:'Nom *',p:'Grossiste Fruits'},{k:'contact_name',l:'Contact',p:'Pierre Martin'},{k:'email',l:'Email',p:'contact@fournisseur.fr'},{k:'phone',l:'Téléphone',p:'+33...'},{k:'address',l:'Adresse',p:'10 rue...'},{k:'notes',l:'Notes',p:'...'}].map(f=>(
                <div key={f.k}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>{f.l}</div>
                  <input style={{ ...IS, width:'100%' }} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} />
                </div>
              ))}
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Catégorie</div>
                <select style={{ ...IS, width:'100%' }} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                  {Object.entries(CAT_CFG).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Délai paiement (jours)</div>
                <input type="number" style={{ ...IS, width:'100%' }} value={form.payment_terms} onChange={e=>setForm(p=>({...p,payment_terms:Number(e.target.value)}))} />
              </div>
            </div>
            <button onClick={saveSup} disabled={!form.name||saving} style={{ padding:'8px 18px', background:form.name?'#78716c':'#94a3b8', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
              {saving?'...':'✓ Enregistrer'}
            </button>
          </div>
        )}

        {/* Form order */}
        {showOrderForm && tab==='orders' && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>Nouveau bon de commande</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'10px', marginBottom:'10px' }}>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Fournisseur *</div>
                <select style={{ ...IS, width:'100%' }} value={orderForm.supplier_id} onChange={e=>setOrderForm(p=>({...p,supplier_id:e.target.value}))}>
                  <option value="">Sélectionner...</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Date livraison</div>
                <input type="date" style={{ ...IS, width:'100%' }} value={orderForm.expected_at} onChange={e=>setOrderForm(p=>({...p,expected_at:e.target.value}))} />
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Articles (JSON ou liste libre)</div>
                <textarea style={{ ...IS, width:'100%', height:'70px', resize:'none' }} value={orderForm.items} onChange={e=>setOrderForm(p=>({...p,items:e.target.value}))} placeholder='Ex: Farine 50kg, Huile d\'olive 10L...' />
              </div>
            </div>
            <button onClick={saveOrder} disabled={!orderForm.supplier_id||saving} style={{ padding:'8px 18px', background:orderForm.supplier_id?'#78716c':'#94a3b8', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
              {saving?'...':'✓ Créer le bon'}
            </button>
          </div>
        )}

        {/* Lista fornitori */}
        {tab==='suppliers' && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Fournisseur','Catégorie','Contact','Email','Paiement','Actions'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'#94a3b8', fontWeight:'600', letterSpacing:'0.03em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.length===0?(
                  <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>
                    Aucun fournisseur. <button onClick={()=>setShowForm(true)} style={{ background:'none', border:'none', color:'#78716c', cursor:'pointer' }}>Ajouter →</button>
                  </td></tr>
                ):suppliers.map((s,i)=>{
                  const cat = CAT_CFG[s.category]||CAT_CFG.other
                  return (
                    <tr key={s.id} style={{ borderBottom:i<suppliers.length-1?'1px solid #f1f5f9':'none' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fafbff'}
                      onMouseLeave={e=>e.currentTarget.style.background='white'}>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>{s.name}</div>
                        {s.address&&<div style={{ fontSize:'11px', color:'#94a3b8' }}>{s.address}</div>}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'13px' }}>{cat.icon} {cat.label}</td>
                      <td style={{ padding:'10px 14px', fontSize:'12px', color:'#64748b' }}>{s.contact_name||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:'12px', color:'#64748b' }}>{s.email||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:'12px', color:'#0f172a' }}>{s.payment_terms}j</td>
                      <td style={{ padding:'10px 14px' }}>
                        <button onClick={()=>{ setOrderForm(p=>({...p,supplier_id:s.id})); setTab('orders'); setShowOrderForm(true) }}
                          style={{ padding:'4px 10px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontWeight:'600' }}>
                          + Commande
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Lista ordini */}
        {tab==='orders' && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['N° BC','Fournisseur','Statut','Livraison','Actions'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'#94a3b8', fontWeight:'600', letterSpacing:'0.03em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length===0?(
                  <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>Aucun bon de commande.</td></tr>
                ):orders.map((o,i)=>{
                  const sc = ST_COLOR[o.status]||'#94a3b8'
                  return (
                    <tr key={o.id} style={{ borderBottom:i<orders.length-1?'1px solid #f1f5f9':'none' }}>
                      <td style={{ padding:'10px 14px', fontSize:'12px', fontFamily:'monospace', color:'#64748b' }}>{o.po_number}</td>
                      <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>{o.supplier?.name||'—'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <select value={o.status} onChange={e=>updateOrderStatus(o.id,e.target.value)}
                          style={{ padding:'3px 8px', background:`${sc}15`, border:`1px solid ${sc}30`, borderRadius:'6px', color:sc, fontSize:'11px', fontWeight:'600', cursor:'pointer', outline:'none' }}>
                          {Object.entries(ST_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'12px', color:'#64748b' }}>{o.expected_at||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:'12px', color:'#64748b' }}>{o.notes||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
