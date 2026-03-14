'use client'
import { useState, useRef, useEffect } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string; ts?: string }
type ChatType = 'support' | 'bug' | 'feature'

const TYPE_CFG = {
  support: { label: '💬 Aide',        color: '#1a1a1a' },
  bug:     { label: '🐛 Bug',         color: '#dc2626' },
  feature: { label: '✨ Suggestion',  color: '#7c3aed' },
}

const GREET: Record<ChatType, string> = {
  support: "Bonjour ! 👋 Je suis votre assistant Nexly Hub. Comment puis-je vous aider avec votre abonnement ou portail ?",
  bug:     "Bonjour ! 🐛 Décrivez le bug : sur quelle page, que s'est-il passé ?",
  feature: "Bonjour ! ✨ Quelle fonctionnalité aimeriez-vous voir sur Nexly Hub ?",
}

export default function SupportChat({ tenantId }: { tenantId?: string }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ChatType>('support')
  const [messages, setMessages] = useState<Record<ChatType, Msg[]>>({
    support: [{ role: 'assistant', content: GREET.support }],
    bug: [{ role: 'assistant', content: GREET.bug }],
    feature: [{ role: 'assistant', content: GREET.feature }],
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Msg = { role: 'user', content: text, ts: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
    const newMsgs = [...messages[tab], userMsg]
    setMessages(prev => ({ ...prev, [tab]: newMsgs }))
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
          tenantId,
          type: tab,
        })
      })
      const data = await res.json()
      const aiMsg: Msg = {
        role: 'assistant',
        content: data.response || '❌ Erreur de connexion.',
        ts: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => ({ ...prev, [tab]: [...newMsgs, aiMsg] }))
    } catch {
      setMessages(prev => ({ ...prev, [tab]: [...newMsgs, { role: 'assistant', content: '❌ Erreur. Réessayez.' }] }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Bubble */}
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
        width: '52px', height: '52px', borderRadius: '50%',
        background: open ? '#1a1a1a' : 'white',
        border: '2px solid #1a1a1a',
        cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', transition: 'all 0.2s',
      }}>
        <span style={{ color: open ? 'white' : '#1a1a1a' }}>{open ? '✕' : '💬'}</span>
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: '86px', right: '24px', zIndex: 1000,
          width: '350px', maxHeight: '520px',
          background: 'white', border: '1px solid #e8e6e1', borderRadius: '16px',
          boxShadow: '0 16px 50px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: "'system-ui', sans-serif",
          animation: 'slideUp 0.2s ease',
        }}>
          <style>{`
            @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
            @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
            .sc-input:focus { outline:none; border-color:#1a1a1a !important; }
          `}</style>

          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0ede8', background: '#fafaf9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🤖</div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#1a1a1a' }}>Nexly Assistant</div>
                <div style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} /> En ligne
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(Object.keys(TYPE_CFG) as ChatType[]).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '5px 4px', borderRadius: '8px',
                  border: `1.5px solid ${tab === t ? TYPE_CFG[t].color : '#e8e6e1'}`,
                  cursor: 'pointer', fontSize: '10px', fontWeight: tab === t ? '600' : '400',
                  background: tab === t ? TYPE_CFG[t].color : 'white',
                  color: tab === t ? 'white' : '#6b6760',
                  transition: 'all 0.15s',
                }}>
                  {TYPE_CFG[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '180px', maxHeight: '290px', background: 'white' }}>
            {messages[tab].map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '6px' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0, marginTop: '2px' }}>🤖</div>
                )}
                <div style={{
                  maxWidth: '80%', padding: '9px 12px', lineHeight: '1.5', fontSize: '13px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? '#1a1a1a' : '#f5f5f3',
                  color: msg.role === 'user' ? 'white' : '#1a1a1a',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                  {msg.ts && <div style={{ fontSize: '10px', color: msg.role === 'user' ? 'rgba(255,255,255,0.5)' : '#9a9690', marginTop: '3px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>{msg.ts}</div>}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>🤖</div>
                <div style={{ background: '#f5f5f3', borderRadius: '14px', padding: '10px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0,1,2].map(d => <div key={d} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#9a9690', animation: `bounce 1s ${d*0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #f0ede8', display: 'flex', gap: '8px', background: '#fafaf9' }}>
            <input
              className="sc-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Votre message..."
              style={{
                flex: 1, padding: '9px 12px',
                background: 'white', border: '1px solid #e8e6e1',
                borderRadius: '10px', color: '#1a1a1a', fontSize: '13px',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                padding: '9px 14px', borderRadius: '10px', border: 'none',
                background: input.trim() && !loading ? TYPE_CFG[tab].color : '#e8e6e1',
                color: 'white', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                fontSize: '16px', transition: 'background 0.15s',
              }}
            >
              ➤
            </button>
          </div>

          <div style={{ padding: '6px', background: '#fafaf9', borderTop: '1px solid #f0ede8', textAlign: 'center', fontSize: '10px', color: '#c0bdb8' }}>
            Propulsé par Claude AI · <a href="mailto:support@nexlyhub.com" style={{ color: '#8a8680' }}>support@nexlyhub.com</a>
          </div>
        </div>
      )}
    </>
  )
}
