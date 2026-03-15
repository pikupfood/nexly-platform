'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'

const IS: any = { width:'100%', padding:'9px 12px', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }
const LS: any = { display:'block', fontSize:'12px', color:'#64748b', marginBottom:'5px' }
const BTN = (c='#3b82f6'): any => ({ padding:'7px 14px', background:c, border:'none', borderRadius:'7px', color:'white', fontSize:'12px', fontWeight:500, cursor:'pointer' })
const CARD: any = { background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'20px' }
const ROW: any = { display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', background:'white', borderRadius:'8px', border:'1px solid #e2e8f0' }

const LOCATIONS = ['sala','terrazza','privato','bar','esterno','altro']
const LOC_LABELS: any = { sala:'Salle', terrazza:'Terrasse', privato:'Privé', bar:'Bar', esterno:'Extérieur', altro:'Autre' }

export default function TavoliPage() {
  const router = useRouter()
  const [tables, setTables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ table_number:1, capacity:4, location:'sala', notes:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{session} }) => {
      if (!session) { router.replace('/'); return }
      supabase.from('restaurant_tables').select('*').order('table_number').then(({ data }) => {
        setTables(data||[]); setLoading(false)
      })
    })
  }, [])

  const openEdit = (t?:any) => {
    setEditItem(t||null)
    setForm(t ? { table_number:t.table_number, capacity:t.capacity||4, location:t.location||'sala', notes:t.notes||'' } : { table_number:(tables.length ? Math.max(...tables.map(x=>x.table_number))+1 : 1), capacity:4, location:'sala', notes:'' })
    setShowForm(true)
  }

  const save = async () => {
    setSaving(true)
    const tenantId = await getTenantId()
    if (editItem) {
      const { error } = await supabase.rpc('update_restaurant_table', { p_id:editItem.id, p_table_number:String(form.table_number), p_capacity:form.capacity, p_location:form.location||'sala', p_notes:form.notes||'' })
      if (error) { alert('Erreur: '+error.message); setSaving(false); return }
      setTables(p=>p.map(x=>x.id===editItem.id ? {...x,...form} : x))
    } else {
      const { data, error } = await supabase.rpc('insert_restaurant_table', { p_table_number:String(form.table_number), p_capacity:form.capacity, p_location:form.location||'sala', p_notes:form.notes||'' })
      if (error) { alert('Erreur: '+error.message); setSaving(false); return }
      if (data) setTables(p=>[...p,data])
    }
    setShowForm(false); setSaving(false)
  }

  const deleteTable = async (id:string) => {
    if (!confirm('Supprimer cette table ?')) return
    const { error } = await supabase.rpc('delete_restaurant_table', { p_id: id })
    if (error) { alert('Erreur: '+error.message); return }
    setTables(p=>p.filter(x=>x.id!==id))
  }

  const toggleTable = async (t:any) => {
    const s = t.status==='free' ? 'reserved' : 'free'
    const { error } = await supabase.rpc('toggle_table_status', { p_id:t.id, p_status:s })
    if (error) { alert('Erreur: '+error.message); return }
    setTables(p=>p.map(x=>x.id===t.id ? {...x,status:s} : x))
  }

  if (loading) return <div style={{minHeight:'100vh',background:'white',display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8'}}>Chargement...</div>

  const STATUS_COLORS: any = { free:'#059669', occupied:'#ef4444', reserved:'#f59e0b', cleaning:'#3b82f6' }
  const STATUS_LABELS: any = { free:'Libre', occupied:'Occupée', reserved:'Réservée', cleaning:'Nettoyage' }

  return (
    <div style={{minHeight:'100vh',background:'white',fontFamily:'system-ui,sans-serif',color:'#0f172a'}}>
      <div style={{borderBottom:'1px solid #e2e8f0',padding:'14px 28px',display:'flex',alignItems:'center',gap:'12px'}}>
        <Link href="/dashboard/ristorante" style={{color:'#94a3b8',textDecoration:'none',fontSize:'13px'}}>← Restaurant</Link>
        <span style={{color:'#374151'}}>|</span>
        <span style={{fontWeight:600}}>🍽️ Gestion des Tables</span>
      </div>

      <div style={{maxWidth:'760px',margin:'0 auto',padding:'24px 20px 80px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <div>
            <span style={{color:'#64748b',fontSize:'13px'}}>{tables.length} table(s)</span>
            <span style={{marginLeft:'16px',fontSize:'12px',color:'#94a3b8'}}>
              🟢 {tables.filter(t=>t.status==='free').length} libre · 🔴 {tables.filter(t=>t.status==='occupied').length} occupée · 🟡 {tables.filter(t=>t.status==='reserved').length} réservée
            </span>
          </div>
          <button onClick={()=>openEdit()} style={BTN('#10b981')}>+ Ajouter une table</button>
        </div>

        {showForm && (
          <div style={{...CARD,marginBottom:'14px',borderColor:'#10b981'}}>
            <div style={{fontWeight:600,marginBottom:'12px',fontSize:'14px'}}>{editItem?'✏️ Modifier':'➕ Ajouter'} une table</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div><label style={LS}>Numéro de table *</label><input style={IS} type="number" min="1" value={form.table_number} onChange={e=>setForm(p=>({...p,table_number:parseInt(e.target.value)||1}))} /></div>
              <div><label style={LS}>Capacité (pers.)</label><input style={IS} type="number" min="1" max="30" value={form.capacity} onChange={e=>setForm(p=>({...p,capacity:parseInt(e.target.value)||1}))} /></div>
              <div><label style={LS}>Emplacement</label>
                <select style={IS} value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}>
                  {LOCATIONS.map(l=><option key={l} value={l}>{LOC_LABELS[l]}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:'14px'}}><label style={LS}>Notes</label><input style={IS} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Vue sur mer, coin romantique..." /></div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={save} disabled={saving} style={BTN(saving?'#374151':'#10b981')}>{saving?'Sauvegarde...':'✓ Sauvegarder'}</button>
              <button onClick={()=>setShowForm(false)} style={BTN('#374151')}>Annuler</button>
            </div>
          </div>
        )}

        {/* Grid visuale delle tavoli */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'10px',marginBottom:'24px'}}>
          {tables.map(t=>(
            <div key={t.id} style={{background:'white',border:`2px solid ${STATUS_COLORS[t.status]||'#1f2030'}`,borderRadius:'12px',padding:'14px',cursor:'pointer'}}
              onClick={()=>openEdit(t)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                <div style={{fontFamily:'monospace',fontWeight:700,fontSize:'22px',color:'#0f172a'}}>T{t.table_number}</div>
                <span style={{fontSize:'10px',background:STATUS_COLORS[t.status],color:'white',padding:'2px 6px',borderRadius:'8px'}}>{STATUS_LABELS[t.status]||t.status}</span>
              </div>
              <div style={{fontSize:'12px',color:'#64748b'}}>👥 {t.capacity} pers.</div>
              <div style={{fontSize:'12px',color:'#94a3b8'}}>{LOC_LABELS[t.location]||t.location}</div>
              {t.notes && <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'4px'}}>{t.notes}</div>}
              <div style={{marginTop:'10px',display:'flex',gap:'4px'}}>
                <button onClick={e=>{e.stopPropagation();deleteTable(t.id)}} style={{...BTN('#7f1d1d'),padding:'4px 8px',fontSize:'10px'}}>🗑️</button>
              </div>
            </div>
          ))}
          {tables.length===0 && <div style={{textAlign:'center',color:'#94a3b8',padding:'20px 24px',background:'white',borderRadius:'12px',gridColumn:'1 / -1'}}>Aucune table. Ajoutez vos tables !</div>}
        </div>

        {/* Lista compatta */}
        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
          {tables.map(t=>(
            <div key={t.id} style={{...ROW}}>
              <div style={{width:'32px',height:'32px',borderRadius:'8px',background:STATUS_COLORS[t.status],display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'13px',flexShrink:0}}>T{t.table_number}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:500,fontSize:'13px'}}>{LOC_LABELS[t.location]||t.location} · {t.capacity} pers.{t.notes?` · ${t.notes}`:''}</div>
                <div style={{fontSize:'11px',color:STATUS_COLORS[t.status]}}>{STATUS_LABELS[t.status]||t.status}</div>
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                <button onClick={()=>toggleTable(t)} style={{...BTN('#374151'),padding:'5px 9px',fontSize:'11px'}}>{t.status==='free'?'→ Réserver':'→ Libérer'}</button>
                <button onClick={()=>openEdit(t)} style={{...BTN('#1f2030'),padding:'5px 9px',fontSize:'11px'}}>✏️</button>
                <button onClick={()=>deleteTable(t.id)} style={{...BTN('#7f1d1d'),padding:'5px 9px',fontSize:'11px'}}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
