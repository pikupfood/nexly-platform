'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Lang, LANG_LABELS, t, loadLang, saveLang } from '@/lib/i18n'

const ALL_MODULES = [
  { key: 'hotel',      label: 'hotel',      icon: '🏨', href: '/dashboard/hotel',      color: '#3b82f6' },
  { key: 'restaurant', label: 'restaurant', icon: '🍽️', href: '/dashboard/ristorante', color: '#10b981' },
  { key: 'spa',        label: 'spa',        icon: '💆', href: '/dashboard/spa',         color: '#8b5cf6' },
  { key: 'padel',      label: 'padel',      icon: '🎾', href: '/dashboard/padel',       color: '#f59e0b' },
  { key: 'clients',    label: 'clients',    icon: '👥', href: '/dashboard/clienti',     color: '#ec4899' },
  { key: 'invoices',   label: 'invoices',   icon: '🧾', href: '/dashboard/fatture',     color: '#ef4444' },
  { key: 'agenda',     label: 'agenda',     icon: '📆', href: '/dashboard/agenda',      color: '#f43f5e' },
  { key: 'reports',    label: 'reports',    icon: '📊', href: '/dashboard/report',      color: '#a855f7' },
]

export default function StaffDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState<Lang>('fr')
  const [showLang, setShowLang] = useState(false)

  useEffect(() => {
    const saved = loadLang()
    setLang(saved)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/staff/login'); return }

      const { data: prof } = await supabase.rpc('get_staff_profile', { p_user_id: session.user.id })
      if (!prof) {
        // Non è staff — è il proprietario, vai alla dashboard normale
        router.replace('/dashboard')
        return
      }

      setProfile(prof)
      // Imposta la lingua dello staff
      if (prof.language) {
        setLang(prof.language as Lang)
        saveLang(prof.language as Lang)
      }
      setLoading(false)
    })
  }, [])

  const tr = (key: string) => t(key, lang)

  const accessibleModules = ALL_MODULES.filter(m => (profile?.modules || []).includes(m.key))
  const isReadOnly = profile?.role === 'readonly'

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace('/staff/login')
  }

  const changeLang = (l: Lang) => {
    setLang(l)
    saveLang(l)
    setShowLang(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1f2030', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#0a0a0f', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '14px' }}>N</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f1f1' }}>{profile?.tenant?.business_name || 'Nexly Hub'}</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{profile?.first_name} {profile?.last_name} · {profile?.role}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Lang switcher */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowLang(v => !v)} style={{ padding: '6px 10px', background: '#111118', border: '1px solid #2a2a3a', color: '#9ca3af', borderRadius: '7px', cursor: 'pointer', fontSize: '12px' }}>
              {LANG_LABELS[lang]?.split(' ')[0]} ▾
            </button>
            {showLang && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#1f2030', border: '1px solid #2a2a3a', borderRadius: '10px', overflow: 'hidden', zIndex: 100, minWidth: '140px' }}>
                {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([l, label]) => (
                  <button key={l} onClick={() => changeLang(l)} style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', background: l === lang ? '#2a2a3a' : 'transparent', border: 'none', color: l === lang ? '#f1f1f1' : '#9ca3af', cursor: 'pointer', fontSize: '12px' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={logout} style={{ padding: '6px 12px', background: 'none', border: '1px solid #2a2a3a', color: '#6b7280', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
            {tr('logout')}
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: '900px', margin: '0 auto' }}>

        {/* Saluto */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#f1f1f1', margin: '0 0 4px' }}>
            {tr('hello')}, {profile?.first_name} 👋
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            {new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'it' ? 'it-IT' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Badge ruolo */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', background: '#3b82f620', color: '#60a5fa', padding: '4px 12px', borderRadius: '10px', fontWeight: '500' }}>
            👔 {profile?.role === 'manager' ? tr('manager') : profile?.role === 'readonly' ? tr('readonly') : 'Staff'}
          </span>
          <span style={{ fontSize: '12px', background: '#1f2030', color: '#6b7280', padding: '4px 12px', borderRadius: '10px' }}>
            {accessibleModules.length} {tr('modules')}
          </span>
          {isReadOnly && (
            <span style={{ fontSize: '12px', background: '#f59e0b20', color: '#f59e0b', padding: '4px 12px', borderRadius: '10px' }}>
              👁️ {tr('readonly')}
            </span>
          )}
        </div>

        {/* Moduli accessibili */}
        {accessibleModules.length === 0 ? (
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
            <div style={{ fontSize: '15px', color: '#6b7280' }}>Aucun module accessible. Contactez votre responsable.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', fontWeight: '500', letterSpacing: '0.05em' }}>
              {tr('modules').toUpperCase()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: '12px' }}>
              {accessibleModules.map(m => (
                <Link key={m.key} href={m.href} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#111118', border: `1px solid ${m.color}30`, borderRadius: '14px', padding: '22px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = m.color + '30'; e.currentTarget.style.transform = 'translateY(0)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '10px' }}>{m.icon}</div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#f1f1f1', marginBottom: '4px' }}>{tr(m.label)}</div>
                    <div style={{ fontSize: '11px', color: m.color }}>
                      {isReadOnly ? '👁️ Consulter' : 'Accéder →'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: '40px', padding: '14px 18px', background: '#111118', border: '1px solid #1f2030', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: '#4b5563' }}>
            Propulsé par <span style={{ color: '#6b7280' }}>Nexly Hub</span>
          </div>
          <div style={{ fontSize: '12px', color: '#4b5563' }}>
            {profile?.tenant?.business_name}
          </div>
        </div>
      </div>
    </div>
  )
}
