import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://erhumtzfyarckjowgvcd.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaHVtdHpmeWFyY2tqb3dndmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjE2NjksImV4cCI6MjA4ODk5NzY2OX0.ydqd0vNsDNgnzNjFqkqUrya8oIz-fV2KOlISKmt4O00'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not set on Vercel' }, { status: 500 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  // Usa service key se disponibile, altrimenti anon (la RPC è SECURITY DEFINER quindi bypassa RLS)
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON)

  const { tenantId, returnUrl } = await req.json()
  if (!tenantId) return NextResponse.json({ error: 'tenantId mancante' }, { status: 400 })

  // Usa la RPC SECURITY DEFINER — bypassa RLS anche con chiave anon
  const { data: rows, error: rpcError } = await supabase.rpc('get_tenant_for_portal', { p_tenant_id: tenantId })

  if (rpcError || !rows || rows.length === 0) {
    console.error('RPC error:', rpcError)
    return NextResponse.json({
      error: `Tenant non trovato (id: ${tenantId}). Errore: ${rpcError?.message || 'nessun risultato'}`
    }, { status: 404 })
  }

  const tenant = rows[0]
  let customerId = tenant.stripe_customer_id

  // Crea customer Stripe automaticamente se non esiste
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant.email,
      name: tenant.legal_name || tenant.business_name || tenant.email,
      metadata: { tenant_id: tenantId },
    })
    customerId = customer.id
    // Salva l'id (non importa RLS qui perché usiamo service key o la funzione)
    await supabase.from('tenants').update({ stripe_customer_id: customerId }).eq('id', tenantId)
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nexly-platform.vercel.app'

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${baseUrl}/dashboard/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    if (err?.code === 'resource_missing' || err?.message?.toLowerCase().includes('portal')) {
      return NextResponse.json({
        error: 'Portail Stripe non configuré. Allez sur dashboard.stripe.com/settings/billing/portal → cliquez Save settings.',
        stripe_error: true,
      }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
