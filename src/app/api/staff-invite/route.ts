import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { email, first_name, last_name, role, modules, language, tenant_name } = await req.json()
  if (!email || !first_name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nexly-hub-2.vercel.app'
  const loginUrl = `${baseUrl}/staff/login`

  if (!serviceKey) {
    // No service key — restituisci solo il link manuale
    return NextResponse.json({
      success: true,
      method: 'manual',
      login_url: `${loginUrl}?email=${encodeURIComponent(email)}`,
    })
  }

  try {
    const admin = createClient(
      'https://erhumtzfyarckjowgvcd.supabase.co',
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Prova invito admin
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${loginUrl}?email=${encodeURIComponent(email)}`,
      data: { first_name, last_name, role, is_staff: true, tenant_name }
    })

    if (error) {
      // Utente già esiste — è ok, può già fare login
      return NextResponse.json({
        success: true,
        method: 'existing',
        message: 'Cet utilisateur existe déjà et peut se connecter directement.',
        login_url: `${loginUrl}?email=${encodeURIComponent(email)}`
      })
    }

    return NextResponse.json({ success: true, method: 'invite_sent', login_url: loginUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
