import { today } from './dates'
import type { Customer, DeliveryNote, SalesInvoice, SalesOrder } from './types'

/**
 * Copies of the dms script reports the `/dms` app shows:
 * dms/dms/report/sales_order_status and dms/dms/report/customer_balance.
 */

const DELIVERY_DONE = ['Fully Delivered', 'Not Applicable']
const DELIVERY_PENDING = ['Not Delivered', 'Partly Delivered']
const INVOICE_PENDING = ['Not Invoiced', 'Draft Invoice', 'Partly Invoiced']
export const DELIVERED_INVOICE_PENDING = 'Delivered – Invoice Pending'

export interface Reference {
  name: string
  state: 'Draft' | 'Submitted' | 'Cancelled'
  status: string
  posting_date: string
  qty: number
  grand_total?: number
  outstanding_amount?: number | null
}

export interface StatusRow {
  sales_order: string
  customer: string
  customer_name: string
  transaction_date: string
  delivery_date: string
  company: string
  order_value: number
  ordered_qty: number
  delivered_qty: number
  pending_delivery_qty: number
  invoiced_qty: number
  pending_invoice_qty: number
  draft_invoice_qty: number
  sales_order_status: string
  delivery_status: string
  invoice_status: string
  fulfilment_status: string
  days_overdue: number
  has_draft_invoice: boolean
  invoice_refs: Reference[]
  delivery_note_refs: Reference[]
}

export interface StatusFilters {
  customer: string
  sales_order: string
  sales_order_status: string
  fulfilment_status: string
  delivery_status: string
  invoice_status: string
  overdue_only: boolean
  pending_delivery_only: boolean
  pending_invoice_only: boolean
  draft_invoice_only: boolean
}

export function emptyStatusFilters(): StatusFilters {
  return {
    customer: '',
    sales_order: '',
    sales_order_status: '',
    fulfilment_status: '',
    delivery_status: '',
    invoice_status: '',
    overdue_only: false,
    pending_delivery_only: false,
    pending_invoice_only: false,
    draft_invoice_only: false,
  }
}

const STATE = ['Draft', 'Submitted', 'Cancelled'] as const

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

/** build_row() in sales_order_status.py. */
function buildRow(
  so: SalesOrder,
  invoices: SalesInvoice[],
  notes: DeliveryNote[],
  company: string,
): StatusRow {
  const cancelled = so.docstatus === 2
  const closed = so.status === 'Closed'
  let ordered = 0
  let delivered = 0
  let pendingDelivery = 0
  let invoicedQty = 0
  let pendingInvoice = 0
  let draftQty = 0
  for (const line of so.items) {
    const submitted = invoices
      .filter((si) => si.docstatus === 1)
      .flatMap((si) => si.items)
      .filter((l) => l.item_code === line.item_code)
      .reduce((s, l) => s + l.qty, 0)
    const draft = invoices
      .filter((si) => si.docstatus === 0)
      .flatMap((si) => si.items)
      .filter((l) => l.item_code === line.item_code)
      .reduce((s, l) => s + l.qty, 0)
    ordered += line.qty
    delivered += line.delivered_qty
    pendingDelivery += Math.max(line.qty - line.delivered_qty, 0)
    invoicedQty += submitted
    pendingInvoice += Math.max(line.qty - submitted, 0)
    draftQty += draft
  }
  if (cancelled) pendingDelivery = pendingInvoice = 0
  const hasDraft = invoices.some((si) => si.docstatus === 0)

  const delivery_status = cancelled
    ? 'Cancelled'
    : pendingDelivery <= 0
      ? 'Fully Delivered'
      : closed
        ? 'Closed'
        : delivered > 0
          ? 'Partly Delivered'
          : 'Not Delivered'
  const invoice_status = cancelled
    ? 'Cancelled'
    : pendingInvoice <= 0
      ? 'Fully Invoiced'
      : closed
        ? 'Closed'
        : invoicedQty > 0
          ? 'Partly Invoiced'
          : hasDraft
            ? 'Draft Invoice'
            : 'Not Invoiced'
  const deliveryDone = DELIVERY_DONE.includes(delivery_status)
  const fulfilment_status = cancelled
    ? 'Cancelled'
    : deliveryDone && invoice_status === 'Fully Invoiced'
      ? 'Fully Completed'
      : closed
        ? 'Closed'
        : deliveryDone
          ? DELIVERED_INVOICE_PENDING
          : delivery_status === 'Partly Delivered'
            ? 'Partially Delivered'
            : 'Not Delivered'

  const days_overdue =
    DELIVERY_PENDING.includes(delivery_status) && so.delivery_date
      ? Math.max(daysBetween(so.delivery_date, today()), 0)
      : 0

  const qtyFor = (lines: { item_code: string; qty: number }[]) =>
    lines.filter((l) => so.items.some((o) => o.item_code === l.item_code)).reduce((s, l) => s + l.qty, 0)

  return {
    sales_order: so.name,
    customer: so.customer,
    customer_name: so.customer_name,
    transaction_date: so.transaction_date,
    delivery_date: so.delivery_date,
    company,
    order_value: so.grand_total,
    ordered_qty: ordered,
    delivered_qty: delivered,
    pending_delivery_qty: pendingDelivery,
    invoiced_qty: invoicedQty,
    pending_invoice_qty: pendingInvoice,
    draft_invoice_qty: draftQty,
    sales_order_status: cancelled ? 'Cancelled' : so.status,
    delivery_status,
    invoice_status,
    fulfilment_status,
    days_overdue,
    has_draft_invoice: hasDraft,
    invoice_refs: invoices
      .filter((si) => si.docstatus !== 2)
      .map((si) => ({
        name: si.name,
        state: STATE[si.docstatus],
        status: si.status,
        posting_date: si.posting_date ?? '',
        qty: qtyFor(si.items),
        grand_total: si.grand_total,
        outstanding_amount: si.docstatus === 1 ? (si.outstanding_amount ?? si.grand_total) : null,
      })),
    delivery_note_refs: notes.map((dn) => ({
      name: dn.name,
      state: STATE[dn.docstatus],
      status: dn.status,
      posting_date: dn.posting_date,
      qty: qtyFor(dn.items),
    })),
  }
}

