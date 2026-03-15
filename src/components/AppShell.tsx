'use client'
import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n-context'
import LangSwitcher from './LangSwitcher'

const NAV_GROUPS = [
  {
    label: 'OPÉRATIONS',
    items: [
      { key:'dashboard',    labelKey:'dashboard',   icon:'🏠', href:'/dashboard',                  color:'#7c3aed' },
      { key:'hotel',        labelKey:'hotel',        icon:'🏨', href:'/dashboard/hotel',             color:'#2563eb' },
      { key:'restaurant',   labelKey:'restaurant',   icon:'🍽️', href:'/dashboard/ristorante',        color:'#059669' },
      { key:'spa',          labelKey:'spa',           icon:'💆', href:'/dashboard/spa',               color:'#7c3aed' },
      { key:'padel',        labelKey:'padel',         icon:'🎾', href:'/dashboard/padel',             color:'#d97706' },
    ]
  },
  {
    label: 'BUSINESS',
    items: [
      { key:'crm',          labelKey:'crm',           icon:'🎯', href:'/dashboard/crm',              color:'#db2777' },
      { key:'marketing',    labelKey:'marketing',     icon:'📣', href:'/dashboard/marketing',        color:'#e11d48' },
      { key:'clients',      labelKey:'clients',       icon:'👥', href:'/dashboard/clienti',          color:'#0891b2' },
      { key:'invoices',     labelKey:'invoices',      icon:'🧾', href:'/dashboard/fatture',          color:'#dc2626' },
    ]
  },
  {
    label: 'STRUCTURE',
    items: [
      { key:'planning',     labelKey:'planning',      icon:'📅', href:'/dashboard/planning',         color:'#0891b2' },
      { key:'stock',        labelKey:'stock',         icon:'📦', href:'/dashboard/stock',            color:'#059669' },
      { key:'suppliers',    labelKey:'suppliers',     icon:'🚚', href:'/dashboard/fornitori',        color:'#78716c' },
      { key:'maintenance',  labelKey:'maintenance',   icon:'🔧', href:'/dashboard/manutenzione',     color:'#f59e0b' },
      { key:'website',      labelKey:'website',       icon:'🌐', href:'/dashboard/sito',             color:'#6366f1' },
    ]
  },
  {
    label: 'RH & TEMPS',
    items: [
      { key:'temps',        labelKey:'timesheets',    icon:'⏱️', href:'/dashboard/temps',            color:'#0891b2' },
      { key:'frais',        labelKey:'expenses',      icon:'💰', href:'/dashboard/frais',            color:'#7c3aed' },
      { key:'documents',    labelKey:'documents',     icon:'📄', href:'/dashboard/documents',        color:'#64748b' },
      { key:'sondages',     labelKey:'surveys',       icon:'📋', href:'/dashboard/sondages',         color:'#059669' },
    ]
  },
  {
    label: 'ANALYSES',
    items: [
      { key:'agenda',       labelKey:'agenda',        icon:'📆', href:'/dashboard/agenda',           color:'#e11d48' },
      { key:'reports',      labelKey:'reports',       icon:'📊', href:'/dashboard/report',           color:'#7c3aed' },
      { key:'staff',        labelKey:'staff',         icon:'👔', href:'/dashboard/staff',            color:'#475569' },
    ]
  },
]

interface Props {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  tenantName?: string
  userEmail?: string
  showPOSBar?: boolean // mostra barra rapida POS/KDS ristorante
}

