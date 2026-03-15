'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'

const TYPE_COLOR: Record<string,string> = { lead:'#f59e0b', client:'#10b981', prospect:'#3b82f6', vip:'#8b5cf6', partner:'#ec4899' }
const STATUS_COLOR: Record<string,string> = { new:'#94a3b8', contacted:'#3b82f6', qualified:'#f59e0b', converted:'#10b981', lost:'#ef4444' }
const SOURCE_ICON: Record<string,string> = { booking:'🏨', website:'🌐', referral:'🤝', social:'📱', ads:'📣', manual:'✏️', walk_in:'🚶' }

export default function CRMPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [contacts, setContacts] = useState<any[]>([])
  const [stats, setStats] = useState({ total:0, leads:0, clients:0, vip:0, converted:0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', phone:'', company:'', type:'lead', source:'manual', notes:'', newsletter:false })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: t } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(t); setTenantId(t?.id||null)
      load()
    })
  }, [])

  const load = async () => {
    const { data } = await supabase.from('crm_contacts').select('*').order('created_at', { ascending:false })
    const all = data||[]
    setContacts(all)
    setStats({ total:all.length, leads:all.filter(c=>c.type==='lead').length, clients:all.filter(c=>c.type==='client').length, vip:all.filter(c=>c.type==='vip').length, converted:all.filter(c=>c.status==='converted').length })
    setLoading(false)
  }

  const save = async () => {
    if (!form.first_name || !tenantId) return
    setSaving(true)
    const { data, error } = await supabase.from('crm_contacts').insert([{ ...form, tenant_id: tenantId }]).select().single()
    if (!error && data) { setContacts(prev=>[data,...prev]); setShowForm(false); setForm({ first_name:'', last_name:'', email:'', phone:'', company:'', type:'lead', source:'manual', notes:'', newsletter:false }) }
    setSaving(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('crm_contacts').update({ status }).eq('id', id)
    setContacts(prev=>prev.map(c=>c.id===id?{...c,status}:c))
  }

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchS = !q || `${c.first_name} ${c.last_name} ${c.email} ${c.company}`.toLowerCase().includes(q)
    const matchT = filterType==='all' || c.type===filterType
    const matchSt = filterStatus==='all' || c.status===filterStatus
    return matchS && matchT && matchSt
  })

  const IS: any = { padding:'8px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }

  const actions = (
    <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'7px 16px', background:'#db2777', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
      {showForm ? '✕' : '+ Contact'}
    </button>
  )

  return (
    <AppShell title="CRM" subtitle={t('contacts')} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'20px 24px' }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Total', value:stats.total, color:'#475569', bg:'#f8fafc' },
            { label:'Leads', value:stats.leads, color:'#f59e0b', bg:'#fffbeb' },
            { label:'Clients', value:stats.clients, color:'#059669', bg:'#f0fdf4' },
            { label:'VIP', value:stats.vip, color:'#7c3aed', bg:'#faf5ff' },
            { label:'Convertis', value:stats.converted, color:'#2563eb', bg:'#eff6ff' },
          ].map(k=>(
            <div key={k.label} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px', borderTop:`3px solid ${k.color}` }}>
              <div style={{ fontSize:'24px', fontWeight:'700', color:k.color }}>{k.value}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px', fontWeight:'500' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'18px 20px', marginBottom:'16px' }}>
            <h3 style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', margin:'0 0 14px' }}>Nouveau contact</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'10px', marginBottom:'12px' }}>
              {[{k:'first_name',l:'Prénom *',p:'Marie'},{k:'last_name',l:'Nom',p:'Dupont'},{k:'email',l:'Email',p:'marie@email.com'},{k:'phone',l:'Téléphone',p:'+33...'},{k:'company',l:'Société',p:'Hôtel du Lac'}].map(f=>(
                <div key={f.k}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>{f.l}</div>
                  <input style={{ ...IS, width:'100%' }} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} />
                </div>
              ))}
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Type</div>
                <select style={{ ...IS, width:'100%' }} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                  {['lead','client','prospect','vip','partner'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Source</div>
                <select style={{ ...IS, width:'100%' }} value={form.source} onChange={e=>setForm(p=>({...p,source:e.target.value}))}>
                  {['manual','booking','website','referral','social','ads','walk_in'].map(s=><option key={s} value={s}>{SOURCE_ICON[s]} {s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Notes</div>
              <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={{ ...IS, width:'100%', height:'60px', resize:'none' }} placeholder="Notes internes..." />
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <button onClick={save} disabled={!form.first_name||saving} style={{ padding:'8px 20px', background:form.first_name?'#db2777':'#94a3b8', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>
                {saving?'...':'✓ Enregistrer'}
              </button>
              <label style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', color:'#64748b', cursor:'pointer' }}>
                <input type="checkbox" checked={form.newsletter} onChange={e=>setForm(p=>({...p,newsletter:e.target.checked}))} />
                Newsletter
              </label>
            </div>
          </div>
        )}

        {/* Filtri */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..."
            style={{ ...IS, width:'200px' }} />
          {['all','lead','client','vip','prospect'].map(tp=>(
            <button key={tp} onClick={()=>setFilterType(tp)} style={{ padding:'6px 12px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'600',
              background:filterType===tp?(tp==='all'?'#475569':TYPE_COLOR[tp]):'white',
              color:filterType===tp?'white':'#64748b',
              outline:`1px solid ${filterType===tp?(tp==='all'?'#475569':TYPE_COLOR[tp]):'#e2e8f0'}` }}>
              {tp==='all'?'Tous':tp.charAt(0).toUpperCase()+tp.slice(1)}
            </button>
          ))}
          <span style={{ fontSize:'11px', color:'#94a3b8', marginLeft:'auto' }}>{filtered.length} résultats</span>
        </div>

        {/* Lista contatti */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
                {['Contact','Société','Type','Source','Status','Dépenses','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'#94a3b8', fontWeight:'600', letterSpacing:'0.03em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>
                  Aucun contact. <button onClick={()=>setShowForm(true)} style={{ background:'none', border:'none', color:'#db2777', cursor:'pointer', fontSize:'13px' }}>Créer le premier →</button>
                </td></tr>
              ) : filtered.map((c,i)=>(
                <tr key={c.id} style={{ borderBottom: i<filtered.length-1?'1px solid #f1f5f9':'none' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#fafbff'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:`${TYPE_COLOR[c.type]||'#94a3b8'}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:TYPE_COLOR[c.type]||'#94a3b8', flexShrink:0 }}>
                        {c.first_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>{c.first_name} {c.last_name}</div>
                        {c.email && <div style={{ fontSize:'11px', color:'#94a3b8' }}>{c.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'12px', color:'#64748b' }}>{c.company||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:`${TYPE_COLOR[c.type]||'#94a3b8'}15`, color:TYPE_COLOR[c.type]||'#94a3b8', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:'600' }}>
                      {c.type}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'13px' }}>{SOURCE_ICON[c.source]||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <select value={c.status} onChange={e=>updateStatus(c.id, e.target.value)} style={{ padding:'3px 8px', background:`${STATUS_COLOR[c.status]||'#94a3b8'}15`, border:`1px solid ${STATUS_COLOR[c.status]||'#94a3b8'}30`, borderRadius:'6px', color:STATUS_COLOR[c.status]||'#94a3b8', fontSize:'11px', fontWeight:'600', cursor:'pointer', outline:'none' }}>
                      {['new','contacted','qualified','converted','lost'].map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'12px', color:'#0f172a', fontWeight:'600' }}>
                    {c.total_spent>0?`€${Number(c.total_spent).toFixed(0)}`:'—'}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {c.newsletter && <span style={{ fontSize:'10px', background:'#eff6ff', color:'#2563eb', padding:'2px 6px', borderRadius:'5px' }}>📧</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
