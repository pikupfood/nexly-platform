'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'
import { useStaffNav } from '@/lib/useStaffNav'
import { Lang, LANG_LABELS, loadLang } from '@/lib/i18n'

const MODULES_CFG = [
  { key: 'hotel',      label: 'Hôtel',      icon: '🏨', color: '#3b82f6' },
  { key: 'restaurant', label: 'Restaurant', icon: '🍽️', color: '#10b981' },
  { key: 'spa',        label: 'Spa',        icon: '💆', color: '#8b5cf6' },
  { key: 'padel',      label: 'Padel',      icon: '🎾', color: '#f59e0b' },
  { key: 'clients',    label: 'Clients',    icon: '👥', color: '#ec4899' },
  { key: 'invoices',   label: 'Factures',   icon: '🧾', color: '#ef4444' },
  { key: 'agenda',     label: 'Agenda',     icon: '📆', color: '#f43f5e' },
  { key: 'reports',    label: 'Rapports',   icon: '📊', color: '#a855f7' },
]

const ROLES = [
  { key: 'manager',  label: '👔 Responsable', desc: 'Peut modifier les données' },
  { key: 'staff',    label: '👤 Staff',        desc: 'Peut créer et modifier' },
  { key: 'readonly', label: '👁️ Lecture seule', desc: 'Peut seulement consulter' },
]

const EMPTY = {
  email: '', first_name: '', last_name: '',
  role: 'staff', modules: [] as string[], language: 'fr' as Lang,
}

