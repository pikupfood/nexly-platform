import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://erhumtzfyarckjowgvcd.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaHVtdHpmeWFyY2tqb3dndmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjE2NjksImV4cCI6MjA4ODk5NzY2OX0.ydqd0vNsDNgnzNjFqkqUrya8oIz-fV2KOlISKmt4O00'

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON
  )

  const { priceId, tenantId, modules, billingCycle, mode } = await req.json()

  const { data: rows, error: rpcError } = await supabase.rpc('get_tenant_stripe_info', { p_tenant_id: tenantId })
  if (rpcError || !rows || rows.length === 0) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  const tenant = rows[0]

  let customerId = tenant.stripe_customer_id
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
  const isAddModule = mode === 'add_module'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: isAddModule ? undefined : 14,
      metadata: {
        tenant_id: tenantId,
        modules: modules.join(','),
        billing_cycle: billingCycle,
      },
    },
    success_url: isAddModule
      ? `${baseUrl}/dashboard/subscription?success=1`
      : `${baseUrl}/dashboard?success=1`,
    cancel_url: isAddModule
      ? `${baseUrl}/dashboard/subscription`
      : `${baseUrl}/onboarding?step=4`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  })

  return NextResponse.json({ url: session.url })
}
