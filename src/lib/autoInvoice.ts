import { supabase } from '@/lib/supabase'
import { getTenantId } from '@/lib/tenant'

export async function autoGenerateInvoice({
  source, sourceId, clientFirstName, clientLastName,
  clientEmail, clientPhone, items, taxRate = 10,
  paymentMethod = 'card', paymentNote = '',
  isComplimentary = false, complimentaryReason = '', router,
}: {
  source: 'hotel' | 'ristorante' | 'spa' | 'padel'
  sourceId: string
  clientFirstName: string
  clientLastName: string
  clientEmail?: string
  clientPhone?: string
  items: { description: string; quantity: number; unit_price: number; tax_rate: number }[]
  taxRate?: number
  paymentMethod?: string
  paymentNote?: string
  isComplimentary?: boolean
  complimentaryReason?: string
  router: any
}): Promise<string | null> {
  try {
    const tenantId = await getTenantId()
    const subtotal = isComplimentary ? 0 : items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const taxAmount = isComplimentary ? 0 : items.reduce((s, i) => s + i.quantity * i.unit_price * (i.tax_rate / 100), 0)
    const total = subtotal + taxAmount

    const { data: numData } = await supabase.rpc('next_invoice_number')
    const invoiceNumber = numData || `${new Date().getFullYear()}-AUTO-${Date.now()}`

    const { data: inv, error } = await supabase.from('invoices').insert([{
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().split('T')[0],
      client_first_name: clientFirstName,
      client_last_name: clientLastName,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      source, source_id: sourceId,
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: isComplimentary ? 'complimentary' : paymentMethod,
      subtotal, tax_rate: isComplimentary ? 0 : taxRate,
      tax_amount: taxAmount, total,
      is_complimentary: isComplimentary,
      complimentary_reason: isComplimentary ? complimentaryReason : null,
      notes: isComplimentary
        ? `🎁 OFFERTO DALLA CASA${complimentaryReason ? ' — ' + complimentaryReason : ''}`
        : (paymentNote ? `Pagamento: ${paymentNote}` : null),
      seller_name: 'Nexly Hub SAS',
      tenant_id: tenantId,
    }]).select().single()

    if (error || !inv) { console.error('Auto-invoice error:', error); return null }

    await supabase.from('invoice_items').insert(
      items.map((item, i) => ({
        invoice_id: inv.id,
        description: isComplimentary
          ? `${item.description} [OFFERTO — valore €${(item.quantity * item.unit_price).toFixed(2)}]`
          : item.description,
        quantity: item.quantity,
        unit_price: isComplimentary ? 0 : item.unit_price,
        tax_rate: isComplimentary ? 0 : item.tax_rate,
        total: isComplimentary ? 0 : item.quantity * item.unit_price,
        sort_order: i,
        tenant_id: tenantId,
      }))
    )

    router.push(`/dashboard/fatture/${inv.id}/stampa`)
    return inv.id
  } catch (err) {
    console.error('Auto-invoice error:', err)
    return null
  }
}