export default function StaffPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { backHref } = useStaffNav()
  const [staffList, setStaffList] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<{ email: string; url: string; sent: boolean } | null>(null)
  const [lang] = useState<Lang>(loadLang())

  const LOGIN_URL = typeof window !== 'undefined'
    ? `${window.location.origin}/staff/login`
    : 'https://nexly-hub-2.vercel.app/staff/login'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      load()
    })
  }, [])

  const load = async () => {
    const { data } = await supabase.rpc('list_staff_members')
    setStaffList(data || [])
    setLoading(false)
  }

  const save = async () => {
    if (!form.email || !form.first_name || !form.last_name || form.modules.length === 0) return
    setSaving(true)
    if (editId) {
      const { error } = await supabase.rpc('update_staff_member', {
        p_id: editId, p_role: form.role, p_modules: form.modules,
        p_language: form.language, p_is_active: true,
      })
      if (error) { alert('Erreur: ' + error.message); setSaving(false); return }
      setStaffList(prev => prev.map(s => s.id === editId ? { ...s, ...form } : s))
    } else {
      // 1. Salva nel DB
      const { data: dbData, error: dbError } = await supabase.rpc('invite_staff_member', {
        p_email: form.email, p_first_name: form.first_name, p_last_name: form.last_name,
        p_role: form.role, p_modules: form.modules, p_language: form.language,
      })
      if (dbError) { alert('Erreur: ' + dbError.message); setSaving(false); return }

      // 2. Invia email di invito via API
      const res = await fetch('/api/staff-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email, first_name: form.first_name,
          last_name: form.last_name, role: form.role,
          modules: form.modules, language: form.language,
        })
      })
      const result = await res.json()

      if (result.method === 'invite_sent') {
        setInviteResult({ email: form.email, url: result.login_url, sent: true })
      } else if (result.method === 'manual' || result.method === 'existing') {
        setInviteResult({ email: form.email, url: result.login_url || LOGIN_URL + '?email=' + encodeURIComponent(form.email), sent: false })
      }
      await load()
    }
    setShowForm(false)
    setEditId(null)
    setForm({ ...EMPTY })
    setSaving(false)
  }

  const startEdit = (s: any) => {
    setForm({ email: s.email, first_name: s.first_name, last_name: s.last_name, role: s.role, modules: s.modules || [], language: s.language || 'fr' })
    setEditId(s.id)
    setShowForm(true)
  }

  const toggleActive = async (s: any) => {
    const { error } = await supabase.rpc('update_staff_member', {
      p_id: s.id, p_role: s.role, p_modules: s.modules,
      p_language: s.language, p_is_active: !s.is_active,
    })
    if (!error) setStaffList(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
  }

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce membre ?')) return
    const { error } = await supabase.rpc('delete_staff_member', { p_id: id })
    if (!error) setStaffList(prev => prev.filter(s => s.id !== id))
    else alert('Erreur: ' + error.message)
  }

  const copyInviteLink = (email: string) => {
    const url = `${LOGIN_URL}?email=${encodeURIComponent(email)}`
    navigator.clipboard?.writeText(url)
    setCopyStatus(email)
    setTimeout(() => setCopyStatus(null), 2000)
  }

  const toggleModule = (key: string) => {
    setForm(prev => ({
      ...prev,
      modules: prev.modules.includes(key)
        ? prev.modules.filter(m => m !== key)
        : [...prev.modules, key],
    }))
  }

  const IS: any = { padding: '8px 10px', background: '#1f2030', border: '1px solid #2a2a3a', borderRadius: '7px', color: '#f1f1f1', fontSize: '13px', width: '100%', boxSizing: 'border-box', outline: 'none' }
  const LS: any = { fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }

  if (loading) return <div style={{ minHeight: '100vh', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280' }}>Caricamento...</div></div>

  return (
    <AppShell title="Équipe" tenantName={tenant?.business_name} userEmail={user?.email}>
      {/* Header */}
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm({ ...EMPTY }) }}
          style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
          {showForm && !editId ? '✕ Annuler' : '+ Inviter un membre'}
        </button>

      <div style={{ padding: '20px 24px' }}>

        {/* Risultato invito */}
        {inviteResult && (
          <div style={{ background: inviteResult.sent ? '#1a3a1a' : '#1a2a3a', border: `1px solid ${inviteResult.sent ? '#10b981' : '#3b82f6'}40`, borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '20px' }}>{inviteResult.sent ? '✅' : '🔗'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: inviteResult.sent ? '#34d399' : '#60a5fa', marginBottom: '4px' }}>
                {inviteResult.sent ? 'Email di invito inviata!' : 'Copia il link di accesso'}
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                {inviteResult.sent
                  ? `Un'email è stata inviata a ${inviteResult.email} con il link per accedere.`
                  : `Invia questo link a ${inviteResult.email} — puoi farlo via email o WhatsApp:`}
              </div>
              {!inviteResult.sent && (
                <div style={{ background: 'white', border: '1px solid #2a2a3a', borderRadius: '6px', padding: '8px 12px', fontSize: '11px', fontFamily: 'monospace', color: '#9ca3af', wordBreak: 'break-all' }}>
                  {inviteResult.url}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {!inviteResult.sent && (
                <button onClick={() => { navigator.clipboard?.writeText(inviteResult.url); setCopyStatus('invite') }}
                  style={{ padding: '6px 12px', background: copyStatus === 'invite' ? '#10b98130' : '#1f2030', color: copyStatus === 'invite' ? '#10b981' : '#9ca3af', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                  {copyStatus === 'invite' ? '✓' : '📋 Copia link'}
                </button>
              )}
              <button onClick={() => setInviteResult(null)} style={{ padding: '6px 8px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '14px' }}>✕</button>
            </div>
          </div>
        )}

        {/* Info portale invito */}}
        <div style={{ background: '#1a2a1a', border: '1px solid #10b98140', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '18px' }}>🔗</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#34d399', marginBottom: '2px' }}>URL de connexion staff</div>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#6b7280' }}>{LOGIN_URL}</div>
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(LOGIN_URL); setCopyStatus('url') }}
            style={{ padding: '6px 12px', background: copyStatus === 'url' ? '#10b98130' : '#1f2030', color: copyStatus === 'url' ? '#10b981' : '#9ca3af', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
            {copyStatus === 'url' ? '✓ Copié' : '📋 Copier'}
          </button>
        </div>

        {/* Form invito/modifica */}
        {showForm && (
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' }}>
            <h3 style={{ color: '#f1f1f1', fontSize: '14px', fontWeight: '600', margin: '0 0 16px' }}>
              {editId ? '✏️ Modifier le membre' : '📧 Inviter un membre'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={LS}>Email *</label>
                <input style={{ ...IS, background: editId ? '#0a0a0f' : '#1f2030' }} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="staff@email.com" disabled={!!editId} />
              </div>
              <div>
                <label style={LS}>Prénom *</label>
                <input style={IS} value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Marie" />
              </div>
              <div>
                <label style={LS}>Nom *</label>
                <input style={IS} value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Dupont" />
              </div>
              <div>
                <label style={LS}>Langue interface</label>
                <select style={IS} value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value as Lang }))}>
                  {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([l, label]) => (
                    <option key={l} value={l}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ruolo */}
            <div style={{ marginBottom: '16px' }}>
              <label style={LS}>Rôle</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ROLES.map(r => (
                  <div key={r.key} onClick={() => setForm(p => ({ ...p, role: r.key }))}
                    style={{ padding: '10px 16px', background: form.role === r.key ? '#3b82f620' : '#1f2030', border: `1px solid ${form.role === r.key ? '#3b82f6' : '#2a2a3a'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: form.role === r.key ? '#60a5fa' : '#f1f1f1' }}>{r.label}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Moduli */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...LS, marginBottom: '8px' }}>Modules accessibles * (sélectionner au moins 1)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: '8px' }}>
                {MODULES_CFG.map(m => {
                  const selected = form.modules.includes(m.key)
                  return (
                    <div key={m.key} onClick={() => toggleModule(m.key)}
                      style={{ padding: '10px 12px', background: selected ? `${m.color}20` : '#1f2030', border: `1px solid ${selected ? m.color : '#2a2a3a'}`, borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}>
                      <span style={{ fontSize: '16px' }}>{m.icon}</span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: selected ? m.color : '#f1f1f1' }}>{m.label}</div>
                        {selected && <div style={{ fontSize: '9px', color: m.color }}>✓ Accès</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={!form.email || !form.first_name || !form.last_name || form.modules.length === 0 || saving}
                style={{ padding: '8px 20px', background: form.email && form.first_name && form.modules.length > 0 ? '#3b82f6' : '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {saving ? 'Saving...' : editId ? '✓ Mettre à jour' : '📧 Inviter'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); setForm({ ...EMPTY }) }}
                style={{ padding: '8px 16px', background: 'none', border: '1px solid #2a2a3a', color: '#6b7280', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                Annuler
              </button>
            </div>

            {!editId && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#1a2a3a', border: '1px solid #2a4a6a', borderRadius: '8px', fontSize: '12px', color: '#6b7280' }}>
                💡 Après l'invitation, le membre devra créer un compte sur <strong style={{ color: '#60a5fa' }}>{LOGIN_URL}</strong> avec l'email indiqué.
              </div>
            )}
          </div>
        )}

        {/* Lista staff */}
        {staffList.length === 0 ? (
          <div style={{ background: '#111118', border: '1px solid #1f2030', borderRadius: '14px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#f1f1f1', marginBottom: '6px' }}>Aucun membre d'équipe</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>Invitez des membres pour gérer vos modules</div>
            <button onClick={() => setShowForm(true)} style={{ padding: '8px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
              + Inviter le premier membre
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {staffList.map(s => (
              <div key={s.id} style={{ background: '#111118', border: `1px solid ${s.is_active ? '#1f2030' : '#374151'}`, borderRadius: '14px', padding: '18px 22px', opacity: s.is_active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  {/* Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#3b82f620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: '#60a5fa', flexShrink: 0 }}>
                      {(s.first_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f1f1' }}>
                        {s.first_name} {s.last_name}
                        {!s.user_id && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#f59e0b20', color: '#f59e0b', padding: '1px 7px', borderRadius: '8px' }}>⏳ En attente</span>}
                        {!s.is_active && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#ef444420', color: '#ef4444', padding: '1px 7px', borderRadius: '8px' }}>Désactivé</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {s.email} · {LANG_LABELS[s.language as Lang] || s.language}
                      </div>
                      {s.last_login && (
                        <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '1px' }}>
                          Dernier login: {new Date(s.last_login).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ruolo + azioni */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Badge ruolo */}
                    <span style={{ fontSize: '12px', background: '#3b82f620', color: '#60a5fa', padding: '3px 10px', borderRadius: '8px', fontWeight: '500' }}>
                      {ROLES.find(r => r.key === s.role)?.label || s.role}
                    </span>
                    {/* Azioni */}
                    <button onClick={() => startEdit(s)} style={{ padding: '5px 10px', background: '#1f2030', border: '1px solid #2a2a3a', color: '#9ca3af', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                    <button onClick={() => copyInviteLink(s.email)} style={{ padding: '5px 10px', background: copyStatus === s.email ? '#10b98120' : '#1f2030', border: `1px solid ${copyStatus === s.email ? '#10b98140' : '#2a2a3a'}`, color: copyStatus === s.email ? '#10b981' : '#9ca3af', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      {copyStatus === s.email ? '✓' : '🔗'}
                    </button>
                    <button onClick={() => toggleActive(s)} style={{ padding: '5px 10px', background: s.is_active ? '#ef444420' : '#10b98120', border: `1px solid ${s.is_active ? '#ef444440' : '#10b98140'}`, color: s.is_active ? '#ef4444' : '#10b981', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      {s.is_active ? '⏸ Désactiver' : '▶ Activer'}
                    </button>
                    <button onClick={() => remove(s.id)} style={{ padding: '5px 10px', background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                  </div>
                </div>

                {/* Moduli accessibili */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {MODULES_CFG.map(m => {
                    const hasAccess = (s.modules || []).includes(m.key)
                    return (
                      <span key={m.key} style={{
                        fontSize: '11px', padding: '3px 10px', borderRadius: '8px',
                        background: hasAccess ? `${m.color}20` : '#1f2030',
                        color: hasAccess ? m.color : '#374151',
                        border: `1px solid ${hasAccess ? m.color + '40' : '#2a2a3a'}`,
                        fontWeight: hasAccess ? '500' : '400',
                      }}>
                        {m.icon} {m.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
