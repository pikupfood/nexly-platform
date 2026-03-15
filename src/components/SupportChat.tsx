'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'

type Msg = { role: 'user' | 'assistant'; content: string; ts?: string; actions?: Action[] }
type ChatType = 'support' | 'bug' | 'feature'
type Action = { type: 'vai' | 'aggiorna' | 'contatta' | 'email'; value?: string; label: string }

const TYPE_CFG = {
  support: { label: '💬 Assistente', color: '#3b82f6' },
  bug:     { label: '🐛 Bug',        color: '#ef4444' },
  feature: { label: '✨ Idea',       color: '#8b5cf6' },
}

const QUICK_QUESTIONS = [
  "Quante camere libere oggi?",
  "Chi fa check-in oggi?",
  "Appuntamenti spa di oggi",
  "Revenue di questo mese",
  "Come aggiungo una prenotazione?",
  "Prenotazioni padel di oggi",
]

function parseActions(text: string): { cleanText: string; actions: Action[] } {
  const actions: Action[] = []
  let cleanText = text
  const re = /\[AZIONE:([^\]:]+)(?::([^\]:]+))?(?::([^\]]+))?\]/g
  let match
  while ((match = re.exec(text)) !== null) {
    const type = match[1] as Action['type']
    const value = match[2]
    const label = match[3]
    if (type === 'vai' && value) {
      actions.push({ type:'vai', value, label: label || `→ ${value.split('/').filter(Boolean).pop()?.replace(/-/g,' ')}` })
    } else if (type === 'aggiorna') {
      actions.push({ type:'aggiorna', label: '↻ Aggiorna' })
    } else if (type === 'contatta') {
      actions.push({ type:'contatta', label: '📧 Supporto' })
    }
    cleanText = cleanText.replace(match[0], '')
  }
  return { cleanText: cleanText.trim(), actions }
}