/** get_data() + apply_status_filters(): submitted and cancelled orders, newest first. */
export function salesOrderStatusRows(
  orders: SalesOrder[],
  invoices: SalesInvoice[],
  notes: DeliveryNote[],
  company: string,
  f: StatusFilters,
): StatusRow[] {
  let rows = orders
    .filter((so) => so.docstatus !== 0)
    .filter((so) => !f.customer || so.customer === f.customer)
    .filter((so) => !f.sales_order || so.name === f.sales_order)
    .filter((so) => !f.sales_order_status || so.status === f.sales_order_status)
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.name.localeCompare(a.name))
    .map((so) =>
      buildRow(
        so,
        invoices.filter((si) => si.sales_order === so.name),
        notes.filter((dn) => dn.sales_order === so.name),
        company,
      ),
    )
  if (f.fulfilment_status) rows = rows.filter((r) => r.fulfilment_status === f.fulfilment_status)
  if (f.delivery_status) rows = rows.filter((r) => r.delivery_status === f.delivery_status)
  if (f.invoice_status) rows = rows.filter((r) => r.invoice_status === f.invoice_status)
  if (f.overdue_only) rows = rows.filter((r) => r.days_overdue > 0)
  if (f.pending_delivery_only) rows = rows.filter((r) => DELIVERY_PENDING.includes(r.delivery_status))
  if (f.pending_invoice_only) rows = rows.filter((r) => INVOICE_PENDING.includes(r.invoice_status))
  if (f.draft_invoice_only) rows = rows.filter((r) => r.has_draft_invoice)
  return rows
}

export interface SummaryCard {
  key: string
  label: string
  value: number
  currency?: boolean
  drilldown?: Partial<StatusFilters>
}

/** get_report_summary() in sales_order_status.py. */
export function salesOrderStatusSummary(rows: StatusRow[]): SummaryCard[] {
  const count = (test: (r: StatusRow) => boolean) => rows.filter(test).length
  return [
    { key: 'total', label: 'Total Sales Orders', value: rows.length, drilldown: {} },
    {
      key: 'value',
      label: 'Total Order Value (excl. Cancelled)',
      value: rows.filter((r) => r.fulfilment_status !== 'Cancelled').reduce((s, r) => s + r.order_value, 0),
      currency: true,
    },
    {
      key: 'completed',
      label: 'Fully Completed',
      value: count((r) => r.fulfilment_status === 'Fully Completed'),
      drilldown: { fulfilment_status: 'Fully Completed' },
    },
    {
      key: 'pending_delivery',
      label: 'Pending Delivery',
      value: count((r) => DELIVERY_PENDING.includes(r.delivery_status)),
      drilldown: { pending_delivery_only: true },
    },
    {
      key: 'pending_invoice',
      label: 'Pending Invoice',
      value: count((r) => INVOICE_PENDING.includes(r.invoice_status)),
      drilldown: { pending_invoice_only: true },
    },
    {
      key: 'partly_delivered',
      label: 'Partially Delivered',
      value: count((r) => r.delivery_status === 'Partly Delivered'),
      drilldown: { delivery_status: 'Partly Delivered' },
    },
    {
      key: 'draft_invoices',
      label: 'With Draft Invoices',
      value: count((r) => r.has_draft_invoice),
      drilldown: { draft_invoice_only: true },
    },
    {
      key: 'overdue',
      label: 'Overdue Deliveries',
      value: count((r) => r.days_overdue > 0),
      drilldown: { overdue_only: true },
    },
    {
      key: 'closed',
      label: 'Closed',
      value: count((r) => r.fulfilment_status === 'Closed'),
      drilldown: { fulfilment_status: 'Closed' },
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      value: count((r) => r.fulfilment_status === 'Cancelled'),
      drilldown: { fulfilment_status: 'Cancelled' },
    },
  ]
}

/** Clicking a card clears the drilldown filters, then applies its own (applyDrilldown in the SPA). */
export function applyDrilldown(f: StatusFilters, drilldown: Partial<StatusFilters>) {
  f.fulfilment_status = drilldown.fulfilment_status ?? ''
  f.delivery_status = drilldown.delivery_status ?? ''
  f.invoice_status = drilldown.invoice_status ?? ''
  f.overdue_only = !!drilldown.overdue_only
  f.pending_delivery_only = !!drilldown.pending_delivery_only
  f.pending_invoice_only = !!drilldown.pending_invoice_only
  f.draft_invoice_only = !!drilldown.draft_invoice_only
}

export interface BalanceRow {
  sl_no: number
  customer: string
  customer_name: string
  outstanding_balance: number
}

/**
 * customer_balance.py: one row per customer with its ledger balance, by name.
 * The simulator keeps that balance on the customer as `outstanding`.
 */
export function customerBalanceRows(customers: Customer[], customer: string, showZero: boolean): BalanceRow[] {
  return customers
    .filter((c) => !customer || c.name === customer)
    .filter((c) => showZero || Math.round(c.outstanding * 100) !== 0)
    .sort((a, b) => a.customer_name.localeCompare(b.customer_name))
    .map((c, i) => ({
      sl_no: i + 1,
      customer: c.name,
      customer_name: c.customer_name,
      outstanding_balance: Math.round(c.outstanding * 100) / 100,
    }))
}
