import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const getTenantId = (obj: any) => obj?.metadata?.tenant_id || null

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const tenantId = getTenantId(session)
      if (!tenantId) break

      const sub = await stripe.subscriptions.retrieve(session.subscription as string)
      const modules = (sub.metadata?.modules || '').split(',').filter(Boolean)

      await supabase.from('tenants').update({
        status: 'active',
        stripe_subscription_id: sub.id,
        onboarding_step: 5,
      }).eq('id', tenantId)

      if (modules.length > 0) {
        await supabase.from('tenant_modules').delete().eq('tenant_id', tenantId)
        await supabase.from('tenant_modules').insert(
          modules.map((m: string) => ({ tenant_id: tenantId, module: m, is_active: true }))
        )
      }

      await supabase.from('subscriptions').upsert([{
        tenant_id: tenantId,
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer as string,
        status: sub.status,
        billing_cycle: sub.metadata?.billing_cycle || 'monthly',
        current_period_start: new Date((sub as any).current_period_start * 1000).toISOString(),
        current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
      }], { onConflict: 'stripe_subscription_id' })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const tenantId = getTenantId(sub)
      if (!tenantId) break
      await supabase.from('tenants').update({
        status: sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status,
      }).eq('id', tenantId)
      await supabase.from('subscriptions').update({
        status: sub.status,
        current_period_start: new Date((sub as any).current_period_start * 1000).toISOString(),
        current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
      }).eq('stripe_subscription_id', sub.id)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const tenantId = getTenantId(sub)
      if (!tenantId) break
      await supabase.from('tenants').update({ status: 'cancelled' }).eq('id', tenantId)
      await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('stripe_subscription_id', sub.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
