import { computed, inject, reactive, type InjectionKey } from 'vue'
import { createDraftInvoiceFromOrder, invoiceStatus, salesOrderStatus, syncInvoiceOnDeliverySubmit } from './automation'
import { resolveDate, today } from './dates'
import {
  applyDrilldown,
  customerBalanceRows,
  emptyStatusFilters,
  salesOrderStatusRows,
  salesOrderStatusSummary,
  type StatusFilters,
} from './reports'
import { DEFAULT_SEED } from './seed'
import type {
  Customer,
  DeliveryLine,
  DeliveryNote,
  DiscountType,
  Item,
  OrderLine,
  PaymentEntry,
  SalesInvoice,
  SalesOrder,
  Seed,
} from './types'

/**
 * The in-browser copy of ERPNext a scenario runs against. Nothing here is sent
 * to the server: a scenario can be restarted any number of times.
 */

export type AlertKind = 'validation' | 'credit' | 'stock' | 'success' | 'saved' | 'info'

/** How a dialog looks: the sales portal modal, the browser's own box, or a Desk message. */
export type DialogStyle = 'portal' | 'browser' | 'desk'

/** Short messages that fade out: the delivery portal toast and the Desk alert. */
export type ToastCode = 'saved' | 'submitted' | 'proof_missing' | 'invalid_qty' | 'assigned' | 'unassigned' | 'error'

/** Modes of Payment on the training company, and the account each one pays into. */
export const MODES_OF_PAYMENT: Record<string, string> = {
  Cash: 'Cash - LS',
  Cheque: 'Commercial Bank of Qatar - LS',
  'Wire Transfer': 'Commercial Bank of Qatar - LS',
  'Bank Draft': 'Commercial Bank of Qatar - LS',
  'Credit Card': 'Commercial Bank of Qatar - LS',
}
const BANK_ACCOUNTS = new Set(['Commercial Bank of Qatar - LS'])
const DEBTORS = 'Debtors - LS'
const DEFAULT_CASH = 'Cash - LS'

interface CartLine {
  item_code: string
  qty: number
}

interface Cart {
  customer: string
  warehouse: string
  lines: CartLine[]
  discount_type: DiscountType
  discount_value: number
  order_date: string
  delivery_date: string
  /** Name of the pending order being edited, if any. */
  editing: string
}

function emptyCart(customer = ''): Cart {
  return {
    customer,
    warehouse: '',
    lines: [],
    discount_type: '',
    discount_value: 0,
    order_date: today(),
    delivery_date: '',
    editing: '',
  }
}

function buildSeed(overrides: Partial<Seed>): Seed {
  // A JSON copy, not structuredClone: the overrides arrive as a reactive proxy.
  const seed = JSON.parse(JSON.stringify({ ...DEFAULT_SEED, ...overrides })) as Seed
  seed.settings = { ...DEFAULT_SEED.settings, ...overrides.settings }
  for (const so of seed.sales_orders) {
    so.transaction_date = resolveDate(so.transaction_date)
    so.delivery_date = resolveDate(so.delivery_date)
    applyTotals(so)
  }
  for (const si of seed.sales_invoices) {
    if (si.posting_date) si.posting_date = resolveDate(si.posting_date)
    if (si.due_date) si.due_date = resolveDate(si.due_date)
    // A seeded customer's balance already includes its submitted invoices.
    if (si.docstatus === 1) {
      si.outstanding_amount ??= si.grand_total
      si.status = invoiceStatus(si)
    }
  }
  for (const pe of seed.payment_entries) {
    pe.posting_date = resolveDate(pe.posting_date || 'today')
    if (pe.reference_date) pe.reference_date = resolveDate(pe.reference_date)
  }
  seed.delivery_notes = seed.delivery_notes.map((dn) => completeDeliveryNote(dn, seed))
  return seed
}

/** Fill in a Delivery Note from seed data that only names its Sales Order. */
function completeDeliveryNote(partial: Partial<DeliveryNote>, seed: Seed): DeliveryNote {
  const so = seed.sales_orders.find((o) => o.name === partial.sales_order)
  const customer = seed.customers.find((c) => c.name === (partial.customer ?? so?.customer))
  const items =
    partial.items ??
    (so ? pendingLines(so, seed.items) : []).map((line) => ({ ...line }))
  return {
    name: partial.name ?? '',
    customer: customer?.name ?? '',
    customer_name: customer?.customer_name ?? '',
    sales_order: partial.sales_order ?? '',
    posting_date: resolveDate(partial.posting_date ?? 'today'),
    warehouse: partial.warehouse ?? so?.warehouse ?? seed.warehouses[0],
    items,
    assigned_to: partial.assigned_to ?? '',
    attachments: partial.attachments ?? [],
    remarks: partial.remarks ?? '',
    docstatus: partial.docstatus ?? 0,
    status: partial.status ?? (partial.docstatus === 1 ? 'Completed' : 'Draft'),
  }
}

/** ERPNext's make_delivery_note: every line with quantity still to deliver. */
function pendingLines(so: SalesOrder, items: Item[]): DeliveryLine[] {
  return so.items
    .filter((line) => line.qty > line.delivered_qty)
    .map((line) => ({
      item_code: line.item_code,
      item_name: line.item_name,
      uom: items.find((i) => i.item_code === line.item_code)?.uom ?? 'Nos',
      ordered_qty: line.qty - line.delivered_qty,
      qty: line.qty - line.delivered_qty,
      rate: line.rate,
    }))
}

