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

const DAYS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const SURFACES = ['synthetic','glass','cement','other']
const SURFACE_LABELS: any = { synthetic:'Synthétique', glass:'Verre', cement:'Béton', other:'Autre' }

const EMPTY: any = {
  name:'', description:'', price_per_hour:0,
  type:'indoor', surface:'synthetic',
  open_time:'08:00', close_time:'22:00',
  slot_duration:90, days_open:[1,2,3,4,5,6,0],
  is_active:true
}

export default function CampiPage() {
  const router = useRouter()
  const [courts, setCourts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{session} }) => {
      if (!session) { router.replace('/'); return }
      supabase.from('padel_courts').select('*').order('name').then(({ data }) => {
        setCourts(data||[]); setLoading(false)
      })
    })
  }, [])

  const openEdit = (c?:any) => {
    setEditItem(c||null)
    setForm(c ? {
      name:c.name, description:c.description||'',
      price_per_hour:c.price_per_hour||0,
      type:c.type||'indoor', surface:c.surface||'synthetic',
      open_time:c.open_time||'08:00', close_time:c.close_time||'22:00',
      slot_duration:c.slot_duration||90,
      days_open:c.days_open||[1,2,3,4,5,6,0],
      is_active:c.is_active!==false
    } : EMPTY)
    setShowForm(true)
  }

  const toggleDay = (d:number) => {
    setForm((p:any) => ({
      ...p,
      days_open: p.days_open.includes(d) ? p.days_open.filter((x:number)=>x!==d) : [...p.days_open, d]
    }))
  }

  const save = async () => {
    setSaving(true)
    const tenantId = await getTenantId()
    const payload = { ...form, price_per_hour:parseFloat(form.price_per_hour)||0, slot_duration:parseInt(form.slot_duration)||90 }
    if (editItem) {
      const { error } = await supabase.rpc('update_padel_court', { p_id:editItem.id, p_name:payload.name, p_description:payload.description||'', p_price_per_hour:payload.price_per_hour||0, p_type:payload.type||'indoor', p_surface:payload.surface||'synthetic', p_open_time:payload.open_time||'08:00', p_close_time:payload.close_time||'22:00', p_slot_duration:payload.slot_duration||90, p_days_open:payload.days_open||[] })
      if (error) { alert('Erreur: '+error.message); setSaving(false); return }
      setCourts(p=>p.map(x=>x.id===editItem.id ? {...x,...payload} : x))
    } else {
      const { data, error } = await supabase.rpc('insert_padel_court', { p_name:payload.name, p_description:payload.description||'', p_price_per_hour:payload.price_per_hour||0, p_type:payload.type||'indoor', p_surface:payload.surface||'synthetic', p_open_time:payload.open_time||'08:00', p_close_time:payload.close_time||'22:00', p_slot_duration:payload.slot_duration||90, p_days_open:payload.days_open||[] })
      if (error) { alert('Erreur: '+error.message); setSaving(false); return }
      if (data) setCourts(p=>[...p,data])
    }
    setShowForm(false); setSaving(false)
  }

  const deleteItem = async (id:string) => {
    if (!confirm('Supprimer ce terrain ?')) return
    const { error: dErr } = await supabase.rpc('delete_padel_court', { p_id: id })
    if (dErr) { alert('Erreur: '+dErr.message); return }
    setCourts(p=>p.filter(x=>x.id!==id))
  }

  const toggleActive = async (c:any) => {
    const { data: newValP, error: tErrP } = await supabase.rpc('toggle_padel_court_active', { p_id:c.id })
    if (tErrP) { alert('Erreur: '+tErrP.message); return }
    setCourts(p=>p.map(x=>x.id===c.id ? {...x,is_active:!x.is_active} : x))
  }

  if (loading) return <div style={{minHeight:'100vh',background:'white',display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8'}}>Chargement...</div>

  return (
    <div style={{minHeight:'100vh',background:'white',fontFamily:'system-ui,sans-serif',color:'#0f172a'}}>
      <div style={{borderBottom:'1px solid #e2e8f0',padding:'14px 28px',display:'flex',alignItems:'center',gap:'12px'}}>
        <Link href="/dashboard/padel" style={{color:'#94a3b8',textDecoration:'none',fontSize:'13px'}}>← Padel</Link>
        <span style={{color:'#374151'}}>|</span>
        <span style={{fontWeight:600}}>🎾 Gestion des Terrains</span>
      </div>

      <div style={{maxWidth:'860px',margin:'0 auto',padding:'24px 20px 80px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <span style={{color:'#64748b',fontSize:'13px'}}>{courts.length} terrain(s)</span>
          <button onClick={()=>openEdit()} style={BTN()}>+ Nouveau terrain</button>
        </div>

        {showForm && (
          <div style={{...CARD,marginBottom:'16px',borderColor:'#3b82f6'}}>
            <div style={{fontWeight:600,marginBottom:'14px',fontSize:'14px'}}>{editItem?'✏️ Modifier':'➕ Nouveau'} terrain</div>

            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div><label style={LS}>Nom *</label><input style={IS} value={form.name} onChange={e=>setForm((p:any)=>({...p,name:e.target.value}))} placeholder="Ex: Terrain A" /></div>
              <div><label style={LS}>Prix / heure (€)</label><input style={IS} type="number" step="0.5" value={form.price_per_hour} onChange={e=>setForm((p:any)=>({...p,price_per_hour:e.target.value}))} /></div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div><label style={LS}>Type</label>
                <select style={IS} value={form.type} onChange={e=>setForm((p:any)=>({...p,type:e.target.value}))}>
                  <option value="indoor">Couvert</option>
                  <option value="outdoor">Découvert</option>
                </select>
              </div>
              <div><label style={LS}>Surface</label>
                <select style={IS} value={form.surface} onChange={e=>setForm((p:any)=>({...p,surface:e.target.value}))}>
                  {SURFACES.map(s=><option key={s} value={s}>{SURFACE_LABELS[s]}</option>)}
                </select>
              </div>
              <div><label style={LS}>Durée créneau (min)</label>
                <select style={IS} value={form.slot_duration} onChange={e=>setForm((p:any)=>({...p,slot_duration:parseInt(e.target.value)}))}>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                </select>
              </div>
            </div>

            {/* Horaires */}
            <div style={{background:'#0d0d15',borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
              <div style={{fontSize:'12px',fontWeight:600,color:'#64748b',marginBottom:'10px'}}>⏰ HORAIRES D'OUVERTURE</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
                <div><label style={LS}>Ouverture</label><input style={IS} type="time" value={form.open_time} onChange={e=>setForm((p:any)=>({...p,open_time:e.target.value}))} /></div>
                <div><label style={LS}>Fermeture</label><input style={IS} type="time" value={form.close_time} onChange={e=>setForm((p:any)=>({...p,close_time:e.target.value}))} /></div>
              </div>
              <div>
                <label style={LS}>Jours d'ouverture</label>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                  {DAYS.map((d,i)=>(
                    <button key={i} type="button" onClick={()=>toggleDay(i)}
                      style={{padding:'5px 10px',borderRadius:'6px',border:'none',cursor:'pointer',fontSize:'12px',fontWeight:500,
                        background:form.days_open.includes(i)?'#3b82f6':'#1f2030',
                        color:form.days_open.includes(i)?'white':'#9ca3af'}}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{marginBottom:'14px'}}><label style={LS}>Description / Notes</label><textarea style={{...IS,height:'60px',resize:'vertical'}} value={form.description} onChange={e=>setForm((p:any)=>({...p,description:e.target.value}))} /></div>

            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={save} disabled={!form.name||saving} style={BTN(saving?'#374151':'#3b82f6')}>{saving?'Sauvegarde...':'✓ Sauvegarder'}</button>
              <button onClick={()=>setShowForm(false)} style={BTN('#374151')}>Annuler</button>
            </div>
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {courts.length===0 && <div style={{textAlign:'center',color:'#94a3b8',padding:'20px 24px',background:'white',borderRadius:'12px'}}>Aucun terrain. Ajoutez votre premier terrain !</div>}
          {courts.map(c=>{
            const daysStr = (c.days_open||[]).sort().map((d:number)=>DAYS[d]).join(', ')
            return (
              <div key={c.id} style={{...ROW,opacity:c.is_active!==false?1:0.5,flexWrap:'wrap'}}>
                <div style={{fontSize:'22px'}}>🎾</div>
                <div style={{flex:1,minWidth:'200px'}}>
                  <div style={{fontWeight:500,fontSize:'14px'}}>{c.name}
                    <span style={{marginLeft:'8px',fontSize:'11px',background:c.type==='indoor'?'#1e40af':'#065f46',color:'white',padding:'1px 6px',borderRadius:'8px'}}>{c.type==='indoor'?'Couvert':'Découvert'}</span>
                  </div>
                  <div style={{fontSize:'12px',color:'#94a3b8'}}>{SURFACE_LABELS[c.surface]||c.surface} · {c.open_time||'08:00'}–{c.close_time||'22:00'} · créneaux {c.slot_duration||90}min</div>
                  <div style={{fontSize:'11px',color:'#94a3b8'}}>{daysStr}</div>
                </div>
                <div style={{fontFamily:'monospace',fontWeight:700,color:'#f59e0b',fontSize:'15px'}}>€{parseFloat(c.price_per_hour||0).toFixed(0)}/h</div>
                <div style={{display:'flex',gap:'6px'}}>
                  <button onClick={()=>toggleActive(c)} style={{...BTN(c.is_active!==false?'#374151':'#059669'),padding:'5px 9px',fontSize:'11px'}}>{c.is_active!==false?'OFF':'ON'}</button>
                  <button onClick={()=>openEdit(c)} style={{...BTN('#1f2030'),padding:'5px 9px',fontSize:'11px'}}>✏️</button>
                  <button onClick={()=>deleteItem(c.id)} style={{...BTN('#7f1d1d'),padding:'5px 9px',fontSize:'11px'}}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