export default function SupportChat() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ChatType>('support')
  const [messages, setMessages] = useState<Record<ChatType, Msg[]>>({
    support: [{ role:'assistant', content:"Ciao! 👋 Sono **NexlyAI**. Ho accesso completo ai dati della tua struttura in tempo reale.\n\nPosso rispondere su prenotazioni, statistiche, clienti, staff, e guidarti in ogni operazione. Come posso aiutarti?" }],
    bug:     [{ role:'assistant', content:"🐛 Descrivi il problema: su quale pagina si trova, cosa è successo e cosa ti aspettavi di vedere." }],
    feature: [{ role:'assistant', content:"✨ Quale funzionalità ti renderebbe il lavoro più facile? Ogni idea viene valutata dal team di Nexly." }],
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tenantId, setTenantId] = useState<string|null>(null)
  const [unread, setUnread] = useState(0)
  const [minimized, setMinimized] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { getTenantId().then(id => setTenantId(id)) }, [])
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages, open])

  const send = async (overrideText?: string) => {
    const text = (overrideText || input).trim()
    if (!text || loading) return

    const ts = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
    const userMsg: Msg = { role:'user', content:text, ts }
    const newMsgs = [...messages[tab], userMsg]
    setMessages(prev => ({...prev, [tab]:newMsgs}))
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/support', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          messages: newMsgs.map(m=>({role:m.role, content:m.content})),
          tenantId, type:tab
        })
      })
      const data = await res.json()
      const raw = data.response || "Risposta non disponibile."
      const { cleanText, actions } = parseActions(raw)
      const aiMsg: Msg = {
        role:'assistant', content:cleanText, ts:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
        actions: actions.length > 0 ? actions : undefined
      }
      setMessages(prev => ({...prev, [tab]:[...newMsgs, aiMsg]}))
      if (!open) setUnread(n => n+1)
    } catch {
      setMessages(prev => ({...prev, [tab]:[...newMsgs, { role:'assistant', content:'⚠️ Errore di connessione. Riprova.' }]}))
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleAction = (a: Action) => {
    if (a.type === 'vai' && a.value) router.push(a.value)
    else if (a.type === 'aggiorna') window.location.reload()
    else if (a.type === 'contatta') window.open('mailto:support@nexlyhub.com')
  }

  const currentMsgs = messages[tab]
  const hasMessages = currentMsgs.length > 1

  // Render markdown-like bold
  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{color:'#f1f1f1'}}>{part.slice(2,-2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <>
      {/* FAB */}
      <button onClick={() => { setOpen(v=>!v); setUnread(0) }} style={{
        position:'fixed', bottom:'24px', right:'24px', zIndex:1000,
        width:'52px', height:'52px', borderRadius:'50%',
        background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',
        border:'none', cursor:'pointer', boxShadow:'0 4px 20px rgba(59,130,246,0.5)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px',
        transition:'transform 0.2s',
      }}
        onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
        title="NexlyAI"
      >
        {open ? '✕' : '🤖'}
        {!open && unread > 0 && (
          <span style={{ position:'absolute', top:'-4px', right:'-4px', background:'#ef4444', color:'white', borderRadius:'50%', width:'18px', height:'18px', fontSize:'11px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700' }}>{unread}</span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position:'fixed', bottom:'88px', right:'24px', zIndex:999,
          width:'380px', height: minimized ? '52px' : '560px',
          background:'#111118', border:'1px solid #2a2a3a',
          borderRadius:'16px', boxShadow:'0 20px 60px rgba(0,0,0,0.6)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          transition:'height 0.2s ease',
          fontFamily:'system-ui,sans-serif',
        }}>
          {/* Header */}
          <div style={{ padding:'12px 16px', background:'linear-gradient(135deg,#1a1a2e,#16213e)', borderBottom:'1px solid #2a2a3a', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px' }}>🤖</div>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#f1f1f1' }}>NexlyAI</div>
                <div style={{ fontSize:'10px', color:'#10b981', display:'flex', alignItems:'center', gap:'3px' }}>
                  <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#10b981', display:'inline-block' }} />
                  Online · Dati in tempo reale
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:'4px' }}>
              <button onClick={() => setMinimized(v=>!v)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'14px', padding:'4px' }}>
                {minimized ? '⬆' : '⬇'}
              </button>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'14px', padding:'4px' }}>✕</button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Tabs */}
              <div style={{ display:'flex', gap:'0', background:'#0a0a0f', borderBottom:'1px solid #1f2030', flexShrink:0 }}>
                {(Object.entries(TYPE_CFG) as [ChatType, any][]).map(([k, cfg]) => (
                  <button key={k} onClick={() => setTab(k)} style={{
                    flex:1, padding:'8px 4px', background:'none', border:'none',
                    borderBottom: tab===k ? `2px solid ${cfg.color}` : '2px solid transparent',
                    color: tab===k ? cfg.color : '#6b7280', cursor:'pointer', fontSize:'11px', fontWeight:'600',
                    transition:'all 0.15s',
                  }}>
                    {cfg.label}
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
                {currentMsgs.map((m, i) => (
                  <div key={i}>
                    <div style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth:'88%', padding:'9px 13px', borderRadius: m.role==='user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: m.role==='user' ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : '#1f2030',
                        color: m.role==='user' ? 'white' : '#d1d5db',
                        fontSize:'13px', lineHeight:'1.5',
                      }}>
                        {renderContent(m.content)}
                        {m.ts && <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.4)', marginTop:'4px', textAlign:'right' }}>{m.ts}</div>}
                      </div>
                    </div>
                    {/* Action buttons */}
                    {m.actions && m.actions.length > 0 && (
                      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'6px', paddingLeft:'4px' }}>
                        {m.actions.map((a, ai) => (
                          <button key={ai} onClick={() => handleAction(a)} style={{
                            padding:'5px 12px', background:'#3b82f620', color:'#60a5fa',
                            border:'1px solid #3b82f640', borderRadius:'8px',
                            cursor:'pointer', fontSize:'11px', fontWeight:'600',
                            transition:'background 0.15s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background='#3b82f640'}
                            onMouseLeave={e => e.currentTarget.style.background='#3b82f620'}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div style={{ display:'flex', justifyContent:'flex-start' }}>
                    <div style={{ padding:'10px 14px', background:'#1f2030', borderRadius:'12px 12px 12px 2px', display:'flex', gap:'4px', alignItems:'center' }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#6b7280', animation:`bounce 1s ${i*0.15}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Domande rapide (solo all'inizio) */}
                {tab === 'support' && !hasMessages && (
                  <div style={{ marginTop:'8px' }}>
                    <div style={{ fontSize:'10px', color:'#4b5563', marginBottom:'6px', textAlign:'center' }}>DOMANDE RAPIDE</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                      {QUICK_QUESTIONS.map((q, i) => (
                        <button key={i} onClick={() => send(q)} style={{
                          padding:'5px 10px', background:'#1f2030', border:'1px solid #2a2a3a',
                          borderRadius:'8px', color:'#9ca3af', cursor:'pointer', fontSize:'11px',
                          transition:'all 0.15s',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background='#2a2a3a'; e.currentTarget.style.color='#f1f1f1' }}
                          onMouseLeave={e => { e.currentTarget.style.background='#1f2030'; e.currentTarget.style.color='#9ca3af' }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding:'10px 12px', borderTop:'1px solid #1f2030', display:'flex', gap:'8px', alignItems:'flex-end', flexShrink:0 }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder={tab === 'support' ? "Chiedi qualcosa... (Invio per inviare)" : tab === 'bug' ? "Descrivi il bug..." : "La tua idea..."}
                  disabled={loading}
                  rows={1}
                  style={{
                    flex:1, background:'#1f2030', border:'1px solid #2a2a3a',
                    borderRadius:'8px', color:'#f1f1f1', fontSize:'13px',
                    padding:'8px 12px', resize:'none', outline:'none',
                    fontFamily:'inherit', lineHeight:'1.4',
                    maxHeight:'80px', overflowY:'auto',
                  }}
                />
                <button onClick={() => send()} disabled={!input.trim() || loading} style={{
                  padding:'8px 12px', background: input.trim() ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : '#1f2030',
                  color: input.trim() ? 'white' : '#6b7280', border:'none', borderRadius:'8px',
                  cursor: input.trim() ? 'pointer' : 'not-allowed', fontSize:'14px', transition:'all 0.15s', flexShrink:0,
                }}>
                  ↑
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0) }
          30% { transform: translateY(-4px) }
        }
      `}</style>
    </>
  )
}