function lineAmount(line: { qty: number; rate: number }) {
  return round(line.qty * line.rate)
}

function round(n: number) {
  return Math.round(n * 100) / 100
}

function discountOf(subtotal: number, type: DiscountType, value: number) {
  if (type === 'Percentage') return round((subtotal * Math.min(Math.max(value, 0), 100)) / 100)
  if (type === 'Amount') return round(Math.min(Math.max(value, 0), subtotal))
  return 0
}

function applyTotals(so: SalesOrder) {
  for (const line of so.items) line.amount = lineAmount(line)
  so.total = round(so.items.reduce((sum, line) => sum + line.amount, 0))
  so.discount_amount = discountOf(so.total, so.discount_type, so.discount_value)
  so.grand_total = round(so.total - so.discount_amount)
}

export function createSim(overrides: Partial<Seed> = {}) {
  const seed = buildSeed(overrides)
  const state = reactive({
    screen: 'portal.sales_home',
    settings: seed.settings,
    warehouses: seed.warehouses,
    customers: seed.customers,
    items: seed.items,
    sales_orders: seed.sales_orders,
    sales_invoices: seed.sales_invoices,
    delivery_notes: seed.delivery_notes,
    delivery_partners: seed.delivery_partners,
    payment_entries: seed.payment_entries,
    counters: { so: seed.next_so, si: seed.next_si, dn: seed.next_dn, pe: seed.next_pe },
    last: { so: '', si: '', dn: '', pe: '' },
    ui: {
      customer_detail: '' as string,
      customer_search: '',
      /** Desk: the Sales Order open in the form. */
      desk_so: '',
      /** Desk: the open toolbar menu, for example `create`. */
      desk_menu: '',
      assign_open: false,
      /** Delivery portal: the note open on the Delivery Note page, and whether it was just submitted. */
      delivery_note: '',
      delivery_success: false,
      /** DMS app: the open search picker (`customer`, `balance_customer`) and the Linked Documents dialog. */
      dms_picker: '',
      dms_details: '',
      dms_card: '',
    },
    /** DMS Sales Order Status report filters. */
    so_status: emptyStatusFilters() as StatusFilters,
    /** DMS Customer Balance report filters. */
    balance: { customer: '', show_zero_balance: false },
    cart: emptyCart(),
    /** Desk: the Delivery Note open in the form. An unsaved one has no name yet. */
    desk_dn: null as DeliveryNote | null,
    /** Desk: the Sales Invoice open in the form. An unsaved one has no name yet. */
    desk_si: null as SalesInvoice | null,
    /** Desk: the Payment Entry open in the form. An unsaved one has no name yet. */
    desk_pe: null as PaymentEntry | null,
    /** Delivery portal: what the partner has changed on the open note. */
    note: { qty: {} as Record<string, number>, attachments: [] as string[], remarks: '' },
    dialog: { open: false, title: '', message: '', confirm_label: '', style: 'portal' as DialogStyle },
    alert: { open: false, kind: '' as AlertKind | '', message: '', style: 'browser' as DialogStyle },
    toast: { open: false, code: '' as ToastCode | '', message: '', error: false, style: 'portal' as DialogStyle },
  })
  let toastTimer: number | undefined

  let resolveDialog: ((ok: boolean) => void) | null = null
  let resolveAlert: (() => void) | null = null

  // ── Lookups ─────────────────────────────────────────────────────

  const customer = (name: string): Customer | undefined => state.customers.find((c) => c.name === name)
  const item = (code: string): Item | undefined => state.items.find((i) => i.item_code === code)
  const order = (name: string): SalesOrder | undefined => state.sales_orders.find((o) => o.name === name)

  /** Actual stock minus what submitted, undelivered orders already hold. */
  function availableQty(code: string, warehouse: string, ignoreOrder = ''): number {
    const actual = item(code)?.stock[warehouse] ?? 0
    const reserved = state.sales_orders
      .filter((so) => so.docstatus === 1 && so.warehouse === warehouse && so.name !== ignoreOrder)
      .flatMap((so) => so.items)
      .filter((line) => line.item_code === code)
      .reduce((sum, line) => sum + Math.max(0, line.qty - line.delivered_qty), 0)
    return Math.max(0, actual - reserved)
  }

  function creditOf(name: string) {
    const c = customer(name)
    const limit = c?.credit_limit ?? 0
    const outstanding = c?.outstanding ?? 0
    return { credit_limit: limit, outstanding, available_credit: Math.max(0, limit - outstanding) }
  }

  // ── Cart totals ─────────────────────────────────────────────────

  const cartLines = computed<OrderLine[]>(() =>
    state.cart.lines.map((line) => {
      const it = item(line.item_code)!
      return {
        item_code: line.item_code,
        item_name: it.item_name,
        qty: line.qty,
        rate: it.rate,
        amount: lineAmount({ qty: line.qty, rate: it.rate }),
        delivered_qty: 0,
      }
    }),
  )
  const cartTotals = computed(() => {
    const subtotal = round(cartLines.value.reduce((sum, line) => sum + line.amount, 0))
    const discount = discountOf(subtotal, state.cart.discount_type, state.cart.discount_value)
    const grand = round(subtotal - discount)
    const credit = creditOf(state.cart.customer)
    const exceeds = credit.credit_limit > 0 && grand > credit.available_credit
    return { subtotal, discount, grand, credit, exceeds }
  })

  // ── Dialogs (the portal's confirm modal and browser alert) ───────

  function confirm(
    title: string,
    message: string,
    confirm_label: string,
    style: DialogStyle = 'portal',
  ): Promise<boolean> {
    Object.assign(state.dialog, { open: true, title, message, confirm_label, style })
    return new Promise((resolve) => (resolveDialog = resolve))
  }

  function closeDialog(ok: boolean) {
    state.dialog.open = false
    resolveDialog?.(ok)
    resolveDialog = null
  }

  function alert(kind: AlertKind, message: string, style: DialogStyle = 'browser'): Promise<void> {
    Object.assign(state.alert, { open: true, kind, message, style })
    return new Promise((resolve) => (resolveAlert = resolve))
  }

  function closeAlert() {
    state.alert.open = false
    resolveAlert?.()
    resolveAlert = null
  }

  function toast(code: ToastCode, message: string, error = false, style: DialogStyle = 'portal') {
    Object.assign(state.toast, { open: true, code, message, error, style })
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (state.toast.open = false), 3500)
  }

  // ── Navigation ──────────────────────────────────────────────────

  function navigate(screen: string) {
    state.screen = screen
    state.toast.open = false
  }

  function openCustomer(name: string) {
    state.ui.customer_detail = name
  }

  function closeCustomer() {
    state.ui.customer_detail = ''
  }

  function startOrder(customerName: string) {
    state.cart = emptyCart(customerName)
    navigate('portal.sales_order')
  }

  // ── Cart editing ────────────────────────────────────────────────

  function addItem(code: string) {
    const line = state.cart.lines.find((l) => l.item_code === code)
    if (line) line.qty += 1
    else state.cart.lines.push({ item_code: code, qty: 1 })
  }

  function setQty(code: string, qty: number) {
    const line = state.cart.lines.find((l) => l.item_code === code)
    if (line) line.qty = Math.max(0, Math.floor(qty) || 0)
  }

  function removeLine(code: string) {
    state.cart.lines = state.cart.lines.filter((l) => l.item_code !== code)
  }

  // ── Order actions (copies of dms/www/sales-order/script.js) ──────

  const fmt = (n: number) =>
    `${state.settings.currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  /** validateOrderInputs() in the real portal. Returns false after showing the message. */
  async function validateCart(): Promise<boolean> {
    const cart = state.cart
    const fail = async (kind: AlertKind, message: string) => {
      await alert(kind, message)
      return false
    }
    const lines = cart.lines.filter((l) => l.qty > 0)
    if (!lines.length) return fail('validation', 'Add at least one item.')
    if (!cart.customer) return fail('validation', 'No customer selected.')
    if (customer(cart.customer)?.disabled)
      return fail('validation', 'This customer is disabled. Sales Orders cannot be created.')
    if (!cart.warehouse) return fail('validation', 'Select a warehouse first.')
    if (cart.order_date && cart.delivery_date && cart.order_date > cart.delivery_date)
      return fail('validation', 'Order date cannot be after delivery date.')
    const { grand, credit, exceeds } = cartTotals.value
    if (exceeds)
      return fail(
        'credit',
        `Order total (${fmt(grand)}) exceeds available credit (${fmt(credit.available_credit)}).`,
      )
    return true
  }

  /** The server-side stock check in dms.api.sales.create_sales_order. */
  function stockError(lines: { item_code: string; qty: number }[], warehouse: string, ignoreOrder = '') {
    if (state.settings.disable_stock_validation) return ''
    for (const line of lines) {
      const available = availableQty(line.item_code, warehouse, ignoreOrder)
      if (line.qty > available) {
        const name = item(line.item_code)?.item_name ?? line.item_code
        return `Error: Insufficient stock for ${name}: requested ${line.qty}, available ${available} in ${warehouse}.`
      }
    }
    return ''
  }

  function writeOrder(docstatus: 0 | 1): SalesOrder {
    const cart = state.cart
    const c = customer(cart.customer)!
    let so = cart.editing ? order(cart.editing) : undefined
    if (!so) {
      const year = new Date().getFullYear()
      so = {
        name: `SAL-ORD-${year}-${String(state.counters.so++).padStart(5, '0')}`,
        customer: c.name,
        customer_name: c.customer_name,
        transaction_date: cart.order_date || today(),
        delivery_date: '',
        warehouse: '',
        items: [],
        discount_type: '',
        discount_value: 0,
        total: 0,
        discount_amount: 0,
        grand_total: 0,
        docstatus: 0,
        status: 'Draft',
        mine: true,
      }
      state.sales_orders.push(so)
    }
    Object.assign(so, {
      delivery_date: cart.delivery_date || cart.order_date || today(),
      warehouse: cart.warehouse,
      items: cartLines.value.filter((l) => l.qty > 0),
      discount_type: cart.discount_type,
      discount_value: cart.discount_value,
      docstatus,
      status: docstatus === 1 ? 'To Deliver and Bill' : 'Draft',
    })
    applyTotals(so)
    state.last.so = so.name
    if (docstatus === 1) afterSubmit(so)
    return so
  }

  function afterSubmit(so: SalesOrder) {
    if (!state.settings.auto_draft_invoice) return
    const si = createDraftInvoiceFromOrder(so, state.counters.si++)
    state.sales_invoices.push(si)
    state.last.si = si.name
  }

  const invoiceFor = (soName: string) => state.sales_invoices.find((si) => si.sales_order === soName)
  const deliveryNote = (name: string) => state.delivery_notes.find((dn) => dn.name === name)
  const partnerName = (user: string) =>
    state.delivery_partners.find((p) => p.user === user)?.full_name ?? user

  // ── Desk: Sales Order → Delivery Note (the store keeper) ─────────

  function openDeskOrder(name: string) {
    state.ui.desk_so = name
    state.ui.desk_menu = ''
    navigate('desk.so_form')
  }

  function toggleDeskMenu(menu: string) {
    state.ui.desk_menu = state.ui.desk_menu === menu ? '' : menu
  }

  /** Create ▾ Delivery Note on the Sales Order: an unsaved note with what is still to deliver. */
  function makeDeliveryNote(soName: string) {
    const so = order(soName)
    if (!so) return
    state.ui.desk_menu = ''
    const lines = pendingLines(so, state.items)
    if (!lines.length) {
      void alert('info', 'All items in this Sales Order have already been delivered.', 'desk')
      return
    }
    const c = customer(so.customer)
    state.desk_dn = {
      name: '',
      customer: so.customer,
      customer_name: c?.customer_name ?? so.customer_name,
      sales_order: so.name,
      posting_date: today(),
      warehouse: so.warehouse,
      items: lines,
      assigned_to: '',
      attachments: [],
      remarks: '',
      docstatus: 0,
      status: 'Draft',
    }
    navigate('desk.dn_form')
  }

  /**
   * Create ▾ Sales Invoice on the Sales Order (make_sales_invoice): an unsaved
   * invoice with the order's quantities and rates. The store keeper saves it
   * as a draft; Delivery Note submission later sets its quantities.
   */
  function makeSalesInvoice(soName: string) {
    const so = order(soName)
    if (!so) return
    state.ui.desk_menu = ''
    const existing = invoiceFor(so.name)
    if (existing) {
      // ERPNext would let you make a second draft, which bills the order twice.
      void alert(
        'info',
        `This Sales Order already has Sales Invoice ${existing.name} (${existing.status}). A second one would invoice the order twice. Open the existing invoice from the Connections tab.`,
        'desk',
      )
      return
    }
    state.desk_si = {
      name: '',
      customer: so.customer,
      customer_name: so.customer_name,
      sales_order: so.name,
      posting_date: today(),
      due_date: today(),
      items: so.items.map((line) => ({ ...line, delivered_qty: 0 })),
      grand_total: so.grand_total,
      docstatus: 0,
      status: 'Draft',
    }
    navigate('desk.si_form')
  }

  function openDeskSalesInvoice(name: string) {
    const si = state.sales_invoices.find((s) => s.name === name)
    if (!si) return
    state.desk_si = si
    navigate('desk.si_form')
  }

  function setDeskSiQty(code: string, qty: number) {
    const line = state.desk_si?.items.find((l) => l.item_code === code)
    if (!line) return
    line.qty = Math.max(0, Number(qty) || 0)
    line.amount = round(line.qty * line.rate)
  }

  /** Ctrl+S on the Sales Invoice form: saved as Draft, not submitted. */
  async function saveDeskSalesInvoice() {
    const si = state.desk_si
    if (!si || si.docstatus !== 0) return
    if (!si.items.some((l) => l.qty > 0)) {
      await alert('validation', 'Sales Invoice must have at least one item with a quantity.', 'desk')
      return
    }
    const so = order(si.sales_order)
    const total = round(si.items.reduce((s, l) => s + l.amount, 0))
    si.grand_total = so ? round(total - discountOf(total, so.discount_type, so.discount_value)) : total
    if (!si.name) {
      si.name = `ACC-SINV-${new Date().getFullYear()}-${String(state.counters.si++).padStart(5, '0')}`
      state.sales_invoices.push(si)
      state.desk_si = state.sales_invoices.find((s) => s.name === si.name)!
    }
    state.last.si = si.name
    toast('saved', 'Saved', false, 'desk')
  }

  /** A submitted invoice raises the customer's ledger balance (GL debit to Debtors). */
  function postInvoice(si: SalesInvoice) {
    si.outstanding_amount = si.grand_total
    si.status = invoiceStatus(si)
    const c = customer(si.customer)
    if (c) c.outstanding = round(c.outstanding + si.grand_total)
  }

  /**
   * Submit on the Sales Invoice form. Normally the invoice is submitted by the
   * Delivery Note hook; a manager submits by hand only when everything was
   * delivered but no invoice was made beforehand.
   */
  async function submitDeskSalesInvoice() {
    const si = state.desk_si
    if (!si?.name || si.docstatus !== 0) return
    const so = order(si.sales_order)
    const delivered = !!so && so.items.every((l) => l.delivered_qty >= l.qty)
    if (!delivered) {
      await alert(
        'info',
        'Leave the Sales Invoice as a draft. When the delivery partner submits the Delivery Note, the invoice quantities are set to what was delivered, and it is submitted automatically once everything is delivered.',
        'desk',
      )
      return
    }
    const ok = await confirm('', `Permanently Submit ${si.name}?`, 'Yes', 'desk')
    if (!ok) return
    si.docstatus = 1
    postInvoice(si)
    if (so) so.status = salesOrderStatus(so, si)
    state.last.si = si.name
    toast('submitted', 'Submitted', false, 'desk')
  }

  // ── Desk: Sales Invoice → Payment Entry (accounts) ───────────────

  const paymentEntry = (name: string) => state.payment_entries.find((pe) => pe.name === name)
  const salesInvoice = (name: string) => state.sales_invoices.find((si) => si.name === name)

  /** Create ▾ Payment on a submitted invoice (get_payment_entry): receive the outstanding amount. */
  function makePaymentEntry(siName: string) {
    const si = salesInvoice(siName)
    state.ui.desk_menu = ''
    if (!si || si.docstatus !== 1) return
    const outstanding = si.outstanding_amount ?? si.grand_total
    state.desk_pe = {
      name: '',
      payment_type: 'Receive',
      posting_date: today(),
      mode_of_payment: '',
      party: si.customer,
      party_name: si.customer_name ?? customer(si.customer)?.customer_name ?? si.customer,
      paid_from: DEBTORS,
      paid_to: DEFAULT_CASH,
      paid_amount: outstanding,
      reference_no: '',
      reference_date: '',
      reference_name: si.name,
      allocated_amount: outstanding,
      docstatus: 0,
      status: 'Draft',
    }
    navigate('desk.pe_form')
  }

  function openDeskPaymentEntry(name: string) {
    const pe = paymentEntry(name)
    if (!pe) return
    state.desk_pe = pe
    navigate('desk.pe_form')
  }

  /** The outstanding amount the open Payment Entry can allocate against. */
  function peOutstanding(pe: PaymentEntry) {
    const si = salesInvoice(pe.reference_name)
    return si ? (si.outstanding_amount ?? si.grand_total) : 0
  }

  /** Edit a Payment Entry field the way payment_entry.js reacts to it. */
  function setPeField(field: 'mode_of_payment' | 'paid_amount' | 'reference_no' | 'reference_date', value: string) {
    const pe = state.desk_pe
    if (!pe || pe.docstatus !== 0) return
    if (field === 'mode_of_payment') {
      pe.mode_of_payment = value
      pe.paid_to = MODES_OF_PAYMENT[value] ?? DEFAULT_CASH
    } else if (field === 'paid_amount') {
      pe.paid_amount = Math.max(0, round(Number(value) || 0))
      // allocate_party_amount_against_ref_docs: up to the invoice's outstanding.
      pe.allocated_amount = Math.min(pe.paid_amount, peOutstanding(pe))
    } else {
      pe[field] = value
    }
  }

  async function validatePaymentEntry(pe: PaymentEntry): Promise<boolean> {
    if (!pe.paid_amount) {
      await alert('validation', 'Mandatory fields required in Payment Entry: Paid Amount', 'desk')
      return false
    }
    if (BANK_ACCOUNTS.has(pe.paid_to) && (!pe.reference_no || !pe.reference_date)) {
      await alert('validation', 'Reference No and Reference Date is mandatory for Bank transaction', 'desk')
      return false
    }
    return true
  }

  /** Ctrl+S on the Payment Entry form. */
  async function saveDeskPaymentEntry() {
    const pe = state.desk_pe
    if (!pe || pe.docstatus !== 0) return
    if (!(await validatePaymentEntry(pe))) return
    if (!pe.name) {
      pe.name = `ACC-PAY-${new Date().getFullYear()}-${String(state.counters.pe++).padStart(5, '0')}`
      state.payment_entries.push(pe)
      state.desk_pe = paymentEntry(pe.name)!
    }
    state.last.pe = pe.name
    toast('saved', 'Saved', false, 'desk')
  }

  /** Submit: the payment is posted, lowering the invoice's outstanding and the customer's balance. */
  async function submitDeskPaymentEntry() {
    const pe = state.desk_pe
    if (!pe?.name || pe.docstatus !== 0) return
    if (!(await validatePaymentEntry(pe))) return
    const ok = await confirm('', `Permanently Submit ${pe.name}?`, 'Yes', 'desk')
    if (!ok) return
    pe.docstatus = 1
    pe.status = 'Submitted'
    const si = salesInvoice(pe.reference_name)
    if (si) {
      si.outstanding_amount = round((si.outstanding_amount ?? si.grand_total) - pe.allocated_amount)
      si.status = invoiceStatus(si)
    }
    const c = customer(pe.party)
    if (c) c.outstanding = round(c.outstanding - pe.paid_amount)
    state.last.pe = pe.name
    toast('submitted', 'Submitted', false, 'desk')
  }

  // ── DMS app (/dms): Sales Order Status and Customer Balance ──────

  const statusRows = computed(() =>
    salesOrderStatusRows(
      state.sales_orders,
      state.sales_invoices,
      state.delivery_notes,
      state.settings.company,
      state.so_status,
    ),
  )
  const statusSummary = computed(() => salesOrderStatusSummary(statusRows.value))
  const balanceRows = computed(() =>
    customerBalanceRows(state.customers, state.balance.customer, state.balance.show_zero_balance),
  )

  function clickStatusCard(key: string) {
    const card = statusSummary.value.find((c) => c.key === key)
    if (!card?.drilldown) return
    applyDrilldown(state.so_status, card.drilldown)
    state.ui.dms_card = key
  }

  function toggleDmsPicker(name: string) {
    state.ui.dms_picker = state.ui.dms_picker === name ? '' : name
  }

  /** A link in a DMS report opens the document in Desk (a new tab on the real site). */
  function openInDesk(doctype: string, name: string) {
    state.ui.dms_details = ''
    state.ui.desk_menu = ''
    if (doctype === 'Sales Order') openDeskOrder(name)
    else if (doctype === 'Sales Invoice') openDeskSalesInvoice(name)
    else if (doctype === 'Delivery Note') openDeskDeliveryNote(name)
  }

  function openDeskDeliveryNote(name: string) {
    const dn = deliveryNote(name)
    if (!dn) return
    state.desk_dn = dn
    navigate('desk.dn_form')
  }

  function setDeskDnQty(code: string, qty: number) {
    const line = state.desk_dn?.items.find((l) => l.item_code === code)
    if (line) line.qty = Math.max(0, Number(qty) || 0)
  }

  /** Ctrl+S on the Delivery Note form. */
  async function saveDeskDeliveryNote() {
    const dn = state.desk_dn
    if (!dn || dn.docstatus !== 0) return
    if (!dn.items.some((l) => l.qty > 0)) {
      await alert('validation', 'Delivery Note must have at least one item with a quantity.', 'desk')
      return
    }
    const over = dn.items.find((l) => l.qty > l.ordered_qty)
    if (over) {
      await alert(
        'validation',
        `This document is over limit by Qty ${over.qty - over.ordered_qty} for item ${over.item_code}. Are you making another Delivery Note against the same Sales Order?`,
        'desk',
      )
      return
    }
    if (!dn.name) {
      dn.name = `MAT-DN-${new Date().getFullYear()}-${String(state.counters.dn++).padStart(5, '0')}`
      state.delivery_notes.push(dn)
      // Keep editing the stored note, so the form and lists show the same object.
      state.desk_dn = deliveryNote(dn.name)!
    }
    state.last.dn = dn.name
    toast('saved', 'Saved', false, 'desk')
  }

  /** The Assign To dialog in the form sidebar. */
  function assignDeliveryNote(user: string) {
    const dn = state.desk_dn
    if (!dn?.name || !user) return
    dn.assigned_to = user
    state.ui.assign_open = false
    toast('assigned', `Assigned to ${partnerName(user)}`, false, 'desk')
  }

  // ── Delivery portal (dms/www/delivery-dashboard, delivery-note) ──

  const me = () => state.settings.partner_user

  /** "Assign to Me" on Delivery Assign. */
  function assignToMe(name: string) {
    const dn = deliveryNote(name)
    if (!dn) return
    if (dn.assigned_to && dn.assigned_to !== me()) {
      toast('error', 'This delivery note is already assigned', true)
      return
    }
    dn.assigned_to = me()
  }

  function unassign(name: string) {
    const dn = deliveryNote(name)
    if (dn?.assigned_to === me()) dn.assigned_to = ''
  }

  function openDeliveryNote(name: string) {
    const dn = deliveryNote(name)
    if (!dn) return
    state.ui.delivery_note = name
    state.ui.delivery_success = false
    state.note = {
      qty: Object.fromEntries(dn.items.map((l) => [l.item_code, l.qty])),
      attachments: [...dn.attachments],
      remarks: dn.remarks,
    }
    navigate('delivery.note')
  }

  function setDeliveredQty(code: string, qty: number) {
    state.note.qty[code] = Number.isNaN(qty) ? 0 : qty
  }

  function stepDeliveredQty(code: string, delta: number) {
    const dn = deliveryNote(state.ui.delivery_note)
    const line = dn?.items.find((l) => l.item_code === code)
    if (!line) return
    state.note.qty[code] = Math.max(0, Math.min(line.ordered_qty, (state.note.qty[code] ?? 0) + delta))
  }

  /** In training, an upload adds a sample file instead of opening the camera or file picker. */
  function addProof(kind: 'camera' | 'photo' | 'pdf') {
    const n = state.note.attachments.length + 1
    state.note.attachments.push(kind === 'pdf' ? `delivery-proof-${n}.pdf` : `delivery-photo-${n}.jpg`)
  }

  function removeProof(index: number) {
    state.note.attachments.splice(index, 1)
  }

  function noteHasInvalidQty() {
    const dn = deliveryNote(state.ui.delivery_note)
    return !!dn?.items.some((l) => {
      const q = state.note.qty[l.item_code] ?? 0
      return q < 0 || q > l.ordered_qty
    })
  }

  function writeNote(dn: DeliveryNote) {
    for (const line of dn.items) line.qty = state.note.qty[line.item_code] ?? line.qty
    dn.attachments = [...state.note.attachments]
    dn.remarks = state.note.remarks
  }

  function saveDeliveryDraft() {
    const dn = deliveryNote(state.ui.delivery_note)
    if (!dn || dn.docstatus !== 0) return
    if (noteHasInvalidQty()) {
      toast('invalid_qty', 'Please correct invalid quantities before saving.', true)
      return
    }
    writeNote(dn)
    toast('saved', 'Draft saved')
  }

  async function submitDelivery() {
    const dn = deliveryNote(state.ui.delivery_note)
    if (!dn || dn.docstatus !== 0) return
    if (noteHasInvalidQty()) {
      toast('invalid_qty', 'Please correct invalid quantities before submitting.', true)
      return
    }
    if (!state.note.attachments.length) {
      toast('proof_missing', 'Please upload at least one proof of delivery.', true)
      return
    }
    const ok = await confirm('', 'Submit this delivery? This cannot be undone.', 'OK', 'browser')
    if (!ok) return
    writeNote(dn)
    dn.items = dn.items.filter((l) => l.qty > 0)
    dn.docstatus = 1
    dn.status = 'Completed'
    state.last.dn = dn.name
    const so = order(dn.sales_order)
    if (so) {
      const si = invoiceFor(so.name)
      const wasDraft = si?.docstatus === 0
      syncInvoiceOnDeliverySubmit(so, si, state.delivery_notes)
      if (si && wasDraft && si.docstatus === 1) postInvoice(si)
      so.status = salesOrderStatus(so, si)
      if (si) state.last.si = si.name
    }
    state.toast.open = false
    state.ui.delivery_success = true
  }

  async function submitCart() {
    if (!(await validateCart())) return
    const ok = await confirm(
      'Submit Sales Order',
      'This will commit stock and cannot be undone. Submit this order now?',
      'Submit',
    )
    if (!ok) return
    const lines = state.cart.lines.filter((l) => l.qty > 0)
    const error = stockError(lines, state.cart.warehouse, state.cart.editing)
    if (error) {
      await alert('stock', error)
      return
    }
    const so = writeOrder(1)
    const customerName = so.customer
    await alert('success', `Order ${so.name} submitted! Total: ${fmt(so.grand_total)}`)
    state.cart = emptyCart()
    state.ui.customer_detail = customerName
    navigate('portal.sales_customer')
  }

  async function saveCart() {
    if (!(await validateCart())) return
    const ok = await confirm(
      'Save as Pending Order',
      'Save this order as a draft you can submit later from Pending Orders?',
      'Save',
    )
    if (!ok) return
    const so = writeOrder(0)
    await alert('saved', `Order ${so.name} saved as pending.`)
    state.cart = emptyCart()
    navigate('portal.pending_orders')
  }

  // ── Pending orders (dms/www/pending-orders/script.js) ────────────

  function reopenOrder(name: string) {
    const so = order(name)
    if (!so) return
    state.cart = {
      customer: so.customer,
      warehouse: so.warehouse,
      lines: so.items.map((l) => ({ item_code: l.item_code, qty: l.qty })),
      discount_type: so.discount_type,
      discount_value: so.discount_value,
      order_date: so.transaction_date,
      delivery_date: so.delivery_date,
      editing: so.name,
    }
    navigate('portal.sales_order')
  }

  async function submitPending(name: string) {
    const so = order(name)
    if (!so) return
    const ok = await confirm('Submit Order', 'This will commit stock and cannot be undone. Submit this order now?', 'Submit')
    if (!ok) return
    const error = stockError(so.items, so.warehouse, so.name)
    if (error) {
      await alert('stock', error)
      return
    }
    so.docstatus = 1
    so.status = 'To Deliver and Bill'
    state.last.so = so.name
    afterSubmit(so)
    await alert('success', `Order ${so.name} submitted.`)
  }

  async function discardPending(name: string) {
    const ok = await confirm('Discard Order', 'Discard this pending order? This cannot be undone.', 'Discard')
    if (!ok) return
    state.sales_orders = state.sales_orders.filter((o) => o.name !== name)
  }

  // ── Values a step can check (Expected Field) ─────────────────────

  /**
   * A plain snapshot for the step checker. `cart.qty.<item_code>`,
   * `last_so.status` and the rest are documented in the Training Step form.
   */
  function context() {
    const qty: Record<string, number> = {}
    for (const line of state.cart.lines) qty[line.item_code] = line.qty
    const lastSo = state.last.so ? order(state.last.so) : undefined
    const lastSi = state.sales_invoices.find((si) => si.name === state.last.si)
    return {
      screen: state.screen,
      ui: { ...state.ui },
      cart: {
        customer: state.cart.customer,
        warehouse: state.cart.warehouse,
        count: state.cart.lines.length,
        qty,
        discount_type: state.cart.discount_type,
        discount_value: state.cart.discount_value,
        delivery_date: state.cart.delivery_date,
        grand_total: cartTotals.value.grand,
        exceeds_credit: cartTotals.value.exceeds,
      },
      dialog: { open: state.dialog.open },
      alert: { open: state.alert.open, kind: state.alert.kind },
      last_so: lastSo ? { ...lastSo, items_count: lastSo.items.length } : {},
      last_si: lastSi ?? {},
      last_dn: state.last.dn ? { ...deliveryNote(state.last.dn) } : {},
      last_pe: state.last.pe ? { ...paymentEntry(state.last.pe) } : {},
      desk_pe: state.desk_pe
        ? {
            ...state.desk_pe,
            saved: !!state.desk_pe.name,
            unallocated_amount: round(state.desk_pe.paid_amount - state.desk_pe.allocated_amount),
          }
        : {},
      // DMS reports: `so_status.filters.pending_delivery_only`, `so_status.count`,
      // `so_status.rows.SAL-ORD-2026-00101.fulfilment_status`, `balance.customers.CUST-0004`.
      so_status: {
        filters: { ...state.so_status },
        card: state.ui.dms_card,
        count: statusRows.value.length,
        rows: Object.fromEntries(statusRows.value.map((r) => [r.sales_order, r])),
        details: state.ui.dms_details,
      },
      balance: {
        customer: state.balance.customer,
        count: balanceRows.value.length,
        total: round(balanceRows.value.reduce((s, r) => s + r.outstanding_balance, 0)),
        customers: Object.fromEntries(state.customers.map((c) => [c.name, round(c.outstanding)])),
      },
      picker: state.ui.dms_picker,
      sis: Object.fromEntries(state.sales_invoices.map((si) => [si.name, si])),
      desk_si: state.desk_si
        ? {
            name: state.desk_si.name,
            saved: !!state.desk_si.name,
            docstatus: state.desk_si.docstatus,
            status: state.desk_si.status,
            outstanding_amount: state.desk_si.outstanding_amount ?? 0,
            count: state.desk_si.items.length,
            qty: Object.fromEntries(state.desk_si.items.map((l) => [l.item_code, l.qty])),
          }
        : {},
      desk_dn: state.desk_dn
        ? {
            name: state.desk_dn.name,
            saved: !!state.desk_dn.name,
            docstatus: state.desk_dn.docstatus,
            warehouse: state.desk_dn.warehouse,
            assigned_to: state.desk_dn.assigned_to,
            count: state.desk_dn.items.length,
            qty: Object.fromEntries(state.desk_dn.items.map((l) => [l.item_code, l.qty])),
          }
        : {},
      note: {
        qty: { ...state.note.qty },
        attachments: state.note.attachments.length,
        remarks: state.note.remarks,
        invalid: noteHasInvalidQty(),
      },
      toast: { open: state.toast.open, code: state.toast.code },
      // By name: `orders.SAL-ORD-2026-00101.status`, `dns.MAT-DN-2026-00001.mine`,
      // `invoice_for.SAL-ORD-2026-00101.status`.
      orders: Object.fromEntries(state.sales_orders.map((o) => [o.name, o])),
      dns: Object.fromEntries(
        state.delivery_notes.map((dn) => [dn.name, { ...dn, mine: dn.assigned_to === me() }]),
      ),
      invoice_for: Object.fromEntries(state.sales_invoices.map((si) => [si.sales_order, si])),
      so_count: state.sales_orders.filter((o) => o.docstatus === 1 && o.mine).length,
      pending_count: state.sales_orders.filter((o) => o.docstatus === 0 && o.mine).length,
    }
  }

  return {
    state,
    cartLines,
    cartTotals,
    customer,
    item,
    order,
    availableQty,
    creditOf,
    fmt,
    confirm,
    closeDialog,
    alert,
    closeAlert,
    toast,
    navigate,
    openCustomer,
    closeCustomer,
    startOrder,
    addItem,
    setQty,
    removeLine,
    submitCart,
    saveCart,
    reopenOrder,
    submitPending,
    discardPending,
    invoiceFor,
    deliveryNote,
    partnerName,
    openDeskOrder,
    toggleDeskMenu,
    makeDeliveryNote,
    openDeskDeliveryNote,
    makeSalesInvoice,
    openDeskSalesInvoice,
    setDeskSiQty,
    saveDeskSalesInvoice,
    submitDeskSalesInvoice,
    salesInvoice,
    paymentEntry,
    makePaymentEntry,
    openDeskPaymentEntry,
    peOutstanding,
    setPeField,
    saveDeskPaymentEntry,
    submitDeskPaymentEntry,
    statusRows,
    statusSummary,
    balanceRows,
    clickStatusCard,
    toggleDmsPicker,
    openInDesk,
    setDeskDnQty,
    saveDeskDeliveryNote,
    assignDeliveryNote,
    assignToMe,
    unassign,
    openDeliveryNote,
    setDeliveredQty,
    stepDeliveredQty,
    addProof,
    removeProof,
    noteHasInvalidQty,
    saveDeliveryDraft,
    submitDelivery,
    context,
  }
}

export type Sim = ReturnType<typeof createSim>

export const SIM_KEY: InjectionKey<Sim> = Symbol('sim')

export function useSim(): Sim {
  const sim = inject(SIM_KEY)
  if (!sim) throw new Error('useSim() called outside the simulator')
  return sim
}
