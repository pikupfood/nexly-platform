'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

const CAT: Record<string,{icon:string;label:string}> = {
  transport:     { icon:'🚗', label:'Transport' },
  meals:         { icon:'🍽️', label:'Repas' },
  accommodation: { icon:'🏨', label:'Hébergement' },
  supplies:      { icon:'📦', label:'Fournitures' },
  equipment:     { icon:'💻', label:'Équipement' },
  other:         { icon:'📋', label:'Autre' },
}
const ST: Record<string,{label:string;color:string}> = {
  draft:     { label:'Brouillon', color:'#94a3b8' },
  submitted: { label:'Soumis',    color:'#2563eb' },
  approved:  { label:'Approuvé',  color:'#059669' },
  rejected:  { label:'Refusé',    color:'#dc2626' },
  reimbursed:{ label:'Remboursé', color:'#7c3aed' },
}

export default function NotesDefraisPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', category:'meals', amount:0, expense_date:new Date().toISOString().split('T')[0], staff_id:'', notes:'' })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: tn } = await supabase.from('tenants').select('*').eq('user_id', session.user.id).single()
      setTenant(tn); setTenantId(tn?.id||null)
      const [expRes, staffRes] = await Promise.all([
        supabase.from('expense_reports').select('*, staff:staff_accounts(first_name,last_name)').order('expense_date', { ascending:false }),
        supabase.from('staff_accounts').select('id,first_name,last_name').eq('is_active',true),
      ])
      setExpenses(expRes.data||[]); setStaff(staffRes.data||[]); setLoading(false)
    })
  }, [])

  const save = async () => {
    if (!form.title||!tenantId) return
    setSaving(true)
    const { data, error } = await supabase.from('expense_reports').insert([{ ...form, tenant_id:tenantId, amount:Number(form.amount), staff_id:form.staff_id||null }]).select('*, staff:staff_accounts(first_name,last_name)').single()
    if (!error&&data) { setExpenses(p=>[data,...p]); setShowForm(false) }
    else if (error) alert(error.message)
    setSaving(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('expense_reports').update({ status }).eq('id', id)
    setExpenses(p=>p.map(e=>e.id===id?{...e,status}:e))
  }

  const total = expenses.filter(e=>e.status==='approved'||e.status==='reimbursed').reduce((s,e)=>s+Number(e.amount||0),0)
  const pending = expenses.filter(e=>e.status==='submitted').reduce((s,e)=>s+Number(e.amount||0),0)
  const IS: any = { padding:'8px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'7px', color:'#0f172a', fontSize:'13px', outline:'none', boxSizing:'border-box' }

  const actions = (
    <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'7px 14px', background:'#7c3aed', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
      + Note de frais
    </button>
  )

  return (
    <AppShell title="Notes de frais" subtitle={`${expenses.length} dépenses`} actions={actions} tenantName={tenant?.business_name} userEmail={user?.email}>
      <div style={{ padding:'16px 20px' }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
          {[
            { label:'Total approuvé', value:`€${total.toFixed(2)}`, color:'#059669' },
            { label:'En attente', value:`€${pending.toFixed(2)}`, color:'#d97706' },
            { label:'Ce mois', value:expenses.filter(e=>e.expense_date?.startsWith(new Date().toISOString().slice(0,7))).length, color:'#2563eb' },
            { label:'Total fiches', value:expenses.length, color:'#7c3aed' },
          ].map(k=>(
            <div key={k.label} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'12px 14px', borderTop:`3px solid ${k.color}` }}>
              <div style={{ fontSize:'18px', fontWeight:'700', color:k.color }}>{k.value}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'12px' }}>Nouvelle note de frais</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'10px', marginBottom:'12px' }}>
              <div style={{ gridColumn:'1 / -1' }}><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Titre *</div><input style={{ ...IS, width:'100%' }} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Déjeuner client" /></div>
              <div><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Catégorie</div>
                <select style={{ ...IS, width:'100%' }} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                  {Object.entries(CAT).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Montant (€) *</div><input type="number" style={{ ...IS, width:'100%' }} value={form.amount} onChange={e=>setForm(p=>({...p,amount:Number(e.target.value)}))} /></div>
              <div><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Date</div><input type="date" style={{ ...IS, width:'100%' }} value={form.expense_date} onChange={e=>setForm(p=>({...p,expense_date:e.target.value}))} /></div>
              <div><div style={{ fontSize:'11px', color:'#64748b', marginBottom:'3px' }}>Collaborateur</div>
                <select style={{ ...IS, width:'100%' }} value={form.staff_id} onChange={e=>setForm(p=>({...p,staff_id:e.target.value}))}>
                  <option value="">Non assigné</option>
                  {staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={save} disabled={!form.title||saving} style={{ padding:'8px 18px', background:form.title?'#7c3aed':'#94a3b8', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
              {saving?'...':'✓ Enregistrer'}
            </button>
          </div>
        )}

        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                {['Titre','Catégorie','Collaborateur','Date','Montant','Statut','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'#94a3b8', fontWeight:'600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.length===0?(
                <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>Aucune note de frais.</td></tr>
              ):expenses.map((e,i)=>{
                const sc = ST[e.status]||ST.draft
                const cat = CAT[e.category]||CAT.other
                return (
                  <tr key={e.id} style={{ borderBottom:i<expenses.length-1?'1px solid #f1f5f9':'none' }}>
                    <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>{e.title}</td>
                    <td style={{ padding:'10px 14px', fontSize:'13px' }}>{cat.icon} {cat.label}</td>
                    <td style={{ padding:'10px 14px', fontSize:'12px', color:'#64748b' }}>{e.staff?`${e.staff.first_name} ${e.staff.last_name}`:'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:'12px', color:'#64748b' }}>{e.expense_date}</td>
                    <td style={{ padding:'10px 14px', fontSize:'14px', fontWeight:'700', color:'#0f172a' }}>€{Number(e.amount).toFixed(2)}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background:`${sc.color}15`, color:sc.color, padding:'3px 8px', borderRadius:'8px', fontSize:'11px', fontWeight:'600' }}>{sc.label}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <select value={e.status} onChange={ev=>updateStatus(e.id,ev.target.value)} style={{ padding:'3px 7px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'11px', color:'#64748b', cursor:'pointer', outline:'none' }}>
                        {Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                      </select>
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
