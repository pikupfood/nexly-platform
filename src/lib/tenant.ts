import { supabase } from './supabase'

/**
 * Restituisce il tenant_id dell'utente loggato.
 * Da usare in ogni pagina prima di fare query.
 */
export async function getTenantId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', session.user.id)
    .single()
  return data?.id || null
}

/**
 * Shortcut: restituisce sia session che tenant_id
 */
export async function getSessionAndTenant() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { session: null, tenantId: null }
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', session.user.id)
    .single()
  return { session, tenantId: data?.id || null }
}
