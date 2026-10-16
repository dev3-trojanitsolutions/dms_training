import { today } from './dates'
import type { DeliveryNote, SalesInvoice, SalesOrder } from './types'

/**
 * Copies of the dms server hooks (dms/automation/dn_si_auto_create.py), so the
 * trainee sees the same documents appear as on the real system.
 */

/** Sales Order on_submit: a draft Sales Invoice with every quantity at 0. */
export function createDraftInvoiceFromOrder(so: SalesOrder, invoiceNo: number): SalesInvoice {
  return {
    name: `ACC-SINV-${so.name.split('-')[2]}-${String(invoiceNo).padStart(5, '0')}`,
    customer: so.customer,
    sales_order: so.name,
    items: so.items.map((line) => ({ ...line, qty: 0, amount: 0 })),
    grand_total: 0,
    docstatus: 0,
    status: 'Draft',
  }
}

/**
 * Delivery Note on_submit (sync_si_on_dn_submit): set each invoice line to the
 * total delivered so far, and submit the invoice once everything is delivered.
 */
export function syncInvoiceOnDeliverySubmit(so: SalesOrder, si: SalesInvoice | undefined, notes: DeliveryNote[]) {
  const delivered = new Map<string, number>()
  for (const dn of notes) {
    if (dn.docstatus !== 1 || dn.sales_order !== so.name) continue
    for (const line of dn.items) delivered.set(line.item_code, (delivered.get(line.item_code) ?? 0) + line.qty)
  }
  for (const line of so.items) line.delivered_qty = delivered.get(line.item_code) ?? 0

  if (!si || si.docstatus !== 0) return
  for (const line of si.items) {
    line.qty = delivered.get(line.item_code) ?? 0
    line.amount = Math.round(line.qty * line.rate * 100) / 100
  }
  si.grand_total = Math.round(si.items.reduce((sum, l) => sum + l.amount, 0) * 100) / 100
  const fully = so.items.every((line) => line.delivered_qty >= line.qty)
  if (fully) {
    si.docstatus = 1
    si.outstanding_amount = si.grand_total
    si.status = invoiceStatus(si)
  }
}

/** ERPNext's Sales Invoice status from its outstanding amount and due date. */
export function invoiceStatus(si: SalesInvoice): string {
  if (si.docstatus === 0) return 'Draft'
  if (si.docstatus === 2) return 'Cancelled'
  const outstanding = si.outstanding_amount ?? si.grand_total
  if (outstanding <= 0) return 'Paid'
  if (si.due_date && si.due_date < today()) return 'Overdue'
  if (outstanding < si.grand_total) return 'Partly Paid'
  return 'Unpaid'
}

/** ERPNext's Sales Order status from delivery and billing. */
export function salesOrderStatus(so: SalesOrder, si: SalesInvoice | undefined): string {
  if (so.docstatus === 0) return 'Draft'
  if (so.docstatus === 2) return 'Cancelled'
  const delivered = so.items.every((line) => line.delivered_qty >= line.qty)
  const billed = si?.docstatus === 1
  if (delivered && billed) return 'Completed'
  if (delivered) return 'To Bill'
  if (billed) return 'To Deliver'
  return 'To Deliver and Bill'
}
