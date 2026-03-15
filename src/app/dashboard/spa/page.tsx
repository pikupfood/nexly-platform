'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import { useStaffNav } from '@/lib/useStaffNav'
import PaymentModal from '@/components/PaymentModal'
import { autoGenerateInvoice } from '@/lib/autoInvoice'

const SC: Record<string,{label:string;color:string}> = {
  confirmed:   { label:'Confermato',  color:'#3b82f6' },
  in_progress: { label:'In corso',    color:'#f59e0b' },
  completed:   { label:'Completato',  color:'#10b981' },
  cancelled:   { label:'Cancellato',  color:'#ef4444' },
  no_show:     { label:'No show',     color:'#7c3aed' },
}

export default function SpaPage() {
  const router = useRouter()
  const { backHref } = useStaffNav()
  const { t } = useI18n()
  const [stats, setStats] = useState({ today:0, upcoming:0, completed:0, revenue:0, revenue_today:0 })
  const [todayAppts, setTodayAppts] = useState<any[]>([])
  const [upcomingAppts, setUpcomingAppts] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string|null>(null)
  const [paymentModal, setPaymentModal] = useState<any>(null)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [])

  const load = async () => {
    const { data } = await supabase.from('spa_appointments')
      .select('*, service:spa_services(name,duration_minutes,price), staff:spa_staff(name)')
      .order('date').order('time')
    const all = data || []
    const todayList = all.filter(a => a.date === today && a.status !== 'cancelled')
    const upList = all.filter(a => a.date > today && a.status === 'confirmed').slice(0, 6)
    setTodayAppts(todayList)
    setUpcomingAppts(upList)
    const revToday = all.filter(a => a.date === today && a.status === 'completed').reduce((s,a) => s + Number(a.price||0), 0)
    setStats({
      today: todayList.length,
      upcoming: all.filter(a => a.date >= today && a.status === 'confirmed').length,
      completed: all.filter(a => a.status === 'completed').length,
      revenue: all.filter(a => a.status === 'completed').reduce((s,a) => s + Number(a.price||0), 0),
      revenue_today: revToday,
    })
    setLoading(false)
  }

  const updateStatus = async (id: string, newStatus: string) => {
    if (newStatus === 'completed') {
      const appt = todayAppts.find(a => a.id === id) || upcomingAppts.find(a => a.id === id)
      setPaymentModal({ id, appt })
      return
    }
    setUpdating(id)
    await supabase.from('spa_appointments').update({ status: newStatus }).eq('id', id)
    setTodayAppts(prev => prev.map(a => a.id === id ? {...a, status:newStatus} : a))
    setUpcomingAppts(prev => prev.map(a => a.id === id ? {...a, status:newStatus} : a))
    setUpdating(null)
  }

  const handlePayment = async (payment: any) => {
    if (!paymentModal) return
    const { id, appt } = paymentModal
    setPaymentModal(null)
    setUpdating(id)
    await supabase.from('spa_appointments').update({ status:'completed', payment_method:payment.method, payment_note:payment.note||null, is_complimentary:payment.isComplimentary }).eq('id', id)
    setTodayAppts(prev => prev.map(a => a.id === id ? {...a, status:'completed'} : a))
    if (appt) {
      await autoGenerateInvoice({
        source:'spa', sourceId:id,
        clientFirstName:appt.guest_name||'Cliente',
        clientLastName:'', clientEmail:appt.guest_email, clientPhone:appt.guest_phone,
        items:[{ description:`${appt.service?.name||'Trattamento spa'}`, quantity:1, unit_price:Number(appt.price||0), tax_rate:10 }],
        taxRate:10, paymentMethod:payment.method, paymentNote:payment.note, isComplimentary:payment.isComplimentary, router,
      })
    }
    setUpdating(null)
    setStats(s => ({ ...s, revenue_today: s.revenue_today + Number(appt?.price||0) }))
  }

  if (loading) return <div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>

  return (
    <AppShell title="Spa & Bien-être" tenantName={tenant?.business_name} userEmail={user?.email}>
        <Link href="/dashboard/spa/appuntamenti" style={{ padding:'8px 16px', background:'#8b5cf6', color:'white', borderRadius:'8px', textDecoration:'none', fontSize:'13px', fontWeight:'500' }}>+ Nuovo appuntamento</Link>

      <div style={{ padding:'20px 24px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:t('today'),           value:stats.today,           color:'#3b82f6', icon:'📅' },
            { label:t('upcoming'),       value:stats.upcoming,        color:'#f59e0b', icon:'⏰' },
            { label:t('completed'),     value:stats.completed,       color:'#10b981', icon:'✅' },
            { label:t('revenue'),   value:`€${stats.revenue_today.toFixed(0)}`,  color:'#8b5cf6', icon:'💶' },
            { label:t('revenue'), value:`€${stats.revenue.toFixed(0)}`,         color:'#a855f7', icon:'💰' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontSize:'16px', marginBottom:'6px' }}>{s.icon}</div>
              <div style={{ fontSize:'20px', fontWeight:'700', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Azioni rapide */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(170px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { href:'/dashboard/spa/appuntamenti',          label:'Tutti gli appuntamenti', icon:'📋', color:'#8b5cf6' },
            { href:'/dashboard/spa/appuntamenti?cat=massaggio', label:'Massaggi', icon:'💆', color:'#3b82f6' },
            { href:'/dashboard/spa/appuntamenti?cat=piscina',   label:'Piscina',  icon:'🏊', color:'#06b6d4' },
            { href:'/dashboard/spa/servizi',                label:'Servizi & Staff', icon:'📋', color:'#10b981' },
            { href:'/dashboard/agenda/spa',                 label:'Agenda spa', icon:'📆', color:'#f43f5e' },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'white', border:`1px solid ${a.color}30`, borderRadius:'10px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', transition:'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = a.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = a.color+'30'}>
                <span style={{ fontSize:'18px' }}>{a.icon}</span>
                <span style={{ color:'#0f172a', fontSize:'13px', fontWeight:'500' }}>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          {/* Appuntamenti oggi */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', margin:0 }}>📅 Appuntamenti oggi ({todayAppts.length})</h2>
              {stats.revenue_today > 0 && <span style={{ fontSize:'12px', color:'#10b981' }}>€{stats.revenue_today.toFixed(0)}</span>}
            </div>
            {todayAppts.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>Nessun appuntamento oggi</div>
            ) : (
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                {todayAppts.map(a => {
                  const sc = SC[a.status]
                  return (
                    <div key={a.id} style={{ padding:'12px 14px', background:`${sc.color}10`, border:`1px solid ${sc.color}30`, borderRadius:'10px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                        <div>
                          <div style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a' }}>{a.guest_name}</div>
                          <div style={{ fontSize:'12px', color:'#94a3b8' }}>{a.service?.name} · {a.staff?.name} · {String(a.time).slice(0,5)}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'13px', fontWeight:'600', color:'#8b5cf6' }}>€{a.price}</div>
                          <span style={{ background:sc.color+'20', color:sc.color, padding:'1px 7px', borderRadius:'10px', fontSize:'10px' }}>{sc.label}</span>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'6px' }}>
                        {a.status === 'confirmed' && (
                          <button onClick={() => updateStatus(a.id, 'in_progress')} disabled={updating===a.id}
                            style={{ padding:'4px 10px', background:'#f59e0b20', color:'#f59e0b', border:'1px solid #f59e0b40', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>
                            ▶ Inizia
                          </button>
                        )}
                        {a.status === 'in_progress' && (
                          <button onClick={() => updateStatus(a.id, 'completed')} disabled={updating===a.id}
                            style={{ padding:'4px 10px', background:'#10b98120', color:'#10b981', border:'1px solid #10b98140', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>
                            ✓ Completa
                          </button>
                        )}
                        {['confirmed','in_progress'].includes(a.status) && (
                          <button onClick={() => updateStatus(a.id, 'no_show')} disabled={updating===a.id}
                            style={{ padding:'4px 10px', background:'#7c3aed20', color:'#7c3aed', border:'1px solid #7c3aed40', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>
                            No show
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Prossimi appuntamenti */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:'14px', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', margin:0 }}>Prossimi appuntamenti</h2>
              <Link href="/dashboard/spa/appuntamenti" style={{ fontSize:'12px', color:'#8b5cf6', textDecoration:'none' }}>Tutti →</Link>
            </div>
            {upcomingAppts.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>Nessun prossimo appuntamento</div>
            ) : (
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                {upcomingAppts.map(a => (
                  <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a' }}>{a.guest_name}</div>
                      <div style={{ fontSize:'11px', color:'#94a3b8' }}>{a.service?.name} · {a.staff?.name}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'12px', color:'#8b5cf6', fontWeight:'600' }}>{a.date} {String(a.time).slice(0,5)}</div>
                      <div style={{ fontSize:'11px', color:'#94a3b8' }}>€{a.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {paymentModal && (
        <PaymentModal
          title={`Completa appuntamento — ${paymentModal.appt?.guest_name||''}`}
          amount={Number(paymentModal.appt?.price||0)}
          onConfirm={handlePayment}
          onCancel={() => setPaymentModal(null)}
        />
      )}
    </AppShell>
  )
}
