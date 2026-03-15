'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'

const IS: any = { width:'100%', padding:'9px 12px', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }
const LS: any = { display:'block', fontSize:'12px', color:'#64748b', marginBottom:'5px' }
const BTN = (c='#3b82f6'): any => ({ padding:'7px 14px', background:c, border:'none', borderRadius:'7px', color:'white', fontSize:'12px', fontWeight:500, cursor:'pointer' })
const CARD: any = { background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'18px' }
const ROW: any = { display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'white', borderRadius:'8px', border:'1px solid #e2e8f0' }

export default function MenuPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [tab, setTab] = useState<'categories'|'items'>('categories')
  const [loading, setLoading] = useState(true)
  const [showCatForm, setShowCatForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editCat, setEditCat] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [catForm, setCatForm] = useState({ name:'', description:'', sort_order:0 })
  const [itemForm, setItemForm] = useState({ name:'', description:'', price:'', category_id:'', allergens:'' })
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{session} }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const [cats, its] = await Promise.all([
      supabase.from('menu_categories').select('id,name,description,is_active,sort_order,department,tenant_id').order('sort_order').order('name'),
      supabase.from('menu_items').select('*').order('sort_order').order('name'),
    ])
    setCategories(cats.data || [])
    setItems(its.data || [])
    setLoading(false)
  }

  const openCatEdit = (c?: any) => {
    setEditCat(c||null)
    setCatForm(c ? { name:c.name, description:c.description||'', sort_order:c.sort_order||0 } : { name:'', description:'', sort_order:0 })
    setShowCatForm(true); setShowItemForm(false)
  }

  const saveCat = async () => {
    setSaving(true)
    const tenantId = await getTenantId()
    if (editCat) {
      const { error } = await supabase.rpc('update_menu_category', { p_id:editCat.id, p_name:catForm.name, p_description:catForm.description||'', p_sort_order:catForm.sort_order||0 })
      if (error) { alert('Erreur: '+error.message); setSaving(false); return }
      setCategories(p => p.map(c => c.id===editCat.id ? {...c,...catForm} : c))
    } else {
      const { data, error } = await supabase.rpc('insert_menu_category', { p_name:catForm.name, p_description:catForm.description||'', p_sort_order:catForm.sort_order||0 })
      if (error) { alert('Erreur: '+error.message); setSaving(false); return }
      if (data) setCategories(p => [...p, data].sort((a,b)=>a.sort_order-b.sort_order))
    }
    setShowCatForm(false); setSaving(false)
  }

  const deleteCat = async (id:string) => {
    if (!confirm('Supprimer cette catégorie et tous ses plats ?')) return
    const { error } = await supabase.rpc('delete_menu_category', { p_id: id })
    if (error) { alert('Erreur: '+error.message); return }
    setCategories(p => p.filter(c=>c.id!==id)); setItems(p=>p.filter(i=>i.category_id!==id))
  }

  const toggleCat = async (c:any) => {
    const { data: newValCat, error: tErr } = await supabase.rpc('toggle_menu_category_active', { p_id:c.id })
    if (tErr) { alert('Erreur: '+tErr.message); return }
    setCategories(p => p.map(x=>x.id===c.id ? {...x,is_active:!x.is_active} : x))
  }

  const openItemEdit = (i?: any) => {
    setEditItem(i||null)
    setItemForm(i ? { name:i.name, description:i.description||'', price:i.price||'', category_id:i.category_id||'', allergens:i.allergens||'' } : { name:'', description:'', price:'', category_id:'', allergens:'' })
    setShowItemForm(true); setShowCatForm(false)
  }

  const saveItem = async () => {
    setSaving(true)
    const tenantId = await getTenantId()
    const payload = { ...itemForm, price:parseFloat(itemForm.price as string)||0 }
    if (editItem) {
      const { error } = await supabase.rpc('update_menu_item', { p_id:editItem.id, p_name:payload.name, p_description:payload.description||'', p_price:payload.price, p_category_id:payload.category_id||null, p_allergens:payload.allergens||'' })
      if (error) { alert('Erreur: '+error.message); setSaving(false); return }
      setItems(p => p.map(x=>x.id===editItem.id ? {...x,...payload} : x))
    } else {
      const { data, error } = await supabase.rpc('insert_menu_item', { p_name:payload.name, p_description:payload.description||'', p_price:payload.price, p_category_id:payload.category_id||null, p_allergens:payload.allergens||'' })
      if (error) { alert('Erreur: '+error.message); setSaving(false); return }
      if (data) setItems(p => [...p, data])
    }
    setShowItemForm(false); setSaving(false)
  }

  const deleteItem = async (id:string) => {
    if (!confirm('Supprimer ce plat ?')) return
    const { error } = await supabase.rpc('delete_menu_item', { p_id: id })
    if (error) { alert('Erreur: '+error.message); return }
    setItems(p => p.filter(i=>i.id!==id))
  }

  const toggleItem = async (item:any) => {
    const { data: newValItem, error: tErrI } = await supabase.rpc('toggle_menu_item_active', { p_id:item.id })
    if (tErrI) { alert('Erreur: '+tErrI.message); return }
    setItems(p => p.map(x=>x.id===item.id ? {...x,is_active:!x.is_active} : x))
  }

  const visibleItems = filterCat ? items.filter(i=>i.category_id===filterCat) : items

  if (loading) return <div style={{minHeight:'100vh',background:'white',display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8'}}>Chargement...</div>

  return (
    <div style={{minHeight:'100vh',background:'white',fontFamily:'system-ui,sans-serif',color:'#0f172a'}}>
      <div style={{borderBottom:'1px solid #e2e8f0',padding:'14px 28px',display:'flex',alignItems:'center',gap:'12px'}}>
        <Link href="/dashboard/ristorante" style={{color:'#94a3b8',textDecoration:'none',fontSize:'13px'}}>← Restaurant</Link>
        <span style={{color:'#374151'}}>|</span>
        <span style={{fontWeight:600}}>🍽️ Gestion du Menu</span>
      </div>

      <div style={{maxWidth:'860px',margin:'0 auto',padding:'24px 20px 80px'}}>
        <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
          {(['categories','items'] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{padding:'8px 18px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:500,background:tab===t?'#3b82f6':'#1f2030',color:tab===t?'white':'#9ca3af'}}>
              {t==='categories'?'📂 Catégories':'🍴 Plats & Boissons'}
            </button>
          ))}
        </div>

        {/* ─ CATEGORIES ─ */}
        {tab==='categories' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
            <span style={{color:'#64748b',fontSize:'13px'}}>{categories.length} catégorie{categories.length!==1?'s':''}</span>
            <button onClick={()=>openCatEdit()} style={BTN()}>+ Nouvelle catégorie</button>
          </div>

          {showCatForm && (
            <div style={{...CARD,marginBottom:'14px',borderColor:'#3b82f6'}}>
              <div style={{fontWeight:600,marginBottom:'12px',fontSize:'14px'}}>{editCat?'✏️ Modifier':'➕ Nouvelle'} catégorie</div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={LS}>Nom *</label><input style={IS} value={catForm.name} onChange={e=>setCatForm(p=>({...p,name:e.target.value}))} placeholder="Ex: Entrées, Desserts..." /></div>
                <div><label style={LS}>Ordre</label><input style={IS} type="number" value={catForm.sort_order} onChange={e=>setCatForm(p=>({...p,sort_order:parseInt(e.target.value)||0}))} /></div>
              </div>
              <div style={{marginBottom:'12px'}}><label style={LS}>Description (optionnel)</label><input style={IS} value={catForm.description} onChange={e=>setCatForm(p=>({...p,description:e.target.value}))} /></div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={saveCat} disabled={!catForm.name||saving} style={BTN(saving?'#374151':'#3b82f6')}>{saving?'Sauvegarde...':'✓ Sauvegarder'}</button>
                <button onClick={()=>setShowCatForm(false)} style={BTN('#374151')}>Annuler</button>
              </div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {categories.length===0 && <div style={{textAlign:'center',color:'#94a3b8',padding:'20px 24px',background:'white',borderRadius:'12px'}}>Aucune catégorie. Créez votre première catégorie !</div>}
            {categories.map(c => (
              <div key={c.id} style={{...ROW,opacity:c.is_active!==false?1:0.5}}>
                <div style={{fontSize:'18px'}}>📂</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500,fontSize:'14px'}}>{c.name}</div>
                  <div style={{fontSize:'12px',color:'#94a3b8'}}>{c.description||'—'} · {items.filter(i=>i.category_id===c.id).length} plat(s) · ordre #{c.sort_order}</div>
                </div>
                <div style={{display:'flex',gap:'6px'}}>
                  <button onClick={()=>toggleCat(c)} style={{...BTN(c.is_active!==false?'#374151':'#059669'),padding:'5px 10px',fontSize:'11px'}}>{c.is_active!==false?'OFF':'ON'}</button>
                  <button onClick={()=>openCatEdit(c)} style={{...BTN('#1f2030'),padding:'5px 10px',fontSize:'11px'}}>✏️ Edit</button>
                  <button onClick={()=>deleteCat(c.id)} style={{...BTN('#7f1d1d'),padding:'5px 10px',fontSize:'11px'}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* ─ ITEMS ─ */}
        {tab==='items' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px',gap:'10px',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...IS,width:'auto',padding:'6px 10px'}}>
                <option value="">Toutes catégories ({items.length})</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name} ({items.filter(i=>i.category_id===c.id).length})</option>)}
              </select>
            </div>
            <button onClick={()=>openItemEdit()} style={BTN()}>+ Nouveau plat</button>
          </div>

          {showItemForm && (
            <div style={{...CARD,marginBottom:'14px',borderColor:'#3b82f6'}}>
              <div style={{fontWeight:600,marginBottom:'12px',fontSize:'14px'}}>{editItem?'✏️ Modifier':'➕ Nouveau'} plat</div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={LS}>Nom *</label><input style={IS} value={itemForm.name} onChange={e=>setItemForm(p=>({...p,name:e.target.value}))} placeholder="Ex: Salade César" /></div>
                <div><label style={LS}>Prix (€) *</label><input style={IS} type="number" step="0.01" min="0" value={itemForm.price} onChange={e=>setItemForm(p=>({...p,price:e.target.value}))} placeholder="12.50" /></div>
              </div>
              <div style={{marginBottom:'10px'}}><label style={LS}>Catégorie</label>
                <select style={IS} value={itemForm.category_id} onChange={e=>setItemForm(p=>({...p,category_id:e.target.value}))}>
                  <option value="">Sans catégorie</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{marginBottom:'10px'}}><label style={LS}>Description</label><textarea style={{...IS,height:'65px',resize:'vertical'}} value={itemForm.description} onChange={e=>setItemForm(p=>({...p,description:e.target.value}))} /></div>
              <div style={{marginBottom:'14px'}}><label style={LS}>Allergènes (ex: Gluten, Lactose)</label><input style={IS} value={itemForm.allergens} onChange={e=>setItemForm(p=>({...p,allergens:e.target.value}))} placeholder="Gluten, lactose, fruits à coque..." /></div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={saveItem} disabled={!itemForm.name||saving} style={BTN(saving?'#374151':'#3b82f6')}>{saving?'Sauvegarde...':'✓ Sauvegarder'}</button>
                <button onClick={()=>setShowItemForm(false)} style={BTN('#374151')}>Annuler</button>
              </div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {visibleItems.length===0 && <div style={{textAlign:'center',color:'#94a3b8',padding:'20px 24px',background:'white',borderRadius:'12px'}}>Aucun plat trouvé.</div>}
            {visibleItems.map(item => {
              const cat = categories.find(c=>c.id===item.category_id)
              return (
                <div key={item.id} style={{...ROW,opacity:item.is_active!==false?1:0.5}}>
                  <div style={{fontSize:'18px'}}>🍴</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500,fontSize:'14px'}}>{item.name}</div>
                    <div style={{fontSize:'12px',color:'#94a3b8'}}>{cat?.name||'Sans catégorie'}{item.description?` · ${item.description.substring(0,60)}...`:''}</div>
                    {item.allergens && <div style={{fontSize:'11px',color:'#f59e0b'}}>⚠️ {item.allergens}</div>}
                  </div>
                  <div style={{fontFamily:'monospace',fontWeight:700,color:'#10b981',fontSize:'15px',marginRight:'8px'}}>€{parseFloat(item.price||0).toFixed(2)}</div>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={()=>toggleItem(item)} style={{...BTN(item.is_active!==false?'#374151':'#059669'),padding:'5px 9px',fontSize:'11px'}}>{item.is_active!==false?'OFF':'ON'}</button>
                    <button onClick={()=>openItemEdit(item)} style={{...BTN('#1f2030'),padding:'5px 9px',fontSize:'11px'}}>✏️</button>
                    <button onClick={()=>deleteItem(item.id)} style={{...BTN('#7f1d1d'),padding:'5px 9px',fontSize:'11px'}}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>}
      </div>
    </div>
  )
}
