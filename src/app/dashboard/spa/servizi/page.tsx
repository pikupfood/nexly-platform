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
const ROW: any = { display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', background:'#0a0a0f', borderRadius:'8px', border:'1px solid #1f2030' }

const CATEGORIES = [
  { value:'massaggio', label:'Massages', icon:'💆' },
  { value:'piscina', label:'Piscine', icon:'🏊' },
  { value:'jacuzzi', label:'Jacuzzi', icon:'🛁' },
  { value:'viso', label:'Soins visage', icon:'✨' },
  { value:'corpo', label:'Soins corps', icon:'🧴' },
  { value:'altro', label:'Autres', icon:'⭐' },
]

const EMPTY_SVC = { name:'', description:'', price:'', duration_minutes:60, category:'massaggio', is_active:true, sort_order:0 }
const EMPTY_STAFF = { name:'', specialty:'', bio:'' }

export default function ServiziPage() {
  const router = useRouter()
  const [services, setServices] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [tab, setTab] = useState<'services'|'staff'>('services')
  const [loading, setLoading] = useState(true)
  const [showSvcForm, setShowSvcForm] = useState(false)
  const [showStaffForm, setShowStaffForm] = useState(false)
  const [editSvc, setEditSvc] = useState<any>(null)
  const [editStaff, setEditStaff] = useState<any>(null)
  const [svcForm, setSvcForm] = useState<any>(EMPTY_SVC)
  const [staffForm, setStaffForm] = useState<any>(EMPTY_STAFF)
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{session} }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const [sv, st] = await Promise.all([
      supabase.from('spa_services').select('*').order('category').order('sort_order').order('name'),
      supabase.from('spa_staff').select('*').order('name'),
    ])
    setServices(sv.data||[]); setStaff(st.data||[])
    setLoading(false)
  }

  const openSvcEdit = (s?:any) => {
    setEditSvc(s||null)
    setSvcForm(s ? { name:s.name, description:s.description||'', price:s.price||'', duration_minutes:s.duration_minutes||60, category:s.category||'massaggio', is_active:s.is_active!==false, sort_order:s.sort_order||0 } : EMPTY_SVC)
    setShowSvcForm(true); setShowStaffForm(false)
  }

  const saveSvc = async () => {
    setSaving(true)
    const tenantId = await getTenantId()
    const payload = { ...svcForm, price:parseFloat(svcForm.price)||0 }
    if (editSvc) {
      await supabase.from('spa_services').update(payload).eq('id', editSvc.id)
      setServices(p=>p.map(x=>x.id===editSvc.id ? {...x,...payload} : x))
    } else {
      const { data } = await supabase.from('spa_services').insert([{...payload, tenant_id:tenantId}]).select().single()
      if (data) setServices(p=>[...p,data])
    }
    setShowSvcForm(false); setSaving(false)
  }

  const deleteSvc = async (id:string) => {
    if (!confirm('Supprimer ce service ?')) return
    await supabase.from('spa_services').delete().eq('id',id)
    setServices(p=>p.filter(x=>x.id!==id))
  }

  const toggleSvc = async (s:any) => {
    await supabase.from('spa_services').update({ is_active:!s.is_active }).eq('id',s.id)
    setServices(p=>p.map(x=>x.id===s.id ? {...x,is_active:!x.is_active} : x))
  }

  const openStaffEdit = (s?:any) => {
    setEditStaff(s||null)
    setStaffForm(s ? { name:s.name, specialty:s.specialty||'', bio:s.bio||'' } : EMPTY_STAFF)
    setShowStaffForm(true); setShowSvcForm(false)
  }

  const saveStaff = async () => {
    setSaving(true)
    const tenantId = await getTenantId()
    if (editStaff) {
      await supabase.from('spa_staff').update(staffForm).eq('id', editStaff.id)
      setStaff(p=>p.map(x=>x.id===editStaff.id ? {...x,...staffForm} : x))
    } else {
      const { data } = await supabase.from('spa_staff').insert([{...staffForm, tenant_id:tenantId, is_active:true}]).select().single()
      if (data) setStaff(p=>[...p,data])
    }
    setShowStaffForm(false); setSaving(false)
  }

  const deleteStaff = async (id:string) => {
    if (!confirm('Supprimer ce membre du staff ?')) return
    await supabase.from('spa_staff').delete().eq('id',id)
    setStaff(p=>p.filter(x=>x.id!==id))
  }

  const toggleStaff = async (s:any) => {
    await supabase.from('spa_staff').update({ is_active:!s.is_active }).eq('id',s.id)
    setStaff(p=>p.map(x=>x.id===s.id ? {...x,is_active:!x.is_active} : x))
  }

  const visibleServices = filterCat ? services.filter(s=>s.category===filterCat) : services

  if (loading) return <div style={{minHeight:'100vh',background:'#0a0a0f',display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280'}}>Chargement...</div>

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0f',fontFamily:'system-ui,sans-serif',color:'#f1f1f1'}}>
      <div style={{borderBottom:'1px solid #1f2030',padding:'14px 28px',display:'flex',alignItems:'center',gap:'12px'}}>
        <Link href="/dashboard/spa" style={{color:'#6b7280',textDecoration:'none',fontSize:'13px'}}>← Spa</Link>
        <span style={{color:'#374151'}}>|</span>
        <span style={{fontWeight:600}}>💆 Gestion des Services & Staff</span>
      </div>

      <div style={{maxWidth:'860px',margin:'0 auto',padding:'24px 20px 80px'}}>
        <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
          {(['services','staff'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:'8px 18px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:500,background:tab===t?'#8b5cf6':'#1f2030',color:tab===t?'white':'#9ca3af'}}>
              {t==='services'?'✨ Services & Soins':'👤 Équipe & Thérapeutes'}
            </button>
          ))}
        </div>

        {/* ─ SERVICES ─ */}
        {tab==='services' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px',gap:'10px',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              <button onClick={()=>setFilterCat('')} style={{...BTN(filterCat===''?'#8b5cf6':'#1f2030'),padding:'5px 10px',fontSize:'11px'}}>Tous ({services.length})</button>
              {CATEGORIES.map(c=>(
                <button key={c.value} onClick={()=>setFilterCat(c.value)} style={{...BTN(filterCat===c.value?'#8b5cf6':'#1f2030'),padding:'5px 10px',fontSize:'11px'}}>
                  {c.icon} {c.label} ({services.filter(s=>s.category===c.value).length})
                </button>
              ))}
            </div>
            <button onClick={()=>openSvcEdit()} style={BTN('#8b5cf6')}>+ Nouveau service</button>
          </div>

          {showSvcForm && (
            <div style={{...CARD,marginBottom:'14px',borderColor:'#8b5cf6'}}>
              <div style={{fontWeight:600,marginBottom:'12px',fontSize:'14px'}}>{editSvc?'✏️ Modifier':'➕ Nouveau'} service</div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={LS}>Nom *</label><input style={IS} value={svcForm.name} onChange={e=>setSvcForm((p:any)=>({...p,name:e.target.value}))} placeholder="Ex: Massage suédois" /></div>
                <div><label style={LS}>Prix (€)</label><input style={IS} type="number" step="0.5" value={svcForm.price} onChange={e=>setSvcForm((p:any)=>({...p,price:e.target.value}))} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={LS}>Catégorie</label>
                  <select style={IS} value={svcForm.category} onChange={e=>setSvcForm((p:any)=>({...p,category:e.target.value}))}>
                    {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Durée (min)</label>
                  <select style={IS} value={svcForm.duration_minutes} onChange={e=>setSvcForm((p:any)=>({...p,duration_minutes:parseInt(e.target.value)}))}>
                    {[30,45,60,75,90,120].map(d=><option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div><label style={LS}>Ordre</label><input style={IS} type="number" value={svcForm.sort_order} onChange={e=>setSvcForm((p:any)=>({...p,sort_order:parseInt(e.target.value)||0}))} /></div>
              </div>
              <div style={{marginBottom:'14px'}}><label style={LS}>Description</label><textarea style={{...IS,height:'65px',resize:'vertical' as const}} value={svcForm.description} onChange={e=>setSvcForm((p:any)=>({...p,description:e.target.value}))} /></div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={saveSvc} disabled={!svcForm.name||saving} style={BTN(saving?'#374151':'#8b5cf6')}>{saving?'Sauvegarde...':'✓ Sauvegarder'}</button>
                <button onClick={()=>setShowSvcForm(false)} style={BTN('#374151')}>Annuler</button>
              </div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {visibleServices.length===0 && <div style={{textAlign:'center',color:'#6b7280',padding:'32px',background:'#111118',borderRadius:'12px'}}>Aucun service. Ajoutez vos prestations !</div>}
            {visibleServices.map(s=>{
              const cat = CATEGORIES.find(c=>c.value===s.category)
              return (
                <div key={s.id} style={{...ROW,opacity:s.is_active!==false?1:0.5}}>
                  <div style={{fontSize:'20px'}}>{cat?.icon||'⭐'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500,fontSize:'14px'}}>{s.name}</div>
                    <div style={{fontSize:'12px',color:'#6b7280'}}>{cat?.label} · {s.duration_minutes} min{s.description?` · ${s.description.substring(0,50)}...`:''}</div>
                  </div>
                  <div style={{fontFamily:'monospace',fontWeight:700,color:'#8b5cf6',fontSize:'15px',marginRight:'8px'}}>€{parseFloat(s.price||0).toFixed(0)}</div>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={()=>toggleSvc(s)} style={{...BTN(s.is_active!==false?'#374151':'#059669'),padding:'5px 9px',fontSize:'11px'}}>{s.is_active!==false?'OFF':'ON'}</button>
                    <button onClick={()=>openSvcEdit(s)} style={{...BTN('#1f2030'),padding:'5px 9px',fontSize:'11px'}}>✏️</button>
                    <button onClick={()=>deleteSvc(s.id)} style={{...BTN('#7f1d1d'),padding:'5px 9px',fontSize:'11px'}}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>}

        {/* ─ STAFF ─ */}
        {tab==='staff' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
            <span style={{color:'#9ca3af',fontSize:'13px'}}>{staff.length} membre(s) de l'équipe</span>
            <button onClick={()=>openStaffEdit()} style={BTN('#8b5cf6')}>+ Nouveau thérapeute</button>
          </div>

          {showStaffForm && (
            <div style={{...CARD,marginBottom:'14px',borderColor:'#8b5cf6'}}>
              <div style={{fontWeight:600,marginBottom:'12px',fontSize:'14px'}}>{editStaff?'✏️ Modifier':'➕ Nouveau'} thérapeute</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={LS}>Nom *</label><input style={IS} value={staffForm.name} onChange={e=>setStaffForm((p:any)=>({...p,name:e.target.value}))} placeholder="Ex: Marie Dupont" /></div>
                <div><label style={LS}>Spécialité</label><input style={IS} value={staffForm.specialty} onChange={e=>setStaffForm((p:any)=>({...p,specialty:e.target.value}))} placeholder="Ex: Massages, Soins visage" /></div>
              </div>
              <div style={{marginBottom:'14px'}}><label style={LS}>Bio / Présentation</label><textarea style={{...IS,height:'70px',resize:'vertical' as const}} value={staffForm.bio} onChange={e=>setStaffForm((p:any)=>({...p,bio:e.target.value}))} /></div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={saveStaff} disabled={!staffForm.name||saving} style={BTN(saving?'#374151':'#8b5cf6')}>{saving?'Sauvegarde...':'✓ Sauvegarder'}</button>
                <button onClick={()=>setShowStaffForm(false)} style={BTN('#374151')}>Annuler</button>
              </div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {staff.length===0 && <div style={{textAlign:'center',color:'#6b7280',padding:'32px',background:'#111118',borderRadius:'12px'}}>Aucun thérapeute. Ajoutez votre équipe !</div>}
            {staff.map(s=>(
              <div key={s.id} style={{...ROW,opacity:s.is_active!==false?1:0.5}}>
                <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'#8b5cf6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0}}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500,fontSize:'14px'}}>{s.name}</div>
                  <div style={{fontSize:'12px',color:'#6b7280'}}>{s.specialty||'—'}{s.bio?` · ${s.bio.substring(0,60)}...`:''}</div>
                </div>
                <div style={{display:'flex',gap:'6px'}}>
                  <button onClick={()=>toggleStaff(s)} style={{...BTN(s.is_active!==false?'#374151':'#059669'),padding:'5px 9px',fontSize:'11px'}}>{s.is_active!==false?'OFF':'ON'}</button>
                  <button onClick={()=>openStaffEdit(s)} style={{...BTN('#1f2030'),padding:'5px 9px',fontSize:'11px'}}>✏️</button>
                  <button onClick={()=>deleteStaff(s.id)} style={{...BTN('#7f1d1d'),padding:'5px 9px',fontSize:'11px'}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  )
}
