'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const MODULES = [
  { key: 'generale',   label: 'Generale',    icon: '📊', color: '#f43f5e', desc: 'Tutti i moduli consolidati' },
  { key: 'hotel',      label: 'Hotel',        icon: '🏨', color: '#3b82f6', desc: 'Soggiorni, camere, occupazione' },
  { key: 'ristorante', label: 'Ristorante',   icon: '🍽️', color: '#10b981', desc: 'Tavoli, ordini, coperti' },
  { key: 'spa',        label: 'Spa',          icon: '💆', color: '#8b5cf6', desc: 'Massaggi, piscina, jacuzzi' },
  { key: 'padel',      label: 'Padel',        icon: '🎾', color: '#f59e0b', desc: 'Campi, prenotazioni, ore' },
  { key: 'fatture',    label: 'Fatture & IVA',icon: '🧾', color: '#ef4444', desc: 'Fatturato, IVA, pagamenti' },
]

const PERIODS = [
  { key: 'today',     label: 'Oggi' },
  { key: 'yesterday', label: 'Ieri' },
  { key: 'week',      label: 'Questa settimana' },
  { key: 'last_week', label: 'Settimana scorsa' },
  { key: 'month',     label: 'Questo mese' },
  { key: 'last_month',label: 'Mese scorso' },
  { key: 'quarter',   label: 'Questo trimestre' },
  { key: 'last_quarter', label: 'Trimestre scorso' },
  { key: 'year',      label: 'Quest\'anno' },
  { key: 'custom',    label: 'Periodo personalizzato' },
]

export default function ReportPage() {
  const router = useRouter()
  const [selectedModule, setSelectedModule] = useState('generale')
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const handleGenerate = () => {
    const params = new URLSearchParams({ period: selectedPeriod })
    if (selectedPeriod === 'custom') {
      params.set('from', customFrom)
      params.set('to', customTo)
    }
    router.push(`/dashboard/report/${selectedModule}?${params.toString()}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1f2030', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <span style={{ color: '#2a2a3a' }}>|</span>
        <span style={{ fontSize: '20px' }}>📊</span>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f1f1', margin: 0 }}>Report & Analisi</h1>
      </div>

      <div style={{ padding: '40px 32px', maxWidth: '900px', margin: '0 auto' }}>

        {/* Step 1 — Modulo */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#6b7280', letterSpacing: '1px', marginBottom: '16px' }}>1 · SELEZIONA MODULO</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {MODULES.map(m => (
              <div key={m.key} onClick={() => setSelectedModule(m.key)} style={{
                background: selectedModule === m.key ? m.color + '20' : '#111118',
                border: `2px solid ${selectedModule === m.key ? m.color : '#1f2030'}`,
                borderRadius: '14px', padding: '18px 20px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '22px' }}>{m.icon}</span>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: selectedModule === m.key ? m.color : '#f1f1f1' }}>{m.label}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 2 — Periodo */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#6b7280', letterSpacing: '1px', marginBottom: '16px' }}>2 · SELEZIONA PERIODO</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setSelectedPeriod(p.key)} style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px',
                background: selectedPeriod === p.key ? '#f43f5e' : '#111118',
                color: selectedPeriod === p.key ? 'white' : '#9ca3af',
                outline: `1px solid ${selectedPeriod === p.key ? '#f43f5e' : '#1f2030'}`,
                fontWeight: selectedPeriod === p.key ? '600' : '400',
              }}>{p.label}</button>
            ))}
          </div>

          {selectedPeriod === 'custom' && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>DA</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '8px 12px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '14px' }} />
              </div>
              <div style={{ color: '#6b7280', marginTop: '16px' }}>→</div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>A</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '8px 12px', background: '#111118', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1', fontSize: '14px' }} />
              </div>
            </div>
          )}
        </div>

        {/* Genera */}
        <button onClick={handleGenerate} disabled={selectedPeriod === 'custom' && (!customFrom || !customTo)} style={{
          padding: '14px 40px', background: '#f43f5e', color: 'white', border: 'none', borderRadius: '12px',
          cursor: 'pointer', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span>📊</span> Genera Report
        </button>

        {/* Accesso rapido */}
        <div style={{ marginTop: '48px', padding: '24px', background: '#111118', border: '1px solid #1f2030', borderRadius: '16px' }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', fontWeight: '600' }}>⚡ ACCESSO RAPIDO</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {[
              { label: 'Report oggi — Generale', href: '/dashboard/report/generale?period=today' },
              { label: 'Report mese — Hotel', href: '/dashboard/report/hotel?period=month' },
              { label: 'Report mese — Ristorante', href: '/dashboard/report/ristorante?period=month' },
              { label: 'Report mese — Spa', href: '/dashboard/report/spa?period=month' },
              { label: 'Report trimestre — Fatture', href: '/dashboard/report/fatture?period=quarter' },
              { label: 'Report anno — Generale', href: '/dashboard/report/generale?period=year' },
            ].map(q => (
              <Link key={q.href} href={q.href} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '10px 14px', background: '#0a0a0f', border: '1px solid #1f2030', borderRadius: '8px', fontSize: '13px', color: '#9ca3af', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f1f1f1')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                  {q.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
