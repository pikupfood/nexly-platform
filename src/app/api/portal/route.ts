import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient('https://erhumtzfyarckjowgvcd.supabase.co', process.env.SUPABASE_SERVICE_KEY!)

export async function POST(req: NextRequest) {
  const { tenantId } = await req.json()
  const { data: tenant } = await supabase.from('tenants').select('stripe_customer_id').eq('id', tenantId).single()
  if (!tenant?.stripe_customer_id) return NextResponse.json({ error: 'No customer' }, { status: 404 })

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nexly-platform.vercel.app'
  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${baseUrl}/dashboard/settings`,
  })

  return NextResponse.json({ url: session.url })
}
