import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://erhumtzfyarckjowgvcd.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaHVtdHpmeWFyY2tqb3dndmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjE2NjksImV4cCI6MjA4ODk5NzY2OX0.ydqd0vNsDNgnzNjFqkqUrya8oIz-fV2KOlISKmt4O00'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurata nelle env vars Vercel' }, { status: 500 })

  const { messages, tenantId, type = 'support' } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'Messages required' }, { status: 400 })

  let tenantContext = ''
  if (tenantId) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
      const { data: ctx } = await supabase.rpc('ai_get_tenant_full_context', { p_tenant_id: tenantId })
      if (ctx) tenantContext = `\n\n=== DONNÉES CLIENT ===\n${JSON.stringify(ctx, null, 2)}\n=== FIN ===`
    } catch (e) { console.error('Context load error:', e) }
  }

  const systemPrompt = `Tu es l'assistant IA de Nexly Hub Platform. Tu as accès COMPLET aux données du client.

COMMENT RÉPONDRE:
- Toujours en FRANÇAIS, ton professionnel et bienveillant
- Utilise les données réelles du client pour répondre précisément
- Si bug signalé: demande page + ce qui s'est passé + attendu → confirme enregistrement
- Réponses courtes et directes

NEXLY HUB PLATFORM — AIDE AVEC:
- Inscription et onboarding (4 étapes: infos → modules → portail → paiement)
- Abonnements: Hôtel €49/mois, Restaurant €39/mois, Spa €39/mois, Padel €29/mois, All Inclusive €129/mois. Annuel -20%
- Portail réservation: nexly-booking.vercel.app/[votre-slug]
- Facturation Stripe: changer plan, annuler, gérer paiements
- Configuration des modules actifs
${tenantContext}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content }))
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`)
    const aiResponse = data.content?.[0]?.text || 'Désolé, je ne peux pas répondre pour le moment.'

    if (tenantId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
        const lastMsg = messages[messages.length - 1]?.content || ''
        await supabase.rpc('save_support_message', {
          p_tenant_id: tenantId, p_type: type,
          p_title: `${type === 'bug' ? '🐛' : '💬'} ${lastMsg.substring(0, 60)}`,
          p_user_message: lastMsg, p_ai_response: aiResponse
        })
      } catch (e) { console.error('Save error:', e) }
    }

    return NextResponse.json({ response: aiResponse })
  } catch (err: any) {
    return NextResponse.json({ error: 'AI Error: ' + err.message }, { status: 500 })
  }
}
