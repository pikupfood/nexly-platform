'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'

const IS: any = { width:'100%', padding:'9px 12px', background:'#0a0a0f', border:'1px solid #2a2a3a', borderRadius:'8px', color:'#f1f1f1', fontSize:'13px', outline:'none', boxSizing:'border-box' }
const LS: any = { display:'block', fontSize:'12px', color:'#9ca3af', marginBottom:'5px' }
const BTN = (c='#3b82f6'): any => ({ padding:'7px 14px', background:c, border:'none', borderRadius:'7px', color:'white', fontSize:'12px', fontWeight:500, cursor:'pointer' })
const CARD: any = { background:'#111118', border:'1px solid #1f2030', borderRadius:'12px', padding:'20px' }

const BED_TYPES = ['simple','double','queen','king','twin','suite']
const EMPTY = { name:'', description:'', base_price:'', max_occupancy:2, size_sqm:'', bed_type:'double', breakfast_included:false, is_active:true }

export default function CamerePage() {
  const router = useRouter()
  const [roomTypes, setRoomTypes] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [tab, setTab] = useState<'types'|'rooms'>('types')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [roomForm, setRoomForm] = useState({ name:'', room_type_id:'', floor:'', notes:'' })
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [editRoom, setEditRoom] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{session} }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const [rt, r] = await Promise.all([
      supabase.from('room_types').select('*').order('name'),
      supabase.from('rooms').select('*').order('name'),
    ])
    setRoomTypes(rt.data || [])
    setRooms(r.data || [])
    setLoading(false)
  }

  const openEdit = (item?: any) => {
    setEditItem(item||null)
    setForm(item ? { name:item.name, description:item.description||'', base_price:item.base_price||'', max_occupancy:item.max_occupancy||2, size_sqm:item.size_sqm||'', bed_type:item.bed_type||'double', breakfast_included:item.breakfast_included||false, is_active:item.is_active!==false } : EMPTY)
    setShowForm(true); setShowRoomForm(false)
  }

  const save = async () => {
    setSaving(true)
    const tenantId = await getTenantId()
    const payload = { ...form, base_price:parseFloat(form.base_price)||0, size_sqm:parseInt(form.size_sqm)||null }
    if (editItem) {
      await supabase.from('room_types').update(payload).eq('id', editItem.id)
      setRoomTypes(p => p.map(x=>x.id===editItem.id ? {...x,...payload} : x))
    } else {
      const { data } = await supabase.from('room_types').insert([{...payload, tenant_id:tenantId}]).select().single()
      if (data) setRoomTypes(p => [...p, data])
    }
    setShowForm(false); setSaving(false)
  }

  const deleteType = async (id:string) => {
    if (!confirm('Supprimer ce type de chambre ? Les chambres associées seront aussi supprimées.')) return
    await supabase.from('rooms').delete().eq('room_type_id', id)
    await supabase.from('room_types').delete().eq('id', id)
    setRoomTypes(p=>p.filter(x=>x.id!==id)); setRooms(p=>p.filter(r=>r.room_type_id!==id))
  }

  const toggleType = async (item:any) => {
    await supabase.from('room_types').update({ is_active:!item.is_active }).eq('id', item.id)
    setRoomTypes(p=>p.map(x=>x.id===item.id ? {...x,is_active:!x.is_active} : x))
  }

  const openRoomEdit = (r?:any) => {
    setEditRoom(r||null)
    setRoomForm(r ? { name:r.name, room_type_id:r.room_type_id||'', floor:r.floor||'', notes:r.notes||'' } : { name:'', room_type_id:'', floor:'', notes:'' })
    setShowRoomForm(true); setShowForm(false)
  }

  const saveRoom = async () => {
    setSaving(true)
    const tenantId = await getTenantId()
    if (editRoom) {
      await supabase.from('rooms').update(roomForm).eq('id', editRoom.id)
      setRooms(p=>p.map(x=>x.id===editRoom.id ? {...x,...roomForm} : x))
    } else {
      const { data } = await supabase.from('rooms').insert([{...roomForm, tenant_id:tenantId, status:'free'}]).select().single()
      if (data) setRooms(p=>[...p,data])
    }
    setShowRoomForm(false); setSaving(false)
  }

  const deleteRoom = async (id:string) => {
    if (!confirm('Supprimer cette chambre ?')) return
    await supabase.from('rooms').delete().eq('id', id)
    setRooms(p=>p.filter(r=>r.id!==id))
  }

  const toggleRoom = async (r:any) => {
    const s = r.status === 'free' ? 'maintenance' : 'free'
    await supabase.from('rooms').update({ status:s }).eq('id', r.id)
    setRooms(p=>p.map(x=>x.id===r.id ? {...x,status:s} : x))
  }

  if (loading) return <div style={{minHeight:'100vh',background:'#0a0a0f',display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280'}}>Chargement...</div>

  const ROW: any = { display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', background:'#0a0a0f', borderRadius:'8px', border:'1px solid #1f2030' }

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0f',fontFamily:'system-ui,sans-serif',color:'#f1f1f1'}}>
      <div style={{borderBottom:'1px solid #1f2030',padding:'14px 28px',display:'flex',alignItems:'center',gap:'12px'}}>
        <Link href="/dashboard/hotel" style={{color:'#6b7280',textDecoration:'none',fontSize:'13px'}}>← Hôtel</Link>
        <span style={{color:'#374151'}}>|</span>
        <span style={{fontWeight:600}}>🏨 Gestion des Chambres</span>
      </div>

      <div style={{maxWidth:'860px',margin:'0 auto',padding:'24px 20px 80px'}}>
        <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
          {(['types','rooms'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:'8px 18px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:500,background:tab===t?'#3b82f6':'#1f2030',color:tab===t?'white':'#9ca3af'}}>
              {t==='types'?'🛏️ Types de chambres':'🚪 Chambres individuelles'}
            </button>
          ))}
        </div>

        {/* ─ TYPES ─ */}
        {tab==='types' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
            <span style={{color:'#9ca3af',fontSize:'13px'}}>{roomTypes.length} type(s) de chambre</span>
            <button onClick={()=>openEdit()} style={BTN()}>+ Nouveau type</button>
          </div>

          {showForm && (
            <div style={{...CARD,marginBottom:'14px',borderColor:'#3b82f6'}}>
              <div style={{fontWeight:600,marginBottom:'12px',fontSize:'14px'}}>{editItem?'✏️ Modifier':'➕ Nouveau'} type de chambre</div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={LS}>Nom *</label><input style={IS} value={form.name} onChange={e=>setForm((p:any)=>({...p,name:e.target.value}))} placeholder="Ex: Chambre Deluxe" /></div>
                <div><label style={LS}>Prix / nuit (€) *</label><input style={IS} type="number" step="0.01" value={form.base_price} onChange={e=>setForm((p:any)=>({...p,base_price:e.target.value}))} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={LS}>Capacité (pers.)</label><input style={IS} type="number" min="1" value={form.max_occupancy} onChange={e=>setForm((p:any)=>({...p,max_occupancy:parseInt(e.target.value)||1}))} /></div>
                <div><label style={LS}>Surface (m²)</label><input style={IS} type="number" value={form.size_sqm} onChange={e=>setForm((p:any)=>({...p,size_sqm:e.target.value}))} /></div>
                <div><label style={LS}>Type de lit</label>
                  <select style={IS} value={form.bed_type} onChange={e=>setForm((p:any)=>({...p,bed_type:e.target.value}))}>
                    {BED_TYPES.map(b=><option key={b} value={b}>{b.charAt(0).toUpperCase()+b.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:'10px'}}><label style={LS}>Description</label><textarea style={{...IS,height:'65px',resize:'vertical' as const}} value={form.description} onChange={e=>setForm((p:any)=>({...p,description:e.target.value}))} /></div>
              <div style={{marginBottom:'14px',display:'flex',gap:'16px',alignItems:'center'}}>
                <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontSize:'13px',color:'#9ca3af'}}>
                  <input type="checkbox" checked={form.breakfast_included} onChange={e=>setForm((p:any)=>({...p,breakfast_included:e.target.checked}))} />
                  Petit-déjeuner inclus
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontSize:'13px',color:'#9ca3af'}}>
                  <input type="checkbox" checked={form.is_active} onChange={e=>setForm((p:any)=>({...p,is_active:e.target.checked}))} />
                  Actif (visible en ligne)
                </label>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={save} disabled={!form.name||saving} style={BTN(saving?'#374151':'#3b82f6')}>{saving?'Sauvegarde...':'✓ Sauvegarder'}</button>
                <button onClick={()=>setShowForm(false)} style={BTN('#374151')}>Annuler</button>
              </div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {roomTypes.length===0 && <div style={{textAlign:'center',color:'#6b7280',padding:'32px',background:'#111118',borderRadius:'12px'}}>Aucun type de chambre.</div>}
            {roomTypes.map(rt=>(
              <div key={rt.id} style={{...ROW,opacity:rt.is_active!==false?1:0.5}}>
                <div style={{fontSize:'22px'}}>🛏️</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500,fontSize:'14px'}}>{rt.name} {rt.breakfast_included && <span style={{fontSize:'10px',background:'#059669',color:'white',padding:'1px 6px',borderRadius:'10px',marginLeft:'6px'}}>🍳 Petit-déj</span>}</div>
                  <div style={{fontSize:'12px',color:'#6b7280'}}>{rt.bed_type} · max {rt.max_occupancy} pers.{rt.size_sqm?` · ${rt.size_sqm}m²`:''} · {rooms.filter(r=>r.room_type_id===rt.id).length} chambre(s)</div>
                </div>
                <div style={{fontFamily:'monospace',fontWeight:700,color:'#3b82f6',fontSize:'15px',marginRight:'8px'}}>€{parseFloat(rt.base_price||0).toFixed(0)}/nuit</div>
                <div style={{display:'flex',gap:'6px'}}>
                  <button onClick={()=>toggleType(rt)} style={{...BTN(rt.is_active!==false?'#374151':'#059669'),padding:'5px 9px',fontSize:'11px'}}>{rt.is_active!==false?'OFF':'ON'}</button>
                  <button onClick={()=>openEdit(rt)} style={{...BTN('#1f2030'),padding:'5px 9px',fontSize:'11px'}}>✏️</button>
                  <button onClick={()=>deleteType(rt.id)} style={{...BTN('#7f1d1d'),padding:'5px 9px',fontSize:'11px'}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* ─ ROOMS ─ */}
        {tab==='rooms' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
            <span style={{color:'#9ca3af',fontSize:'13px'}}>{rooms.length} chambre(s) individuelle(s)</span>
            <button onClick={()=>openRoomEdit()} style={BTN()}>+ Ajouter une chambre</button>
          </div>

          {showRoomForm && (
            <div style={{...CARD,marginBottom:'14px',borderColor:'#3b82f6'}}>
              <div style={{fontWeight:600,marginBottom:'12px',fontSize:'14px'}}>{editRoom?'✏️ Modifier':'➕ Ajouter'} une chambre</div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={LS}>Numéro / Nom *</label><input style={IS} value={roomForm.name} onChange={e=>setRoomForm(p=>({...p,name:e.target.value}))} placeholder="Ex: 101, Suite Azur" /></div>
                <div><label style={LS}>Étage</label><input style={IS} value={roomForm.floor} onChange={e=>setRoomForm(p=>({...p,floor:e.target.value}))} placeholder="Ex: 1, RDC" /></div>
                <div><label style={LS}>Type</label>
                  <select style={IS} value={roomForm.room_type_id} onChange={e=>setRoomForm(p=>({...p,room_type_id:e.target.value}))}>
                    <option value="">Aucun type</option>
                    {roomTypes.map(rt=><option key={rt.id} value={rt.id}>{rt.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:'14px'}}><label style={LS}>Notes internes</label><input style={IS} value={roomForm.notes} onChange={e=>setRoomForm(p=>({...p,notes:e.target.value}))} placeholder="Balcon, vue mer..." /></div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={saveRoom} disabled={!roomForm.name||saving} style={BTN(saving?'#374151':'#3b82f6')}>{saving?'Sauvegarde...':'✓ Sauvegarder'}</button>
                <button onClick={()=>setShowRoomForm(false)} style={BTN('#374151')}>Annuler</button>
              </div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {rooms.length===0 && <div style={{textAlign:'center',color:'#6b7280',padding:'32px',background:'#111118',borderRadius:'12px'}}>Aucune chambre. Ajoutez vos chambres individuelles ici.</div>}
            {rooms.map(r=>{
              const rt = roomTypes.find(x=>x.id===r.room_type_id)
              const STATUS_COLOR: any = { free:'#059669', occupied:'#ef4444', maintenance:'#f59e0b', cleaning:'#3b82f6' }
              const STATUS_LABEL: any = { free:'Libre', occupied:'Occupée', maintenance:'Maintenance', cleaning:'Nettoyage' }
              return (
                <div key={r.id} style={ROW}>
                  <div style={{fontSize:'18px'}}>🚪</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500,fontSize:'14px'}}>Chambre {r.name} {r.floor && <span style={{color:'#6b7280',fontSize:'12px'}}>· Étage {r.floor}</span>}</div>
                    <div style={{fontSize:'12px',color:'#6b7280'}}>{rt?.name||'Sans type'}{r.notes?` · ${r.notes}`:''}</div>
                  </div>
                  <span style={{fontSize:'11px',background:STATUS_COLOR[r.status]||'#374151',color:'white',padding:'2px 8px',borderRadius:'10px'}}>{STATUS_LABEL[r.status]||r.status}</span>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={()=>toggleRoom(r)} style={{...BTN('#374151'),padding:'5px 9px',fontSize:'11px'}}>{r.status==='free'?'→ Maintenance':'→ Libre'}</button>
                    <button onClick={()=>openRoomEdit(r)} style={{...BTN('#1f2030'),padding:'5px 9px',fontSize:'11px'}}>✏️</button>
                    <button onClick={()=>deleteRoom(r.id)} style={{...BTN('#7f1d1d'),padding:'5px 9px',fontSize:'11px'}}>🗑️</button>
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
