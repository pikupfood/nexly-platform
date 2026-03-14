import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://erhumtzfyarckjowgvcd.supabase.co',
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { tenantId, returnUrl } = await req.json()
  const { data: tenant } = await supabase
    .from('tenants').select('*').eq('id', tenantId).single()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  let customerId = tenant.stripe_customer_id

  // Crea customer Stripe automaticamente se non esiste
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant.email,
      name: tenant.legal_name || tenant.business_name || tenant.email,
      metadata: { tenant_id: tenantId },
    })
    customerId = customer.id
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
    // Se il portale non è configurato su Stripe, dai un errore chiaro
    if (err?.code === 'resource_missing') {
      return NextResponse.json({
        error: 'Le portail de facturation Stripe n\'est pas encore configuré. Allez sur dashboard.stripe.com/settings/billing/portal et cliquez Save.',
        stripe_error: true,
      }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