export default function AppShell({ children, title, subtitle, actions, tenantName, userEmail, showPOSBar }: Props) {
  const { t } = useI18n()
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname?.startsWith(href)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:'"DM Sans","Helvetica Neue",sans-serif', background:'#f1f5f9' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      <aside style={{
        width: collapsed ? '56px' : '216px',
        background:'#0f172a',
        display:'flex', flexDirection:'column',
        transition:'width 0.2s cubic-bezier(0.4,0,0.2,1)',
        flexShrink:0, zIndex:30,
        boxShadow:'2px 0 12px rgba(0,0,0,0.2)',
        overflow:'hidden',
      }}>
        {/* Logo */}
        <div onClick={()=>setCollapsed(v=>!v)} style={{
          padding: collapsed ? '14px 0' : '14px 16px',
          display:'flex', alignItems:'center', gap:'10px',
          borderBottom:'1px solid rgba(255,255,255,0.06)',
          cursor:'pointer', justifyContent:collapsed?'center':'flex-start',
          flexShrink:0,
        }}>
          <div style={{ width:'32px', height:'32px', background:'linear-gradient(135deg,#7c3aed,#2563eb)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M10 1L19 7V19H13V13H7V19H1V7L10 1Z" fill="white"/>
            </svg>
          </div>
          {!collapsed && (
            <div style={{ flex:1, overflow:'hidden' }}>
              <div style={{ fontSize:'15px', fontWeight:'700', color:'#f8fafc', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>Nexly</div>
              {tenantName && <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:'1px' }}>{tenantName}</div>}
            </div>
          )}
          {!collapsed && <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.15)', flexShrink:0 }}>⟵</span>}
        </div>

        {/* Nav groups */}
        <nav style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:'6px 0', scrollbarWidth:'none' }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom:'4px' }}>
              {!collapsed && (
                <div style={{ padding:'8px 16px 4px', fontSize:'9px', fontWeight:'700', color:'rgba(255,255,255,0.2)', letterSpacing:'0.1em' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const active = isActive(item.href)
                return (
                  <Link key={item.key} href={item.href} title={collapsed ? t(item.labelKey) : undefined} style={{ textDecoration:'none', display:'block' }}>
                    <div style={{
                      display:'flex', alignItems:'center', gap:'10px',
                      padding: collapsed ? '9px 0' : '8px 14px',
                      margin:'1px 6px', borderRadius:'8px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active ? `${item.color}22` : 'transparent',
                      borderLeft: active ? `3px solid ${item.color}` : '3px solid transparent',
                      transition:'background 0.1s',
                      cursor:'pointer',
                    }}
                      onMouseEnter={e=>{ if(!active) e.currentTarget.style.background='rgba(255,255,255,0.05)' }}
                      onMouseLeave={e=>{ if(!active) e.currentTarget.style.background='transparent' }}>
                      <span style={{ fontSize:'15px', flexShrink:0, opacity:active?1:0.55, lineHeight:1 }}>{item.icon}</span>
                      {!collapsed && (
                        <span style={{ fontSize:'12.5px', fontWeight:active?'600':'400', color:active?'#f8fafc':'rgba(255,255,255,0.5)', flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {t(item.labelKey)}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'6px 0', flexShrink:0 }}>
          {[
            { icon:'⚙️', label:t('settings'), href:'/dashboard/settings' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration:'none', display:'block' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:collapsed?'9px 0':'8px 14px', margin:'1px 6px', borderRadius:'8px', justifyContent:collapsed?'center':'flex-start', cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{ fontSize:'14px', opacity:0.4 }}>{item.icon}</span>
                {!collapsed && <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.35)' }}>{item.label}</span>}
              </div>
            </Link>
          ))}
          <div onClick={logout} style={{ display:'flex', alignItems:'center', gap:'10px', padding:collapsed?'9px 0':'8px 14px', margin:'1px 6px', borderRadius:'8px', justifyContent:collapsed?'center':'flex-start', cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{ fontSize:'14px', opacity:0.4 }}>↩</span>
            {!collapsed && <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.35)' }}>{t('logout')}</span>}
          </div>
        </div>
      </aside>

      {/* ── CONTENT AREA ─────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* TOP BAR */}
        <header style={{ height:'52px', background:'white', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', padding:'0 20px', gap:'12px', flexShrink:0, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
          {title && (
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
              <h1 style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', margin:0 }}>{title}</h1>
              {subtitle && <span style={{ fontSize:'12px', color:'#94a3b8' }}>· {subtitle}</span>}
            </div>
          )}
          {!title && <div style={{ flex:1 }} />}

          {/* POS / KDS quick links — sempre visibili su tutte le pagine */}
          {true && (
            <div style={{ display:'flex', gap:'6px' }}>
              <Link href="/dashboard/ristorante/pos" style={{ padding:'5px 12px', background:'#f0fdf4', border:'1px solid #86efac', color:'#16a34a', borderRadius:'7px', textDecoration:'none', fontSize:'11px', fontWeight:'700', display:'flex', alignItems:'center', gap:'4px' }}>
                🧾 POS
              </Link>
              <Link href="/dashboard/ristorante/kds" style={{ padding:'5px 12px', background:'#fffbeb', border:'1px solid #fcd34d', color:'#d97706', borderRadius:'7px', textDecoration:'none', fontSize:'11px', fontWeight:'700', display:'flex', alignItems:'center', gap:'4px' }}>
                📺 KDS
              </Link>
            </div>
          )}

          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            {actions}
            <LangSwitcher dark={false} />
            {userEmail && (
              <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'linear-gradient(135deg,#7c3aed,#2563eb)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'12px', fontWeight:'700', cursor:'pointer', flexShrink:0 }}
                title={userEmail}>
                {userEmail.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main style={{ flex:1, overflowY:'auto', background:'#f1f5f9' }}>
          {children}
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        nav::-webkit-scrollbar { display:none; }
      `}</style>
    </div>
  )
}
