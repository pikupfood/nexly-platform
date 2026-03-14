import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://erhumtzfyarckjowgvcd.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaHVtdHpmeWFyY2tqb3dndmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjE2NjksImV4cCI6MjA4ODk5NzY2OX0.ydqd0vNsDNgnzNjFqkqUrya8oIz-fV2KOlISKmt4O00'

const FALLBACK: Record<string, string> = {
  support: "Merci pour votre message ! Notre équipe vous répondra rapidement. Email : support@nexlyhub.com",
  bug: "Bug enregistré ✅ Notre équipe technique l'analysera et vous contactera. Merci !",
  feature: "Suggestion enregistrée ✅ Merci pour votre retour, nous examinons toutes les idées !",
}

export async function POST(req: NextRequest) {
  const { messages, tenantId, type = 'support' } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'Messages required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  let tenantContext = ''
  if (tenantId && apiKey) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
      const { data: ctx } = await supabase.rpc('ai_get_tenant_full_context', { p_tenant_id: tenantId })
      if (ctx) tenantContext = `\n\n=== DONNÉES CLIENT ===\n${JSON.stringify(ctx, null, 2)}\n=== FIN ===`
    } catch (e) {}
  }

  let aiResponse: string

  if (!apiKey) {
    aiResponse = FALLBACK[type] || FALLBACK.support
  } else {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: `Tu es l'assistant IA de Nexly Hub Platform. Tu as accès COMPLET aux données du client. Réponds en FRANÇAIS, sois concis et bienveillant. Si bug: demande page + détails. Plans: Hôtel €49, Restaurant €39, Spa €39, Padel €29, All Inclusive €129/mois. Annuel -20%.${tenantContext}`,
          messages: messages.map((m: any) => ({ role: m.role, content: m.content }))
        })
      })
      const data = await res.json()
      aiResponse = res.ok ? (data.content?.[0]?.text || FALLBACK[type]) : (FALLBACK[type])
    } catch {
      aiResponse = FALLBACK[type] || FALLBACK.support
    }
  }

  if (tenantId) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
      const lastMsg = messages[messages.length - 1]?.content || ''
      await supabase.rpc('save_support_message', {
        p_tenant_id: tenantId, p_type: type,
        p_title: `${type === 'bug' ? '🐛' : '💬'} ${lastMsg.substring(0, 60)}`,
        p_user_message: lastMsg, p_ai_response: aiResponse
      })
    } catch {}
  }

  return NextResponse.json({ response: aiResponse })
}
