'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

const CAT_CFG: Record<string,{icon:string;label:string;color:string}> = {
  contract:  { icon:'📜', label:'Contrat',     color:'#2563eb' },
  invoice:   { icon:'🧾', label:'Facture',     color:'#dc2626' },
  legal:     { icon:'⚖️', label:'Juridique',   color:'#7c3aed' },
  hr:        { icon:'👤', label:'RH',          color:'#0891b2' },
  procedure: { icon:'📋', label:'Procédure',   color:'#059669' },
  template:  { icon:'📄', label:'Modèle',      color:'#d97706' },
  general:   { icon:'📁', label:'Général',     color:'#94a3b8' },
}

export default function DocumentsPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name:'', category:'general', description:'', file_url:'', is_shared:false })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(tn); setTenantId(tn?.id||null)
      const { data } = await supabase.from('documents').select('*').order('created_at', { ascending:false })
      setDocs(data||[]); setLoading(false)
    })
  }, [])

  const save = async () => {
    if (!form.name||!tenantId) return
    setSaving(true)
    const { data, error } = await supabase.from('documents').insert([{ ...form, tenant_id:tenantId, created_by:user?.id }]).select().single()
    if (!error&&data) { setDocs(p=>[data,...p]); setShowForm(false); setForm({ name:'', category:'general', description:'', file_url:'', is_shared:false }) }
    else if (error) alert(error.message)
    setSaving(false)
  }

  const deleteDoc = async (id: string) => {
    if (!confirm('Supprimer ce document ?')) return
    await supabase.from('documents').delete().eq('id', id)
    setDocs(p=>p.filter(d=>d.id!==id))
  }

  const filtered = docs.filter(d=>{
    const matchCat = filterCat==='all'||d.category===filterCat
    const matchS = !search||d.name.toLowerCase().includes(search.toLowerCase())||d.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchS
  })

  const IS: any = { padding:'8px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }

  const actions = (
    <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'7px 14px', background:'#64748b', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
      + Document
    </button>
  )

  return (
    <AppShell title="Documents" subtitle={`${docs.length} documents`} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'16px 20px' }}>
        {/* Stats par catégorie */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
          {Object.entries(CAT_CFG).map(([k,v])=>{
            const count = docs.filter(d=>d.category===k).length
            if (!count) return null
            return (
              <button key={k} onClick={()=>setFilterCat(filterCat===k?'all':k)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 12px', background:filterCat===k?v.color:'white', color:filterCat===k?'white':'#64748b', border:`1px solid ${filterCat===k?v.color:'#e2e8f0'}`, borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:'600', transition:'all 0.15s' }}>
                {v.icon} {v.label} <span style={{ background:filterCat===k?'rgba(255,255,255,0.3)':v.color+'20', color:filterCat===k?'white':v.color, borderRadius:'5px', padding:'0 5px', fontSize:'10px' }}>{count}</span>
              </button>
            )
          })}
          {filterCat!=='all' && <button onClick={()=>setFilterCat('all')} style={{ padding:'5px 10px', background:'#f1f5f9', color:'#94a3b8', border:'1px solid #e2e8f0', borderRadius:'8px', cursor:'pointer', fontSize:'11px' }}>✕ Tous</button>}
        </div>

        {/* Recherche */}
        <div style={{ marginBottom:'14px' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un document..."
            style={{ ...IS, width:'280px' }} />
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>Ajouter un document</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'10px', marginBottom:'12px' }}>
              <div style={{ gridColumn:'1 / -1' }}><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Nom *</div><input style={{ ...IS, width:'100%' }} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Contrat de travail Pierre Martin" /></div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Catégorie</div>
                <select style={{ ...IS, width:'100%' }} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                  {Object.entries(CAT_CFG).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>URL du fichier</div><input style={{ ...IS, width:'100%' }} value={form.file_url} onChange={e=>setForm(p=>({...p,file_url:e.target.value}))} placeholder="https://drive.google.com/..." /></div>
              <div style={{ gridColumn:'1 / -1' }}><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Description</div><input style={{ ...IS, width:'100%' }} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Brève description..." /></div>
            </div>
            <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
              <button onClick={save} disabled={!form.name||saving} style={{ padding:'8px 18px', background:form.name?'#64748b':'#94a3b8', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                {saving?'...':'✓ Enregistrer'}
              </button>
              <label style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', color:'#64748b', cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_shared} onChange={e=>setForm(p=>({...p,is_shared:e.target.checked}))} />
                Partagé avec l'équipe
              </label>
            </div>
          </div>
        )}

        {/* Grid documents */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'12px' }}>
          {filtered.length===0 ? (
            <div style={{ gridColumn:'1 / -1', background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'50px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>
              {search ? 'Aucun résultat.' : 'Aucun document. Ajoutez vos contrats, procédures, modèles...'}
            </div>
          ) : filtered.map(d=>{
            const cat = CAT_CFG[d.category]||CAT_CFG.general
            return (
              <div key={d.id} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px', display:'flex', flexDirection:'column', gap:'8px', transition:'box-shadow 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'8px', background:`${cat.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>
                    {cat.icon}
                  </div>
                  <div style={{ display:'flex', gap:'4px' }}>
                    {d.is_shared && <span style={{ fontSize:'10px', background:'#eff6ff', color:'#2563eb', padding:'2px 6px', borderRadius:'5px', fontWeight:'600' }}>Partagé</span>}
                    <button onClick={()=>deleteDoc(d.id)} style={{ background:'none', border:'none', color:'#cbd5e1', cursor:'pointer', fontSize:'14px', padding:'2px' }}
                      onMouseEnter={e=>e.currentTarget.style.color='#dc2626'}
                      onMouseLeave={e=>e.currentTarget.style.color='#cbd5e1'}>✕</button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'3px' }}>{d.name}</div>
                  {d.description && <div style={{ fontSize:'11px', color:'#94a3b8', lineHeight:1.4 }}>{d.description}</div>}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'auto', paddingTop:'6px', borderTop:'1px solid #f1f5f9' }}>
                  <span style={{ fontSize:'11px', background:`${cat.color}12`, color:cat.color, padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>{cat.label}</span>
                  {d.file_url ? (
                    <a href={d.file_url} target="_blank" rel="noreferrer" style={{ fontSize:'11px', color:'#2563eb', textDecoration:'none', fontWeight:'600' }}>↗ Ouvrir</a>
                  ) : <span style={{ fontSize:'11px', color:'#cbd5e1' }}>Pas de fichier</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
