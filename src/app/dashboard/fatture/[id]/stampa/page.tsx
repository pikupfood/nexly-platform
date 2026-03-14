'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const PM_LABEL: Record<string, string> = {
  cash: 'Espèces', card: 'Carte bancaire', bank_transfer: 'Virement bancaire',
  check: 'Chèque', transfer: 'Virement', other: 'Autre',
  complimentary: '🎁 Offert par l\'établissement'
}

export default function StampaFatturaPage() {
  const router = useRouter()
  const params = useParams()
  const [invoice, setInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      loadInvoice()
    })
  }, [])

  const loadInvoice = async () => {
    const [invRes, itemsRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', params.id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', params.id).order('sort_order'),
    ])
    setInvoice(invRes.data)
    setItems(itemsRes.data || [])
    setLoading(false)
  }

  if (loading || !invoice) return <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#666' }}>Caricamento...</div></div>

  // Raggruppa TVA per aliquota
  const tvaGroups: Record<string, number> = {}
  items.forEach(item => {
    const key = `${item.tax_rate}`
    if (!tvaGroups[key]) tvaGroups[key] = 0
    tvaGroups[key] += item.total * (item.tax_rate / 100)
  })

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      {/* Barra azioni (non stampata) */}
      <div style={{ background: '#111118', padding: '12px 32px', display: 'flex', gap: '12px', alignItems: 'center' }} className="no-print">
        <Link href={`/dashboard/fatture/${params.id}`} style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '14px' }}>← Torna alla fattura</Link>
        <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginLeft: 'auto' }}>🖨️ Stampa / Salva PDF</button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { size: A4; margin: 15mm; }
        }
        body { background: white; }
      `}</style>

      {/* FATTURA A4 */}
      <div style={{ background: 'white', maxWidth: '794px', margin: '0 auto', padding: '40px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#1a1a1a', fontSize: '11pt', lineHeight: '1.4' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div>
            <div style={{ fontSize: '28pt', fontWeight: '900', color: invoice.is_complimentary ? '#7c3aed' : '#1a1a1a', letterSpacing: '-1px' }}>
              {invoice.is_complimentary ? '🎁 OFFERT' : 'FACTURE'}
            </div>
            <div style={{ fontSize: '11pt', color: '#666', marginTop: '4px' }}>N° {invoice.invoice_number}</div>
            {invoice.is_complimentary && (
              <div style={{ background: '#7c3aed', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '10pt', fontWeight: '700', marginTop: '8px', display: 'inline-block' }}>
                OFFERT PAR L'ÉTABLISSEMENT
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14pt', fontWeight: '700', color: '#1a1a1a' }}>{invoice.seller_name}</div>
            {invoice.seller_address && <div style={{ fontSize: '9pt', color: '#444', marginTop: '4px', whiteSpace: 'pre-line' }}>{invoice.seller_address}</div>}
            {invoice.seller_siret && <div style={{ fontSize: '9pt', color: '#666', marginTop: '4px' }}>SIRET : {invoice.seller_siret}</div>}
            {invoice.seller_vat && <div style={{ fontSize: '9pt', color: '#666' }}>N° TVA : {invoice.seller_vat}</div>}
            {invoice.seller_ape && <div style={{ fontSize: '9pt', color: '#666' }}>Code APE : {invoice.seller_ape}</div>}
          </div>
        </div>

        {/* Séparateur */}
        <div style={{ borderTop: `3px solid ${invoice.is_complimentary ? '#7c3aed' : '#1a1a1a'}`, marginBottom: '24px' }} />

        {/* Infos facture + Client */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '32px' }}>
          <div>
            <div style={{ fontSize: '8pt', fontWeight: '700', color: '#999', letterSpacing: '1px', marginBottom: '8px' }}>FACTURÉ À</div>
            <div style={{ fontSize: '13pt', fontWeight: '700' }}>{invoice.client_first_name} {invoice.client_last_name}</div>
            {invoice.client_address && <div style={{ fontSize: '10pt', color: '#333', marginTop: '4px' }}>{invoice.client_address}</div>}
            {(invoice.client_postal_code || invoice.client_city) && <div style={{ fontSize: '10pt', color: '#333' }}>{invoice.client_postal_code} {invoice.client_city}</div>}
            {invoice.client_country && invoice.client_country !== 'France' && <div style={{ fontSize: '10pt', color: '#333' }}>{invoice.client_country}</div>}
            {invoice.client_email && <div style={{ fontSize: '10pt', color: '#555', marginTop: '4px' }}>{invoice.client_email}</div>}
            {invoice.client_phone && <div style={{ fontSize: '10pt', color: '#555' }}>{invoice.client_phone}</div>}
            {invoice.client_siret && <div style={{ fontSize: '9pt', color: '#666', marginTop: '4px' }}>SIRET : {invoice.client_siret}</div>}
            {invoice.client_vat_number && <div style={{ fontSize: '9pt', color: '#666' }}>N° TVA : {invoice.client_vat_number}</div>}
          </div>
          <div>
            <div style={{ fontSize: '8pt', fontWeight: '700', color: '#999', letterSpacing: '1px', marginBottom: '8px' }}>DÉTAILS DE LA FACTURE</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Date de facture', new Date(invoice.invoice_date).toLocaleDateString('fr-FR')],
                  invoice.due_date ? ['Date d\'échéance', new Date(invoice.due_date).toLocaleDateString('fr-FR')] : null,
                  ['Mode de paiement', PM_LABEL[invoice.payment_method] || invoice.payment_method],
                  invoice.paid_at ? ['Payée le', new Date(invoice.paid_at).toLocaleDateString('fr-FR')] : null,
                ].filter(Boolean).map(([k, v]: any) => (
                  <tr key={k}>
                    <td style={{ fontSize: '9pt', color: '#666', paddingBottom: '4px', paddingRight: '16px' }}>{k}</td>
                    <td style={{ fontSize: '10pt', fontWeight: '600', paddingBottom: '4px' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tableau des prestations */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
          <thead>
            <tr style={{ background: '#1a1a1a', color: 'white' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '9pt', fontWeight: '600' }}>DÉSIGNATION</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '9pt', fontWeight: '600', width: '60px' }}>QTÉ</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '9pt', fontWeight: '600', width: '100px' }}>P.U. HT</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '9pt', fontWeight: '600', width: '60px' }}>TVA</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '9pt', fontWeight: '600', width: '100px' }}>TOTAL HT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} style={{ background: i % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #e5e5e5' }}>
                <td style={{ padding: '10px 12px', fontSize: '10pt' }}>{item.description}</td>
                <td style={{ padding: '10px 12px', fontSize: '10pt', textAlign: 'center', color: '#444' }}>{item.quantity}</td>
                <td style={{ padding: '10px 12px', fontSize: '10pt', textAlign: 'right', color: '#444' }}>{Number(item.unit_price).toFixed(2)} €</td>
                <td style={{ padding: '10px 12px', fontSize: '10pt', textAlign: 'center', color: '#444' }}>{item.tax_rate}%</td>
                <td style={{ padding: '10px 12px', fontSize: '10pt', textAlign: 'right', fontWeight: '600' }}>{Number(item.total).toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
          <div style={{ width: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5', fontSize: '10pt' }}>
              <span style={{ color: '#555' }}>Sous-total HT</span>
              <span>{Number(invoice.subtotal).toFixed(2)} €</span>
            </div>
            {Object.entries(tvaGroups).map(([rate, amount]) => (
              <div key={rate} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5', fontSize: '10pt' }}>
                <span style={{ color: '#555' }}>TVA {rate}%</span>
                <span>{amount.toFixed(2)} €</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#1a1a1a', color: 'white', fontSize: '13pt', fontWeight: '700', marginTop: '4px' }}>
              <span>TOTAL TTC</span>
              <span>{Number(invoice.total).toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ background: '#f5f5f5', borderLeft: '3px solid #1a1a1a', padding: '12px 16px', marginBottom: '24px', fontSize: '9pt', color: '#444' }}>
            {invoice.notes}
          </div>
        )}

        {/* Mentions légales obligatoires (France) */}
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '16px', marginTop: '16px' }}>
          <div style={{ fontSize: '8pt', color: '#888', lineHeight: '1.6' }}>
            <strong style={{ color: '#555' }}>Mentions légales :</strong> En cas de retard de paiement, des pénalités de retard au taux de 3 fois le taux d'intérêt légal seront appliquées, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €
            {invoice.seller_siret ? ` — SIRET ${invoice.seller_siret}` : ''}{invoice.seller_vat ? ` — TVA ${invoice.seller_vat}` : ''}{invoice.seller_ape ? ` — APE ${invoice.seller_ape}` : ''}.
            {' '}Facture émise le {today}.
          </div>
        </div>
      </div>
    </>
  )
}
