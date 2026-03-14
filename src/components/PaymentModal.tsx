'use client'
import { useState } from 'react'

export interface PaymentResult {
  method: string      // 'cash' | 'card' | 'check' | 'transfer' | 'other' | 'complimentary'
  note: string        // dettaglio per 'other' o motivo per 'complimentary'
  isComplimentary: boolean
}

interface PaymentModalProps {
  title: string           // es. "Pagamento Tavolo T3"
  amount: number          // importo da pagare
  onConfirm: (result: PaymentResult) => void
  onCancel: () => void
}

const METHODS = [
  { key: 'card',     label: 'Carta di credito', icon: '💳' },
  { key: 'cash',     label: 'Contanti',          icon: '💵' },
  { key: 'check',    label: 'Assegno',           icon: '📝' },
  { key: 'transfer', label: 'Bonifico',           icon: '🏦' },
  { key: 'other',    label: 'Altro',              icon: '🔧' },
]

export default function PaymentModal({ title, amount, onConfirm, onCancel }: PaymentModalProps) {
  const [method, setMethod] = useState('card')
  const [note, setNote] = useState('')
  const [isComplimentary, setIsComplimentary] = useState(false)
  const [compReason, setCompReason] = useState('')

  const canConfirm = isComplimentary
    ? true
    : method !== 'other' || note.trim().length > 0

  const handleConfirm = () => {
    onConfirm({
      method: isComplimentary ? 'complimentary' : method,
      note: isComplimentary ? compReason : note,
      isComplimentary,
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: '20px',
    }}>
      <div style={{
        background: '#111118', border: '1px solid #2a2a3a',
        borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '420px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>MODALITÀ DI PAGAMENTO</div>
          <div style={{ fontSize: '17px', fontWeight: '600', color: '#f1f1f1' }}>{title}</div>
          {!isComplimentary && (
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#f1f1f1', marginTop: '8px' }}>
              €{Number(amount).toFixed(2)}
            </div>
          )}
        </div>

        {/* Toggle offerto */}
        <div
          onClick={() => { setIsComplimentary(!isComplimentary); setMethod('card') }}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
            marginBottom: '20px',
            background: isComplimentary ? '#7c3aed20' : '#0a0a0f',
            border: `2px solid ${isComplimentary ? '#7c3aed' : '#2a2a3a'}`,
            transition: 'all 0.15s',
          }}
        >
          <div style={{
            width: '22px', height: '22px', borderRadius: '6px',
            background: isComplimentary ? '#7c3aed' : 'transparent',
            border: `2px solid ${isComplimentary ? '#7c3aed' : '#4b5563'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {isComplimentary && <span style={{ color: 'white', fontSize: '14px', lineHeight: 1 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: isComplimentary ? '#a78bfa' : '#9ca3af' }}>
              🎁 Offerto dalla casa
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '1px' }}>
              Fattura con importo €0 — non contato nei ricavi
            </div>
          </div>
        </div>

        {isComplimentary ? (
          /* Motivo offerto */
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
              Motivo (opzionale)
            </label>
            <input
              value={compReason}
              onChange={e => setCompReason(e.target.value)}
              placeholder="es. Cliente VIP, disservizio, regalo..."
              style={{
                width: '100%', padding: '10px 14px', background: '#0a0a0f',
                border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f1f1f1',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        ) : (
          /* Metodi pagamento */
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>
              Come ha pagato il cliente?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {METHODS.map(m => (
                <div
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                    background: method === m.key ? '#3b82f620' : '#0a0a0f',
                    border: `1.5px solid ${method === m.key ? '#3b82f6' : '#2a2a3a'}`,
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: `2px solid ${method === m.key ? '#3b82f6' : '#4b5563'}`,
                    background: method === m.key ? '#3b82f6' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {method === m.key && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                  </div>
                  <span style={{ fontSize: '16px' }}>{m.icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: method === m.key ? '600' : '400', color: method === m.key ? '#f1f1f1' : '#9ca3af' }}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Campo note per "Altro" */}
            {method === 'other' && (
              <div style={{ marginTop: '12px' }}>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Specifica modalità di pagamento..."
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 14px', background: '#0a0a0f',
                    border: '1px solid #3b82f6', borderRadius: '8px', color: '#f1f1f1',
                    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Bottoni */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px', background: '#1f2030',
              color: '#9ca3af', border: '1px solid #2a2a3a',
              borderRadius: '10px', cursor: 'pointer', fontSize: '14px',
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              flex: 2, padding: '12px',
              background: isComplimentary
                ? (canConfirm ? '#7c3aed' : '#1f2030')
                : (canConfirm ? '#10b981' : '#1f2030'),
              color: 'white', border: 'none',
              borderRadius: '10px', cursor: canConfirm ? 'pointer' : 'not-allowed',
              fontSize: '14px', fontWeight: '700',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {isComplimentary ? '🎁 Conferma Offerto' : `✓ Conferma Pagamento`}
          </button>
        </div>
      </div>
    </div>
  )
}
