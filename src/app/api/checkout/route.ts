import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  const { priceId, tenantId, modules, billingCycle } = await req.json()

  // Recupera tenant
  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).single()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  let customerId = tenant.stripe_customer_id

  // Crea customer Stripe se non esiste
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

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        tenant_id: tenantId,
        modules: modules.join(','),
        billing_cycle: billingCycle,
      },
    },
    success_url: `${baseUrl}/dashboard?success=1`,
    cancel_url: `${baseUrl}/onboarding?step=4`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  })

  return NextResponse.json({ url: session.url })
}
