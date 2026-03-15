'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

const CAT_ICON: Record<string,string> = { food:'🥘', beverage:'🍷', cleaning:'🧹', linen:'🛏️', equipment:'⚙️', other:'📦' }

export default function StockPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', category:'food', unit:'pcs', quantity:0, min_quantity:0, cost_per_unit:0, location:'', notes:'' })
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
      const { data } = await supabase.from('stock_items').select('*').order('name')
      setItems(data||[]); setLoading(false)
    })
  }, [])

  const save = async () => {
    if (!form.name||!tenantId) return
    setSaving(true)
    const { data, error } = await supabase.from('stock_items').insert([{ ...form, tenant_id:tenantId, quantity:Number(form.quantity), min_quantity:Number(form.min_quantity), cost_per_unit:Number(form.cost_per_unit) }]).select().single()
    if (!error&&data) { setItems(prev=>[...prev,data]); setShowForm(false); setForm({ name:'', category:'food', unit:'pcs', quantity:0, min_quantity:0, cost_per_unit:0, location:'', notes:'' }) }
    setSaving(false)
  }

  const updateQty = async (id: string, delta: number) => {
    const item = items.find(i=>i.id===id)
    if (!item) return
    const newQty = Math.max(0, Number(item.quantity)+delta)
    await supabase.from('stock_items').update({ quantity:newQty, updated_at:new Date().toISOString() }).eq('id', id)
    // Log movimento
    await supabase.from('stock_movements').insert([{ tenant_id:tenantId, item_id:id, type:delta>0?'in':'out', quantity:Math.abs(delta), reason:'Ajustement manuel' }])
    setItems(prev=>prev.map(i=>i.id===id?{...i,quantity:newQty}:i))
  }

  const lowStock = items.filter(i=>Number(i.quantity)<=Number(i.min_quantity)&&Number(i.min_quantity)>0)
  const IS: any = { padding:'7px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'12px', outline:'none', boxSizing:'border-box' }

  const actions = (
    <div style={{ display:'flex', gap:'6px' }}>
      {lowStock.length>0&&<span style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'7px', padding:'5px 10px', fontSize:'11px', fontWeight:'700' }}>⚠️ {lowStock.length} en rupture</span>}
      <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'7px 14px', background:'#059669', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>+ Article</button>
    </div>
  )

  return (
    <AppShell title="Gestion du Stock" subtitle={`${items.length} articles`} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'16px 20px' }}>
        {showForm&&(
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>Nouvel article</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'10px', marginBottom:'12px' }}>
              {[{k:'name',l:'Nom *',p:'Farine 00'},{k:'location',l:'Emplacement',p:'Cuisine frigo A'},{k:'notes',l:'Notes',p:'...'}].map(f=>(
                <div key={f.k}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>{f.l}</div>
                  <input style={{ ...IS, width:'100%' }} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} />
                </div>
              ))}
              {[{k:'category',l:'Catégorie',opts:Object.keys(CAT_ICON)},{k:'unit',l:'Unité',opts:['pcs','kg','l','box','bottle','roll','other']}].map(f=>(
                <div key={f.k}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>{f.l}</div>
                  <select style={{ ...IS, width:'100%' }} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}>
                    {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              {[{k:'quantity',l:'Quantité'},{k:'min_quantity',l:'Seuil réappro'},{k:'cost_per_unit',l:'Coût/unité €'}].map(f=>(
                <div key={f.k}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>{f.l}</div>
                  <input type="number" style={{ ...IS, width:'100%' }} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} />
                </div>
              ))}
            </div>
            <button onClick={save} disabled={!form.name||saving} style={{ padding:'8px 18px', background:form.name?'#059669':'#94a3b8', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
              {saving?'...':'✓ Enregistrer'}
            </button>
          </div>
        )}

        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                {['Article','Catégorie','Qté','Seuil','Valeur stock','Lieu','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'#94a3b8', fontWeight:'600', letterSpacing:'0.03em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length===0?(
                <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>Aucun article.</td></tr>
              ):items.map((item,i)=>{
                const low = Number(item.quantity)<=Number(item.min_quantity)&&Number(item.min_quantity)>0
                return (
                  <tr key={item.id} style={{ borderBottom:i<items.length-1?'1px solid #f1f5f9':'none', background:low?'#fff7f7':'white' }}>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>{item.name}</div>
                      {item.notes&&<div style={{ fontSize:'11px', color:'#94a3b8' }}>{item.notes}</div>}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:'13px' }}>{CAT_ICON[item.category]} {item.category}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:'16px', fontWeight:'700', color:low?'#dc2626':'#0f172a' }}>{Number(item.quantity).toFixed(1)}</span>
                      <span style={{ fontSize:'11px', color:'#94a3b8', marginLeft:'3px' }}>{item.unit}</span>
                      {low&&<span style={{ marginLeft:'4px', fontSize:'10px', color:'#dc2626', fontWeight:'700' }}>↓</span>}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:'12px', color:'#94a3b8' }}>{Number(item.min_quantity)>0?`${Number(item.min_quantity)} ${item.unit}`:'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:'12px', color:'#0f172a', fontWeight:'600' }}>
                      {Number(item.cost_per_unit)>0?`€${(Number(item.cost_per_unit)*Number(item.quantity)).toFixed(2)}`:'—'}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:'11px', color:'#64748b' }}>{item.location||'—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                        <button onClick={()=>updateQty(item.id,-1)} style={{ width:'24px', height:'24px', borderRadius:'6px', background:'#fef2f2', border:'none', color:'#dc2626', cursor:'pointer', fontSize:'14px' }}>−</button>
                        <button onClick={()=>updateQty(item.id,1)} style={{ width:'24px', height:'24px', borderRadius:'6px', background:'#f0fdf4', border:'none', color:'#059669', cursor:'pointer', fontSize:'14px' }}>+</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
