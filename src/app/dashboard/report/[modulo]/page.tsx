'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ── Utility: calcola date range dal periodo ──────────────────────────────────
function getDateRange(period: string, customFrom?: string, customTo?: string): { from: string; to: string; label: string } {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const startOfWeek = (d: Date) => { const dd = new Date(d); const day = dd.getDay(); dd.setDate(dd.getDate() - (day === 0 ? 6 : day - 1)); return dd }
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
  const startOfQuarter = (d: Date) => { const q = Math.floor(d.getMonth() / 3); return new Date(d.getFullYear(), q * 3, 1) }

  switch (period) {
    case 'today': return { from: fmt(today), to: fmt(today), label: 'Oggi' }
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: fmt(y), to: fmt(y), label: 'Ieri' } }
    case 'week': { const sw = startOfWeek(today); const ew = new Date(sw); ew.setDate(sw.getDate() + 6); return { from: fmt(sw), to: fmt(ew), label: 'Questa settimana' } }
    case 'last_week': { const sw = startOfWeek(today); sw.setDate(sw.getDate() - 7); const ew = new Date(sw); ew.setDate(sw.getDate() + 6); return { from: fmt(sw), to: fmt(ew), label: 'Settimana scorsa' } }
    case 'month': { const sm = startOfMonth(today); const em = new Date(today.getFullYear(), today.getMonth() + 1, 0); return { from: fmt(sm), to: fmt(em), label: 'Questo mese' } }
    case 'last_month': { const sm = new Date(today.getFullYear(), today.getMonth() - 1, 1); const em = new Date(today.getFullYear(), today.getMonth(), 0); return { from: fmt(sm), to: fmt(em), label: 'Mese scorso' } }
    case 'quarter': { const sq = startOfQuarter(today); const eq = new Date(sq); eq.setMonth(eq.getMonth() + 3); eq.setDate(0); return { from: fmt(sq), to: fmt(eq), label: 'Questo trimestre' } }
    case 'last_quarter': { const sq = startOfQuarter(today); sq.setMonth(sq.getMonth() - 3); const eq = new Date(sq); eq.setMonth(eq.getMonth() + 3); eq.setDate(0); return { from: fmt(sq), to: fmt(eq), label: 'Trimestre scorso' } }
    case 'year': return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31`, label: `Anno ${today.getFullYear()}` }
    case 'custom': return { from: customFrom || fmt(today), to: customTo || fmt(today), label: `${customFrom} → ${customTo}` }
    default: return { from: fmt(today), to: fmt(today), label: 'Oggi' }
  }
}

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

// ── Componente principale ────────────────────────────────────────────────────
function ReportContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const modulo = params.modulo as string
  const period = searchParams.get('period') || 'month'
  const customFrom = searchParams.get('from') || ''
  const customTo = searchParams.get('to') || ''

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const dateRange = getDateRange(period, customFrom, customTo)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadData()
    })
  }, [modulo, period, customFrom, customTo])

  const loadData = async () => {
    setLoading(true)
    const { from, to } = dateRange
    let result: any = {}

    if (modulo === 'hotel' || modulo === 'generale') {
      const { data: res } = await supabase.from('reservations')
        .select('*, room_type:room_types(name, base_price), guest:guests(first_name,last_name,nationality)')
        .gte('check_in', from).lte('check_in', to)
      const allRes = res || []
      result.hotel = {
        total: allRes.length,
        confirmed: allRes.filter(r => r.status === 'confirmed').length,
        checkedIn: allRes.filter(r => r.status === 'checked_in').length,
        checkedOut: allRes.filter(r => r.status === 'checked_out').length,
        cancelled: allRes.filter(r => r.status === 'cancelled').length,
        noShow: allRes.filter(r => r.status === 'no_show').length,
        complimentary: allRes.filter(r => r.is_complimentary).length,
        revenue: allRes.filter(r => !['cancelled','no_show'].includes(r.status) && !r.is_complimentary).reduce((s, r) => s + Number(r.total_price || 0), 0),
        complimentaryValue: allRes.filter(r => r.is_complimentary).reduce((s, r) => s + Number(r.total_price || 0), 0),
        cancelledRevenue: allRes.filter(r => r.status === 'cancelled').reduce((s, r) => s + Number(r.total_price || 0), 0),
        avgStay: allRes.length > 0 ? allRes.reduce((s, r) => s + Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000), 0) / allRes.length : 0,
        byRoomType: allRes.filter(r => !r.is_complimentary).reduce((acc: any, r) => {
          const t = r.room_type?.name || 'N/A'
          if (!acc[t]) acc[t] = { count: 0, revenue: 0 }
          acc[t].count++
          acc[t].revenue += Number(r.total_price || 0)
          return acc
        }, {}),
        byNationality: allRes.reduce((acc: any, r) => {
          const n = r.guest?.nationality || 'N/A'
          if (!acc[n]) acc[n] = 0
          acc[n]++
          return acc
        }, {}),
        raw: allRes,
      }
    }

    if (modulo === 'ristorante' || modulo === 'generale') {
      const [ordRes, resRes] = await Promise.all([
        supabase.from('restaurant_orders').select('*, table:restaurant_tables(table_number,location)').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59'),
        supabase.from('table_reservations').select('*').gte('date', from).lte('date', to),
      ])
      const orders = ordRes.data || []
      const tableRes = resRes.data || []
      const paidNotComp = orders.filter(o => o.status === 'paid' && !o.is_complimentary)
      result.ristorante = {
        ordersTotal: orders.length,
        ordersPaid: orders.filter(o => o.status === 'paid').length,
        ordersCancelled: orders.filter(o => o.status === 'cancelled').length,
        complimentary: orders.filter(o => o.is_complimentary).length,
        revenue: paidNotComp.reduce((s, o) => s + Number(o.total || 0), 0),
        complimentaryValue: orders.filter(o => o.is_complimentary).reduce((s, o) => s + Number(o.total || 0), 0),
        avgTicket: paidNotComp.length > 0 ? paidNotComp.reduce((s, o) => s + Number(o.total || 0), 0) / paidNotComp.length : 0,
        reservations: tableRes.length,
        totalCovers: tableRes.reduce((s, r) => s + r.guests_count, 0),
        cancelledReservations: tableRes.filter(r => r.status === 'cancelled').length,
        raw: orders,
      }
    }

    if (modulo === 'spa' || modulo === 'generale') {
      const { data: appts } = await supabase.from('spa_appointments')
        .select('*, service:spa_services(name,category,price)')
        .gte('date', from).lte('date', to)
      const all = appts || []
      result.spa = {
        total: all.length,
        completed: all.filter(a => a.status === 'completed').length,
        cancelled: all.filter(a => a.status === 'cancelled').length,
        noShow: all.filter(a => a.status === 'no_show').length,
        complimentary: all.filter(a => a.is_complimentary).length,
        revenue: all.filter(a => a.status === 'completed' && !a.is_complimentary).reduce((s, a) => s + Number(a.price || 0), 0),
        complimentaryValue: all.filter(a => a.is_complimentary).reduce((s, a) => s + Number(a.price || 0), 0),
        cancelledRevenue: all.filter(a => a.status === 'cancelled').reduce((s, a) => s + Number(a.price || 0), 0),
        byCategory: all.reduce((acc: any, a) => {
          const c = a.service?.category || 'altro'
          if (!acc[c]) acc[c] = { count: 0, revenue: 0, cancelled: 0, complimentary: 0 }
          acc[c].count++
          if (a.status === 'completed' && !a.is_complimentary) acc[c].revenue += Number(a.price || 0)
          if (a.status === 'cancelled') acc[c].cancelled++
          if (a.is_complimentary) acc[c].complimentary++
          return acc
        }, {}),
        raw: all,
      }
    }

    if (modulo === 'padel' || modulo === 'generale') {
      const { data: bookings } = await supabase.from('padel_bookings')
        .select('*, court:padel_courts(name,type)')
        .gte('date', from).lte('date', to)
      const all = bookings || []
      const hours = (b: any) => ((new Date(`2000-01-01T${b.end_time}`).getTime() - new Date(`2000-01-01T${b.start_time}`).getTime()) / 3600000)
      result.padel = {
        total: all.length,
        completed: all.filter(b => b.status === 'completed').length,
        cancelled: all.filter(b => b.status === 'cancelled').length,
        complimentary: all.filter(b => b.is_complimentary).length,
        revenue: all.filter(b => !['cancelled'].includes(b.status) && !b.is_complimentary).reduce((s, b) => s + Number(b.price || 0), 0),
        complimentaryValue: all.filter(b => b.is_complimentary).reduce((s, b) => s + Number(b.price || 0), 0),
        cancelledRevenue: all.filter(b => b.status === 'cancelled').reduce((s, b) => s + Number(b.price || 0), 0),
        totalHours: all.filter(b => b.status !== 'cancelled').reduce((s, b) => s + hours(b), 0),
        byCourt: all.reduce((acc: any, b) => {
          const c = b.court?.name || 'N/A'
          if (!acc[c]) acc[c] = { count: 0, revenue: 0, hours: 0 }
          acc[c].count++
          if (b.status !== 'cancelled' && !b.is_complimentary) { acc[c].revenue += Number(b.price || 0); acc[c].hours += hours(b) }
          return acc
        }, {}),
        raw: all,
      }
    }

    if (modulo === 'fatture' || modulo === 'generale') {
      const { data: invs } = await supabase.from('invoices')
        .select('*, items:invoice_items(*)')
        .gte('invoice_date', from).lte('invoice_date', to)
      const all = invs || []
      const paid = all.filter(i => i.status === 'paid')
      const bySource = all.reduce((acc: any, i) => {
        const s = i.source || 'altro'
        if (!acc[s]) acc[s] = { count: 0, subtotal: 0, tva: 0, total: 0 }
        acc[s].count++
        if (i.status !== 'cancelled') {
          acc[s].subtotal += Number(i.subtotal || 0)
          acc[s].tva += Number(i.tax_amount || 0)
          acc[s].total += Number(i.total || 0)
        }
        return acc
      }, {} as Record<string, any>)
      const byTva = all.filter(i => i.status !== 'cancelled').reduce((acc: any, i) => {
        const rate = `${i.tax_rate}%`
        if (!acc[rate]) acc[rate] = { base: 0, tva: 0 }
        acc[rate].base += Number(i.subtotal || 0)
        acc[rate].tva += Number(i.tax_amount || 0)
        return acc
      }, {} as Record<string, any>)
      result.fatture = {
        total: all.length,
        paid: paid.length,
        draft: all.filter(i => i.status === 'draft').length,
        sent: all.filter(i => i.status === 'sent').length,
        cancelled: all.filter(i => i.status === 'cancelled').length,
        subtotal: all.filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.subtotal || 0), 0),
        tvaTotal: all.filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.tax_amount || 0), 0),
        totalTTC: all.filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.total || 0), 0),
        paidTotal: paid.reduce((s, i) => s + Number(i.total || 0), 0),
        bySource,
        byTva,
        raw: all,
      }
    }

    setData(result)
    setLoading(false)
  }

  const MODULE_CFG: Record<string, { label: string; icon: string; color: string }> = {
    generale:   { label: 'Generale',     icon: '📊', color: '#f43f5e' },
    hotel:      { label: 'Hotel',         icon: '🏨', color: '#3b82f6' },
    ristorante: { label: 'Ristorante',    icon: '🍽️', color: '#10b981' },
    spa:        { label: 'Spa',           icon: '💆', color: '#8b5cf6' },
    padel:      { label: 'Padel',         icon: '🎾', color: '#f59e0b' },
    fatture:    { label: 'Fatture & IVA', icon: '🧾', color: '#ef4444' },
  }

  const cfg = MODULE_CFG[modulo] || MODULE_CFG.generale

  const today = new Date()
  const printDate = today.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Generazione report in corso...</div>
    </div>
  )

  return (
    <>
      {/* Barra azioni (non stampata) */}
      <div className="no-print" style={{ background: '#111118', padding: '12px 32px', display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid #1f2030' }}>
        <Link href="/dashboard/report" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '14px' }}>← Report</Link>
        <div style={{ flex: 1, fontSize: '14px', color: '#6b7280' }}>
          Report {cfg.icon} {cfg.label} · {dateRange.label}
        </div>
        <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#f43f5e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
          🖨️ Stampa / PDF
        </button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 15mm; }
        }
        body { background: #0a0a0f; }
      `}</style>

      {/* REPORT A4 */}
      <div style={{
        background: 'white', maxWidth: '860px', margin: '0 auto',
        padding: '40px', fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#1a1a1a', fontSize: '10pt', lineHeight: '1.5',
      }}>
        {/* Intestazione */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '20px', borderBottom: '3px solid #1a1a1a' }}>
          <div>
            <div style={{ fontSize: '24pt', fontWeight: '900', color: '#1a1a1a', letterSpacing: '-1px' }}>
              {cfg.icon} REPORT {cfg.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '13pt', color: '#666', marginTop: '4px' }}>{dateRange.label}</div>
            <div style={{ fontSize: '10pt', color: '#999', marginTop: '2px' }}>{dateRange.from} → {dateRange.to}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14pt', fontWeight: '700' }}>Nexly Hub</div>
            <div style={{ fontSize: '9pt', color: '#666', marginTop: '4px' }}>Generato il {printDate}</div>
          </div>
        </div>

        {/* ── HOTEL ── */}
        {data?.hotel && (
          <div style={{ marginBottom: '36px' }}>
            <SectionTitle icon="🏨" title="HOTEL" color="#3b82f6" />
            <KPIGrid items={[
              { label: 'Prenotazioni totali', value: data.hotel.total, color: '#1a1a1a' },
              { label: 'Check-in effettuati', value: data.hotel.checkedIn, color: '#059669' },
              { label: 'Check-out effettuati', value: data.hotel.checkedOut, color: '#6b7280' },
              { label: 'Cancellazioni', value: data.hotel.cancelled, color: '#dc2626' },
              { label: 'No show', value: data.hotel.noShow, color: '#7c3aed' },
              { label: '🎁 Offerti', value: data.hotel.complimentary, color: '#7c3aed' },
              { label: 'Soggiorno medio', value: `${data.hotel.avgStay.toFixed(1)} notti`, color: '#2563eb' },
            ]} />
            <RevenueBox
              revenue={data.hotel.revenue}
              cancelled={data.hotel.cancelledRevenue}
              complimentary={data.hotel.complimentaryValue}
              label="Fatturato soggiorni"
            />
            {Object.keys(data.hotel.byRoomType).length > 0 && (
              <DetailTable
                title="Per tipo camera"
                headers={['Tipo', 'Prenotazioni', 'Fatturato']}
                rows={Object.entries(data.hotel.byRoomType).map(([k, v]: any) => [k, v.count, `€${v.revenue.toFixed(2)}`])}
              />
            )}
            {Object.keys(data.hotel.byNationality).length > 0 && (
              <DetailTable
                title="Per nazionalità ospiti"
                headers={['Nazionalità', 'Ospiti']}
                rows={Object.entries(data.hotel.byNationality).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, v as number])}
              />
            )}
          </div>
        )}

        {/* ── RISTORANTE ── */}
        {data?.ristorante && (
          <div style={{ marginBottom: '36px' }}>
            <SectionTitle icon="🍽️" title="RISTORANTE" color="#10b981" />
            <KPIGrid items={[
              { label: 'Ordini totali', value: data.ristorante.ordersTotal, color: '#1a1a1a' },
              { label: 'Ordini pagati', value: data.ristorante.ordersPaid, color: '#059669' },
              { label: 'Ordini cancellati', value: data.ristorante.ordersCancelled, color: '#dc2626' },
              { label: '🎁 Offerti', value: data.ristorante.complimentary, color: '#7c3aed' },
              { label: 'Scontrino medio', value: `€${data.ristorante.avgTicket.toFixed(2)}`, color: '#2563eb' },
              { label: 'Coperti totali', value: data.ristorante.totalCovers, color: '#059669' },
            ]} />
            <RevenueBox revenue={data.ristorante.revenue} complimentary={data.ristorante.complimentaryValue} label="Fatturato ristorante" />
          </div>
        )}

        {/* ── SPA ── */}
        {data?.spa && (
          <div style={{ marginBottom: '36px' }}>
            <SectionTitle icon="💆" title="SPA & BENESSERE" color="#8b5cf6" />
            <KPIGrid items={[
              { label: 'Appuntamenti totali', value: data.spa.total, color: '#1a1a1a' },
              { label: 'Completati', value: data.spa.completed, color: '#059669' },
              { label: 'Cancellati', value: data.spa.cancelled, color: '#dc2626' },
              { label: 'No show', value: data.spa.noShow, color: '#7c3aed' },
              { label: '🎁 Offerti', value: data.spa.complimentary, color: '#7c3aed' },
            ]} />
            <RevenueBox revenue={data.spa.revenue} cancelled={data.spa.cancelledRevenue} complimentary={data.spa.complimentaryValue} label="Fatturato spa" />
            {Object.keys(data.spa.byCategory).length > 0 && (
              <DetailTable
                title="Per categoria servizio"
                headers={['Categoria', 'Appuntamenti', 'Cancellati', '🎁 Offerti', 'Fatturato']}
                rows={Object.entries(data.spa.byCategory).map(([k, v]: any) => {
                  const labels: Record<string, string> = { massaggio: '💆 Massaggi', piscina: '🏊 Piscina', jacuzzi: '🛁 Jacuzzi', viso: '✨ Viso', corpo: '🧖 Corpo', altro: '⭐ Altro' }
                  return [labels[k] || k, v.count, v.cancelled, v.complimentary || 0, `€${v.revenue.toFixed(2)}`]
                })}
              />
            )}
          </div>
        )}

        {/* ── PADEL ── */}
        {data?.padel && (
          <div style={{ marginBottom: '36px' }}>
            <SectionTitle icon="🎾" title="PADEL" color="#f59e0b" />
            <KPIGrid items={[
              { label: 'Prenotazioni totali', value: data.padel.total, color: '#1a1a1a' },
              { label: 'Completate', value: data.padel.completed, color: '#059669' },
              { label: 'Cancellate', value: data.padel.cancelled, color: '#dc2626' },
              { label: '🎁 Offerti', value: data.padel.complimentary, color: '#7c3aed' },
              { label: 'Ore giocate', value: `${data.padel.totalHours.toFixed(1)}h`, color: '#d97706' },
            ]} />
            <RevenueBox revenue={data.padel.revenue} cancelled={data.padel.cancelledRevenue} complimentary={data.padel.complimentaryValue} label="Fatturato padel" />
            {Object.keys(data.padel.byCourt).length > 0 && (
              <DetailTable
                title="Per campo"
                headers={['Campo', 'Prenotazioni', 'Ore', 'Fatturato']}
                rows={Object.entries(data.padel.byCourt).map(([k, v]: any) => [k, v.count, `${v.hours.toFixed(1)}h`, `€${v.revenue.toFixed(2)}`])}
              />
            )}
          </div>
        )}

        {/* ── FATTURE & IVA ── */}
        {data?.fatture && (
          <div style={{ marginBottom: '36px' }}>
            <SectionTitle icon="🧾" title="FATTURE & IVA (TVA)" color="#ef4444" />
            <KPIGrid items={[
              { label: 'Fatture emesse', value: data.fatture.total, color: '#1a1a1a' },
              { label: 'Pagate', value: data.fatture.paid, color: '#059669' },
              { label: 'In attesa', value: data.fatture.sent + data.fatture.draft, color: '#d97706' },
              { label: 'Annullate', value: data.fatture.cancelled, color: '#dc2626' },
            ]} />

            {/* Box IVA fiscale */}
            <div style={{ background: '#fef9e7', border: '2px solid #f59e0b', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11pt', fontWeight: '700', color: '#92400e', marginBottom: '10px' }}>📋 RIEPILOGO IVA / TVA</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f59e0b' }}>
                    {['Aliquota TVA', 'Base imponibile HT', 'TVA collectée', 'Total TTC'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9pt', color: '#92400e', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.fatture.byTva).map(([rate, v]: any) => (
                    <tr key={rate} style={{ borderBottom: '1px solid #fde68a' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>{rate}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{v.base.toFixed(2)} €</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{v.tva.toFixed(2)} €</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>{(v.base + v.tva).toFixed(2)} €</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#fde68a', fontWeight: '700' }}>
                    <td style={{ padding: '8px', textAlign: 'right' }}>TOTALE</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{data.fatture.subtotal.toFixed(2)} €</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{data.fatture.tvaTotal.toFixed(2)} €</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{data.fatture.totalTTC.toFixed(2)} €</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {Object.keys(data.fatture.bySource).length > 0 && (
              <DetailTable
                title="Fatturato per modulo"
                headers={['Origine', 'Fatture', 'HT', 'TVA', 'TTC']}
                rows={Object.entries(data.fatture.bySource).map(([k, v]: any) => {
                  const icons: Record<string, string> = { hotel: '🏨 Hotel', ristorante: '🍽️ Ristorante', spa: '💆 Spa', padel: '🎾 Padel', altro: '📋 Altro' }
                  return [icons[k] || k, v.count, `€${v.subtotal.toFixed(2)}`, `€${v.tva.toFixed(2)}`, `€${v.total.toFixed(2)}`]
                })}
              />
            )}

            {/* Totale incassato */}
            <div style={{ background: '#f0fdf4', border: '2px solid #10b981', borderRadius: '10px', padding: '16px 20px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11pt', fontWeight: '700', color: '#065f46' }}>💰 TOTALE INCASSATO</div>
                <div style={{ fontSize: '9pt', color: '#6b7280' }}>Solo fatture con status "Pagata"</div>
              </div>
              <div style={{ fontSize: '22pt', fontWeight: '900', color: '#059669' }}>{data.fatture.paidTotal.toFixed(2)} €</div>
            </div>
          </div>
        )}

        {/* ── RIEPILOGO GENERALE ── */}
        {modulo === 'generale' && data && (
          <div style={{ marginBottom: '24px' }}>
            <SectionTitle icon="📊" title="RIEPILOGO CONSOLIDATO" color="#f43f5e" />
            <div style={{ background: '#f8f8f8', border: '2px solid #1a1a1a', borderRadius: '10px', padding: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1a1a1a', color: 'white' }}>
                    {['Modulo', 'Transazioni', 'Cancellazioni', 'Fatturato lordo'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '9pt', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    data.hotel && ['🏨 Hotel', data.hotel.total, data.hotel.cancelled, `€${data.hotel.revenue.toFixed(2)}`],
                    data.ristorante && ['🍽️ Ristorante', data.ristorante.ordersTotal, data.ristorante.ordersCancelled, `€${data.ristorante.revenue.toFixed(2)}`],
                    data.spa && ['💆 Spa', data.spa.total, data.spa.cancelled, `€${data.spa.revenue.toFixed(2)}`],
                    data.padel && ['🎾 Padel', data.padel.total, data.padel.cancelled, `€${data.padel.revenue.toFixed(2)}`],
                  ].filter(Boolean).map((row: any, i: number) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9', borderBottom: '1px solid #e5e5e5' }}>
                      {row.map((cell: any, j: number) => (
                        <td key={j} style={{ padding: '10px 12px', fontSize: '10pt', fontWeight: j === row.length - 1 ? '700' : '400' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ background: '#1a1a1a', color: 'white', fontWeight: '700' }}>
                    <td style={{ padding: '10px 12px' }}>TOTALE</td>
                    <td style={{ padding: '10px 12px' }}>
                      {(data.hotel?.total || 0) + (data.ristorante?.ordersTotal || 0) + (data.spa?.total || 0) + (data.padel?.total || 0)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {(data.hotel?.cancelled || 0) + (data.ristorante?.ordersCancelled || 0) + (data.spa?.cancelled || 0) + (data.padel?.cancelled || 0)}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12pt' }}>
                      €{((data.hotel?.revenue || 0) + (data.ristorante?.revenue || 0) + (data.spa?.revenue || 0) + (data.padel?.revenue || 0)).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer legale */}
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '14px', marginTop: '24px', fontSize: '8pt', color: '#999' }}>
          Document généré par Nexly Hub · {printDate} · Données extraites de la base de données opérationnelle.
          Ce document est confidentiel et destiné à l'usage interne uniquement.
        </div>
      </div>
    </>
  )
}

// ── Sub-componenti ───────────────────────────────────────────────────────────
function SectionTitle({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '8px', borderBottom: `2px solid ${color}` }}>
      <span style={{ fontSize: '14pt' }}>{icon}</span>
      <span style={{ fontSize: '13pt', fontWeight: '800', color: '#1a1a1a' }}>{title}</span>
    </div>
  )
}

function KPIGrid({ items }: { items: { label: string; value: any; color: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: '#f9f9f9', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '9pt', color: '#999', marginBottom: '4px' }}>{item.label}</div>
          <div style={{ fontSize: '16pt', fontWeight: '800', color: item.color }}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function RevenueBox({ revenue, cancelled, complimentary, label }: { revenue: number; cancelled?: number; complimentary?: number; label: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '160px', background: '#f0fdf4', border: '1px solid #10b981', borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ fontSize: '9pt', color: '#065f46' }}>{label}</div>
        <div style={{ fontSize: '20pt', fontWeight: '900', color: '#059669' }}>€{revenue.toFixed(2)}</div>
      </div>
      {cancelled !== undefined && cancelled > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px 16px', minWidth: '160px' }}>
          <div style={{ fontSize: '9pt', color: '#991b1b' }}>Mancato incasso (cancellazioni)</div>
          <div style={{ fontSize: '16pt', fontWeight: '700', color: '#dc2626' }}>−€{cancelled.toFixed(2)}</div>
        </div>
      )}
      {complimentary !== undefined && complimentary > 0 && (
        <div style={{ background: '#f5f3ff', border: '1px solid #7c3aed', borderRadius: '8px', padding: '12px 16px', minWidth: '160px' }}>
          <div style={{ fontSize: '9pt', color: '#5b21b6' }}>🎁 Valore offerto (non contato)</div>
          <div style={{ fontSize: '16pt', fontWeight: '700', color: '#7c3aed' }}>€{complimentary.toFixed(2)}</div>
        </div>
      )}
    </div>
  )
}

function DetailTable({ title, headers, rows }: { title: string; headers: string[]; rows: any[][] }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '9pt', fontWeight: '700', color: '#555', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            {headers.map(h => <th key={h} style={{ padding: '6px 10px', textAlign: h === headers[0] ? 'left' : 'right', color: '#555', fontWeight: '600', borderBottom: '1px solid #ddd' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
              {row.map((cell, j) => <td key={j} style={{ padding: '6px 10px', textAlign: j === 0 ? 'left' : 'right' }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ReportModuloPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#94a3b8' }}>Caricamento...</div></div>}>
      <ReportContent />
    </Suspense>
  )
}
