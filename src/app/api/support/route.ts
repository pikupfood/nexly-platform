import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://erhumtzfyarckjowgvcd.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaHVtdHpmeWFyY2tqb3dndmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjE2NjksImV4cCI6MjA4ODk5NzY2OX0.ydqd0vNsDNgnzNjFqkqUrya8oIz-fV2KOlISKmt4O00'

export async function POST(req: NextRequest) {
  const { messages, tenantId, type = 'support', action } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'Messages required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON)

  // ── ESECUZIONE AZIONI REALI ──
  // La chatbot può eseguire azioni concrete sul DB
  if (action) {
    try {
      const result = await executeAction(action, sbClient, tenantId)
      return NextResponse.json({ response: result.message, actionResult: result.data })
    } catch (e: any) {
      return NextResponse.json({ response: `❌ Errore: ${e.message}` })
    }
  }

  // ── CARICA CONTESTO TENANT ──
  let tenantContext = ''
  if (tenantId) {
    try {
      const { data: ctx } = await sbClient.rpc('ai_get_tenant_full_context', { p_tenant_id: tenantId })
      if (ctx) {
        const today = new Date().toISOString().split('T')[0]
        // Arricchisce il contesto con dati calcolati
        const summary = buildContextSummary(ctx, today)
        tenantContext = `\n\n=== DATI STRUTTURA (aggiornati ora) ===\n${summary}\n${JSON.stringify(ctx, null, 2).slice(0, 6000)}\n=== FINE DATI ===`
      }
    } catch {}
  }

  if (!apiKey) {
    return NextResponse.json({ response: "⚠️ NexlyAI temporaneamente non disponibile. Contatta support@nexlyhub.com" })
  }

  const today = new Date().toLocaleDateString('it-IT', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  const todayISO = new Date().toISOString().split('T')[0]

  const systemPrompt = `Sei NexlyAI, l'assistente AI avanzato integrato nella dashboard operativa di Nexly Hub.

HAI ACCESSO COMPLETO ai dati reali della struttura e puoi ESEGUIRE AZIONI CONCRETE.

CAPACITÀ:
1. RISPONDERE a qualsiasi domanda sui dati reali (prenotazioni, disponibilità, ricavi, clienti, staff)
2. NAVIGARE — indicare esattamente dove andare con pulsanti cliccabili
3. ESEGUIRE AZIONI DIRETTE — cambio stato prenotazioni, aggiornamenti, creazione rapida
4. ANALIZZARE — insights su occupazione, picchi, tendenze revenue
5. SUGGERIRE — azioni operative concrete basate sui dati

DATI OGGI (${todayISO}):${tenantContext}

FORMATO RISPOSTA:
- Rispondi nella lingua dell'utente (italiano/francese/inglese/tedesco/spagnolo)
- Sii DIRETTO: vai subito al punto, max 150 parole per risposta normale
- Per dati: cita SOLO cifre reali dal contesto — mai inventare
- Usa emoji sparingly per leggibilità

TAG SPECIALI (aggiungi SOLO se pertinenti, in fondo):
[AZIONE:vai:/path:Testo pulsante] → bottone di navigazione
[AZIONE:crea:hotel_reservation:json] → crea prenotazione (json con i dati)
[AZIONE:aggiorna] → ricarica dashboard
[AZIONE:email:indirizzo:oggetto] → apri email

ESEMPI DI COSA PUOI FARE:
- "Quante camere libere oggi?" → conta dai dati reali e rispondi
- "Mostrami le prenotazioni di domani" → lista + link rapido
- "Come aggiungo una nuova camera?" → guida passo-passo + pulsante
- "Revenue di questo mese?" → calcola dai dati e mostra
- "Chi fa check-in oggi?" → lista nomi + stato
- "C'è un appuntamento spa alle 15?" → verifica e risponde

OGGI: ${today}`

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
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content }))
      })
    })

    const data = await response.json()
    const aiResponse = data.content?.[0]?.text || "Mi dispiace, risposta non disponibile."

    // Salva conversazione
    if (tenantId) {
      try {
        const lastMsg = messages[messages.length - 1]?.content || ''
        const icon = type === 'bug' ? '🐛' : type === 'feature' ? '✨' : '💬'
        await sbClient.rpc('save_support_message', {
          p_tenant_id: tenantId,
          p_type: type,
          p_title: `${icon} ${lastMsg.substring(0, 60)}`,
          p_user_message: lastMsg,
          p_ai_response: aiResponse,
        })
      } catch {}
    }

    return NextResponse.json({ response: aiResponse })
  } catch (e: any) {
    return NextResponse.json({ response: "⚠️ Errore temporaneo. Riprova tra poco." })
  }
}

function buildContextSummary(ctx: any, today: string): string {
  const lines: string[] = []
  if (ctx.reservations?.length) {
    const todayCI = ctx.reservations.filter((r: any) => r.check_in === today && r.status === 'confirmed').length
    const todayCO = ctx.reservations.filter((r: any) => r.check_out === today && r.status === 'checked_in').length
    const occupied = ctx.reservations.filter((r: any) => r.status === 'checked_in').length
    lines.push(`Hotel: ${occupied} camere occupate, ${todayCI} check-in oggi, ${todayCO} check-out oggi`)
  }
  if (ctx.spa_appointments?.length) {
    const todaySpa = ctx.spa_appointments.filter((a: any) => a.date === today && a.status !== 'cancelled').length
    lines.push(`Spa: ${todaySpa} appuntamenti oggi`)
  }
  if (ctx.padel_bookings?.length) {
    const todayPadel = ctx.padel_bookings.filter((b: any) => b.date === today && b.status !== 'cancelled').length
    lines.push(`Padel: ${todayPadel} prenotazioni oggi`)
  }
  if (ctx.restaurant_tables?.length) {
    const free = ctx.restaurant_tables.filter((t: any) => t.status === 'free').length
    lines.push(`Ristorante: ${free}/${ctx.restaurant_tables.length} tavoli liberi`)
  }
  return lines.join(' | ')
}

async function executeAction(action: any, sbClient: any, tenantId: string) {
  const { type, payload } = action

  switch (type) {
    case 'checkin': {
      await sbClient.from('reservations').update({ status: 'checked_in' }).eq('id', payload.id)
      return { message: `✅ Check-in effettuato per ${payload.guestName}!`, data: null }
    }
    case 'checkout': {
      await sbClient.from('reservations').update({ status: 'checked_out' }).eq('id', payload.id)
      return { message: `✅ Check-out effettuato per ${payload.guestName}!`, data: null }
    }
    case 'cancel_reservation': {
      await sbClient.from('reservations').update({ status: 'cancelled' }).eq('id', payload.id)
      return { message: `✅ Prenotazione ${payload.number} cancellata.`, data: null }
    }
    case 'complete_spa': {
      await sbClient.from('spa_appointments').update({ status: 'completed' }).eq('id', payload.id)
      return { message: `✅ Appuntamento spa completato!`, data: null }
    }
    case 'start_spa': {
      await sbClient.from('spa_appointments').update({ status: 'in_progress' }).eq('id', payload.id)
      return { message: `▶️ Appuntamento iniziato!`, data: null }
    }
    default:
      throw new Error(`Azione '${type}' non supportata`)
  }
}
