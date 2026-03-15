'use client'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { Lang, LANG_LABELS } from '@/lib/i18n'

export default function LangSwitcher({ dark = true }: { dark?: boolean }) {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)

  const select = (l: Lang) => { setLang(l); setOpen(false) }

  const bg = dark ? '#111118' : 'white'
  const border = dark ? '#2a2a3a' : '#e8e6e1'
  const text = dark ? '#9ca3af' : '#6b6760'

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        padding: '6px 10px', background: bg, border: `1px solid ${border}`,
        borderRadius: '7px', color: text, cursor: 'pointer', fontSize: '12px',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        {LANG_LABELS[lang].split(' ')[0]} <span style={{ fontSize: '10px' }}>▾</span>
      </button>
      {open && (
        <>
          {/* Overlay */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '4px',
            background: dark ? '#1f2030' : 'white', border: `1px solid ${border}`,
            borderRadius: '10px', overflow: 'hidden', zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: '140px',
          }}>
            {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([l, label]) => (
              <button key={l} onClick={() => select(l)} style={{
                display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left',
                background: l === lang ? (dark ? '#2a2a3a' : '#f5f5f3') : 'transparent',
                border: 'none', color: l === lang ? (dark ? '#f1f1f1' : '#1a1a1a') : text,
                cursor: 'pointer', fontSize: '13px',
              }}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
