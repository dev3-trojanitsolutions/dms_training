export type Mode = 'Watch' | 'Guided' | 'Practice'
export type ActionType = 'Click' | 'Enter Value' | 'Select Option' | 'Observe'

/** One row of the Training Step child table. */
export interface Step {
  title: string
  screen: string
  target: string
  action_type: ActionType
  body: string
  hint: string
  expected_field: string
  expected_value: string
  auto_value: string
}

export interface Scenario {
  name: string
  title: string
  track: string
  description: string
  difficulty: string
  passing_score: number
  modes: Mode[]
  seed_data: Partial<Seed>
  steps: Step[]
  next_scenario: string | null
  app_build: string
}

export interface BestResult {
  score: number
  passed: boolean
  watched: boolean
  last_on: string
}

export interface ScenarioSummary {
  name: string
  title: string
  track: string
  description: string
  difficulty: string
  passing_score: number
  modes: Mode[]
  best: BestResult | null
}

export interface Track {
  name: string
  title: string
  description: string
  scenarios: ScenarioSummary[]
}

export interface HomeData {
  user: string
  full_name: string
  is_trainer: boolean
  tracks: Track[]
  app_build: string
}

// ── Simulated ERPNext data ──────────────────────────────────────────

export interface Customer {
  name: string
  customer_name: string
  territory: string
  mobile: string
  address: string
  credit_limit: number
  outstanding: number
  disabled?: boolean
}

export interface Item {
  item_code: string
  item_name: string
  item_group: string
  rate: number
  uom: string
  /** Actual qty per warehouse. */
  stock: Record<string, number>
}

export interface OrderLine {
  item_code: string
  item_name: string
  qty: number
  rate: number
  amount: number
  delivered_qty: number
}

export type DiscountType = '' | 'Percentage' | 'Amount'

export interface SalesOrder {
  name: string
  customer: string
  customer_name: string
  /** ISO date, or `today` / `today-3` in seed data. */
  transaction_date: string
  delivery_date: string
  warehouse: string
  items: OrderLine[]
  discount_type: DiscountType
  discount_value: number
  total: number
  discount_amount: number
  grand_total: number
  /** 0 draft, 1 submitted, 2 cancelled */
  docstatus: 0 | 1 | 2
  status: string
  /** Orders the trainee's rep created. Others are hidden like in the real portal. */
  mine: boolean
}

export interface SalesInvoice {
  name: string
  customer: string
  customer_name?: string
  sales_order: string
  posting_date?: string
  due_date?: string
  items: OrderLine[]
  grand_total: number
  /** Set when submitted; Payment Entries lower it. In seed data it defaults to the grand total. */
  outstanding_amount?: number
  docstatus: 0 | 1 | 2
  status: string
}

export interface PaymentEntry {
  name: string
  payment_type: 'Receive'
  posting_date: string
  mode_of_payment: string
  party: string
  party_name: string
  paid_from: string
  paid_to: string
  paid_amount: number
  reference_no: string
  reference_date: string
  /** The invoice this payment is allocated against, from Create ▾ Payment. */
  reference_name: string
  allocated_amount: number
  docstatus: 0 | 1 | 2
  status: string
}

export interface DeliveryLine {
  item_code: string
  item_name: string
  uom: string
  /** Quantity still to deliver on the Sales Order when the note was made. */
  ordered_qty: number
  /** Quantity on the note; the delivery partner changes it to what was delivered. */
  qty: number
  rate: number
}

export interface DeliveryNote {
  name: string
  customer: string
  customer_name: string
  sales_order: string
  posting_date: string
  warehouse: string
  items: DeliveryLine[]
  /** User id the note is assigned to (the `_assign` field), or empty. */
  assigned_to: string
  attachments: string[]
  remarks: string
  docstatus: 0 | 1 | 2
  status: string
}

export interface DeliveryPartner {
  user: string
  full_name: string
}

export interface Settings {
  company: string
  currency: string
  rep_name: string
  /** The delivery partner the trainee plays in the delivery portal. */
  partner_user: string
  partner_name: string
  store_keeper_name: string
  /** Who is logged in to Desk. Empty means the store keeper. */
  desk_user_name: string
  disable_stock_validation: boolean
  /**
   * Make a draft Sales Invoice (qty 0) when a Sales Order is submitted, like
   * dms create_draft_si_from_so. Off by default: the store keeper creates the
   * draft invoice from the Sales Order in Desk.
   */
  auto_draft_invoice: boolean
}

/** The starting data of a scenario. A scenario's `seed_data` replaces any of these keys. */
export interface Seed {
  settings: Settings
  warehouses: string[]
  customers: Customer[]
  items: Item[]
  sales_orders: SalesOrder[]
  sales_invoices: SalesInvoice[]
  /**
   * Draft or submitted Delivery Notes. In seed data, `items` may be left out:
   * the note then gets everything still to deliver on its Sales Order.
   */
  delivery_notes: DeliveryNote[]
  delivery_partners: DeliveryPartner[]
  payment_entries: PaymentEntry[]
  /** Numbers used for the next document names. */
  next_so: number
  next_si: number
  next_dn: number
  next_pe: number
}
