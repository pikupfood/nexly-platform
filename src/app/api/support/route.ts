import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://erhumtzfyarckjowgvcd.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaHVtdHpmeWFyY2tqb3dndmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjE2NjksImV4cCI6MjA4ODk5NzY2OX0.ydqd0vNsDNgnzNjFqkqUrya8oIz-fV2KOlISKmt4O00'

const SYSTEM_PROMPT = `Tu es l'assistant de support de Nexly Hub Platform, une plateforme SaaS pour gérer les abonnements et les portails de réservation.

Tu aides les utilisateurs à:
- S'inscrire et configurer leur compte
- Gérer leur abonnement (plans, modules, facturation)
- Configurer leur portail de réservation clients
- Résoudre des problèmes techniques

Si l'utilisateur signale un bug, demande des détails puis confirme l'enregistrement.

Modules disponibles: Hôtel, Restaurant, Spa, Padel. Plans: mensuel ou annuel.
URL portail: nexly-booking.vercel.app/[slug-de-votre-structure]

Réponds TOUJOURS en français. Sois concis et bienveillant.`

export async function POST(req: NextRequest) {
  const { messages, tenantId, type = 'support' } = await req.json()
  
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Messages required' }, { status: 400 })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content }))
      })
    })

    const data = await response.json()
    const aiResponse = data.content[0]?.text || 'Désolé, je ne peux pas répondre pour le moment.'

    if (tenantId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
      const lastUserMsg = messages[messages.length - 1]?.content || ''
      const title = type === 'bug' ? `🐛 Bug: ${lastUserMsg.substring(0, 50)}` : `💬 Support: ${lastUserMsg.substring(0, 50)}`
      await supabase.rpc('save_support_message', {
        p_tenant_id: tenantId, p_type: type, p_title: title,
        p_user_message: lastUserMsg, p_ai_response: aiResponse
      })
    }

    return NextResponse.json({ response: aiResponse })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
