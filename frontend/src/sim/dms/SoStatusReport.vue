<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from 'frappe-ui'
import { resolveDate } from '../../engine/dates'
import type { Reference, StatusRow } from '../../engine/reports'
import { useSim } from '../../engine/sim'
import DmsPicker from './DmsPicker.vue'
import DmsShell from './DmsShell.vue'

/** Copy of dms/frontend/src/pages/SalesOrderStatusReport.vue. */
const sim = useSim()
const f = computed(() => sim.state.so_status)

type Theme = 'gray' | 'blue' | 'green' | 'amber' | 'red'

const SO_STATUSES = ['On Hold', 'To Pay', 'To Deliver and Bill', 'To Bill', 'To Deliver', 'Completed', 'Closed', 'Cancelled']
const FULFILMENT_STATUSES = [
  'Fully Completed',
  'Delivered – Invoice Pending',
  'Partially Delivered',
  'Not Delivered',
  'Closed',
  'Cancelled',
]
const DELIVERY_STATUSES = ['Not Delivered', 'Partly Delivered', 'Fully Delivered', 'Not Applicable', 'Closed', 'Cancelled']
const INVOICE_STATUSES = ['Not Invoiced', 'Draft Invoice', 'Partly Invoiced', 'Fully Invoiced', 'Closed', 'Cancelled']

const STATUS_THEMES: Record<string, Theme> = {
  'Fully Completed': 'green',
  'Delivered – Invoice Pending': 'amber',
  'Partially Delivered': 'blue',
  'Not Delivered': 'red',
  Closed: 'gray',
  Cancelled: 'gray',
  'Fully Delivered': 'green',
  'Partly Delivered': 'blue',
  'Not Applicable': 'gray',
  'Fully Invoiced': 'green',
  'Partly Invoiced': 'blue',
  'Draft Invoice': 'amber',
  'Not Invoiced': 'red',
}
const STATE_THEMES: Record<string, Theme> = { Draft: 'amber', Submitted: 'green', Cancelled: 'gray' }
const STATE_TEXT: Record<string, string> = {
  Draft: 'text-ink-amber-3',
  Submitted: 'text-ink-blue-link',
  Cancelled: 'text-ink-gray-5 line-through',
}

interface Column {
  fieldname: keyof StatusRow | 'delivery_notes' | 'sales_invoices'
  label: string
  type: 'link' | 'text' | 'date' | 'money' | 'qty' | 'pending' | 'status' | 'refs' | 'overdue'
}

/** get_columns() in sales_order_status.py, without the hidden Currency. */
const COLUMNS: Column[] = [
  { fieldname: 'sales_order', label: 'Sales Order', type: 'link' },
  { fieldname: 'customer', label: 'Customer', type: 'link' },
  { fieldname: 'customer_name', label: 'Customer Name', type: 'text' },
  { fieldname: 'transaction_date', label: 'Transaction Date', type: 'date' },
  { fieldname: 'delivery_date', label: 'Expected Delivery Date', type: 'date' },
  { fieldname: 'company', label: 'Company', type: 'text' },
  { fieldname: 'order_value', label: 'Order Value', type: 'money' },
  { fieldname: 'ordered_qty', label: 'Ordered Qty', type: 'qty' },
  { fieldname: 'delivered_qty', label: 'Delivered Qty', type: 'qty' },
  { fieldname: 'pending_delivery_qty', label: 'Pending Delivery Qty', type: 'pending' },
  { fieldname: 'invoiced_qty', label: 'Invoiced Qty', type: 'qty' },
  { fieldname: 'pending_invoice_qty', label: 'Pending Invoice Qty', type: 'pending' },
  { fieldname: 'draft_invoice_qty', label: 'Draft Invoice Qty', type: 'pending' },
  { fieldname: 'sales_order_status', label: 'Sales Order Status', type: 'text' },
  { fieldname: 'delivery_status', label: 'Delivery Status', type: 'status' },
  { fieldname: 'invoice_status', label: 'Invoice Status', type: 'status' },
  { fieldname: 'fulfilment_status', label: 'Overall Fulfilment Status', type: 'status' },
  { fieldname: 'delivery_notes', label: 'Delivery Notes', type: 'refs' },
  { fieldname: 'sales_invoices', label: 'Sales Invoices', type: 'refs' },
  { fieldname: 'days_overdue', label: 'Days Overdue', type: 'overdue' },
]
const NUMERIC = new Set(['money', 'qty', 'pending', 'overdue'])
/** The cells a step can point at: `dms.so_cell:SAL-ORD-2026-00101/fulfilment_status`. */
const CELL_TOURS = new Set(['delivery_status', 'invoice_status', 'fulfilment_status', 'days_overdue', 'pending_delivery_qty', 'draft_invoice_qty'])

const rows = computed(() => sim.statusRows.value)
const summary = computed(() => sim.statusSummary.value)
const fromDate = resolveDate('today-365')
const toDate = resolveDate('today')
const selected = ref<string[]>([])

const detailsRow = computed(() => rows.value.find((r) => r.sales_order === sim.state.ui.dms_details))

const refsOf = (row: StatusRow, field: string): Reference[] =>
  field === 'sales_invoices' ? row.invoice_refs : row.delivery_note_refs
const doctypeOf = (field: string) => (field === 'sales_invoices' ? 'Sales Invoice' : 'Delivery Note')

const money = (n: number | null | undefined) =>
  `${sim.state.settings.currency} ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const cardValue = (card: (typeof summary.value)[number]) => (card.currency ? money(card.value) : card.value)

function toggleRow(name: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  selected.value = checked ? [...selected.value, name] : selected.value.filter((n) => n !== name)
}

function exportReport() {
  void sim.alert('info', 'In training, Export does not download a file. On the real site it saves an Excel sheet of these rows.', 'desk')
}
</script>

<template>
  <DmsShell active="so_status" title="Sales Order Status Report">
    <div class="w-full space-y-4 px-3 pb-10 pt-6 sm:px-5">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-40"><span class="dms-label">Company</span><input class="dms-input" aria-label="Company" /></div>
        <div class="w-36"><span class="dms-label">From Date</span><input class="dms-input" type="date" :value="fromDate" aria-label="From Date" readonly /></div>
        <div class="w-36"><span class="dms-label">To Date</span><input class="dms-input" type="date" :value="toDate" aria-label="To Date" readonly /></div>
        <DmsPicker
          v-model="f.customer"
          name="customer"
          label="Customer"
          placeholder="Search customer name or ID"
          tour="dms.filter.customer"
        />
        <div class="w-44">
          <span class="dms-label">Sales Order Status</span>
          <select v-model="f.sales_order_status" class="dms-input" data-tour="dms.filter.so_status" aria-label="Sales Order Status">
            <option value="" />
            <option v-for="s in SO_STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="w-52">
          <span class="dms-label">Fulfilment Status</span>
          <select v-model="f.fulfilment_status" class="dms-input" data-tour="dms.filter.fulfilment" aria-label="Fulfilment Status">
            <option value="" />
            <option v-for="s in FULFILMENT_STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="w-40">
          <span class="dms-label">Delivery Status</span>
          <select v-model="f.delivery_status" class="dms-input" data-tour="dms.filter.delivery" aria-label="Delivery Status">
            <option value="" />
            <option v-for="s in DELIVERY_STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="w-40">
          <span class="dms-label">Invoice Status</span>
          <select v-model="f.invoice_status" class="dms-input" data-tour="dms.filter.invoice" aria-label="Invoice Status">
            <option value="" />
            <option v-for="s in INVOICE_STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3" data-tour="dms.checks">
        <label class="dms-check"><input v-model="f.overdue_only" type="checkbox" data-tour="dms.check.overdue" />Overdue Deliveries Only</label>
        <label class="dms-check"><input v-model="f.pending_delivery_only" type="checkbox" data-tour="dms.check.pending_delivery" />Pending Delivery Only</label>
        <label class="dms-check"><input v-model="f.pending_invoice_only" type="checkbox" data-tour="dms.check.pending_invoice" />Pending Invoice Only</label>
        <label class="dms-check"><input v-model="f.draft_invoice_only" type="checkbox" data-tour="dms.check.draft_invoice" />Draft Invoices Only</label>
        <label class="dms-check"><input type="checkbox" />Show All Invoices</label>
        <button class="dms-btn" @click="exportReport">
          <span class="lucide-download size-4" aria-hidden="true" />{{ selected.length ? `Export Selected (${selected.length})` : 'Export' }}
        </button>
        <button v-if="selected.length" class="dms-btn" @click="selected = []">Clear Selection</button>
      </div>

      <div class="flex flex-wrap gap-3" data-tour="dms.cards">
        <component
          :is="card.drilldown ? 'button' : 'div'"
          v-for="card in summary"
          :key="card.key"
          class="min-w-40 rounded-6 border border-outline-gray-1 px-4 py-3 text-left"
          :class="[card.drilldown ? 'hover:bg-surface-gray-2' : '', sim.state.ui.dms_card === card.key ? 'ring-1 ring-outline-gray-4' : '']"
          :title="card.drilldown ? 'Click to filter' : undefined"
          :data-tour="`dms.card:${card.key}`"
          @click="card.drilldown && sim.clickStatusCard(card.key)"
        >
          <p class="text-sm text-ink-gray-5">{{ card.label }}</p>
          <p class="mt-1 text-lg font-semibold text-ink-gray-8">{{ cardValue(card) }}</p>
        </component>
      </div>

      <div v-if="!rows.length" class="flex flex-col items-center justify-center gap-3 py-16 text-center" data-tour="dms.table">
        <span class="lucide-clipboard-list size-6 text-ink-gray-5" aria-hidden="true" />
        <p class="text-sm text-ink-gray-5">No sales orders for these filters.</p>
      </div>
      <div v-else class="overflow-x-auto rounded-6 border border-outline-gray-1" data-tour="dms.table">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-outline-gray-1 text-ink-gray-6">
              <th class="w-10 px-4 py-2"><input type="checkbox" aria-label="Select all rows" /></th>
              <th class="px-4 py-2 font-medium">#</th>
              <th
                v-for="col in COLUMNS"
                :key="col.fieldname"
                class="whitespace-nowrap px-4 py-2 font-medium"
                :class="NUMERIC.has(col.type) ? 'text-right' : 'text-left'"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-gray-1">
            <tr
              v-for="(row, i) in rows"
              :key="row.sales_order"
              :data-tour="`dms.so_row:${row.sales_order}`"
              :class="selected.includes(row.sales_order) ? 'bg-surface-gray-2' : ''"
            >
              <td class="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  :checked="selected.includes(row.sales_order)"
                  :aria-label="`Select ${row.sales_order}`"
                  @change="toggleRow(row.sales_order, $event)"
                />
              </td>
              <td class="px-4 py-2 text-ink-gray-7">{{ i + 1 }}</td>
              <td
                v-for="col in COLUMNS"
                :key="col.fieldname"
                class="whitespace-nowrap px-4 py-2"
                :class="NUMERIC.has(col.type) ? 'text-right text-ink-gray-7' : 'text-ink-gray-8'"
                :data-tour="CELL_TOURS.has(col.fieldname) ? `dms.so_cell:${row.sales_order}/${col.fieldname}` : undefined"
              >
                <Badge
                  v-if="col.type === 'status'"
                  :label="String(row[col.fieldname as keyof StatusRow])"
                  :theme="STATUS_THEMES[String(row[col.fieldname as keyof StatusRow])] ?? 'gray'"
                />
                <div v-else-if="col.type === 'refs'" class="flex items-center gap-2">
                  <template v-if="refsOf(row, col.fieldname).length">
                    <button
                      class="text-xs text-ink-gray-5 hover:text-ink-gray-8"
                      title="View details"
                      :data-tour="col.fieldname === 'sales_invoices' ? `dms.so_info:${row.sales_order}` : `dms.so_dn_info:${row.sales_order}`"
                      @click="sim.state.ui.dms_details = row.sales_order"
                    >
                      <span class="lucide-info size-4" aria-hidden="true" />
                    </button>
                    <button
                      v-for="ref in refsOf(row, col.fieldname)"
                      :key="ref.name"
                      class="hover:underline"
                      :class="STATE_TEXT[ref.state]"
                      :title="`${ref.state} · ${ref.status}`"
                      @click="sim.openInDesk(doctypeOf(col.fieldname), ref.name)"
                    >
                      {{ ref.name }}
                    </button>
                  </template>
                </div>
                <button
                  v-else-if="col.type === 'link'"
                  class="text-ink-blue-link hover:underline"
                  :data-tour="col.fieldname === 'sales_order' ? `dms.so_link:${row.sales_order}` : undefined"
                  @click="col.fieldname === 'sales_order' && sim.openInDesk('Sales Order', row.sales_order)"
                >
                  {{ row[col.fieldname as keyof StatusRow] }}
                </button>
                <template v-else-if="col.type === 'money'">{{ money(row.order_value) }}</template>
                <template v-else-if="col.type === 'overdue'">
                  <span v-if="row.days_overdue > 0" class="font-semibold text-ink-red-4">{{ row.days_overdue }}</span>
                </template>
                <span
                  v-else-if="col.type === 'pending'"
                  :class="Number(row[col.fieldname as keyof StatusRow]) > 0 ? 'text-ink-amber-3' : ''"
                >
                  {{ row[col.fieldname as keyof StatusRow] }}
                </span>
                <template v-else>{{ row[col.fieldname as keyof StatusRow] }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-1">
          <button v-for="size in [20, 100, 500, 2500]" :key="size" class="dms-btn" :class="{ solid: size === 20 }">{{ size }}</button>
          <button class="dms-btn">All</button>
        </div>
        <span class="text-sm text-ink-gray-5">Showing {{ rows.length }} of {{ rows.length }}</span>
      </div>
    </div>

    <template #overlay>
      <div v-if="detailsRow" class="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-6">
        <div class="w-full max-w-4xl rounded-7 bg-surface-elevation-1 shadow-2xl" role="dialog" aria-modal="true" data-tour="dms.details">
          <div class="flex items-center justify-between px-5 pb-2 pt-5">
            <h3 class="text-xl font-semibold text-ink-gray-9">Linked Documents for {{ detailsRow.sales_order }}</h3>
            <button class="dms-btn !bg-transparent px-1.5" aria-label="Close" data-tour="dms.details.close" @click="sim.state.ui.dms_details = ''">
              <span class="lucide-x size-4" aria-hidden="true" />
            </button>
          </div>
          <div class="space-y-4 px-5 pb-6 text-sm">
            <template v-for="field in ['sales_invoices', 'delivery_notes']" :key="field">
              <h4 class="font-semibold text-ink-gray-8">{{ doctypeOf(field) }}s</h4>
              <p v-if="!refsOf(detailsRow, field).length" class="text-ink-gray-5">None</p>
              <div v-else class="overflow-x-auto rounded-6 border border-outline-gray-1" :data-tour="`dms.details.${field}`">
                <table class="w-full text-left">
                  <thead>
                    <tr class="border-b border-outline-gray-1 text-ink-gray-6">
                      <th class="px-3 py-2 font-medium">{{ doctypeOf(field) }}</th>
                      <th class="px-3 py-2 font-medium">Document Status</th>
                      <th class="px-3 py-2 font-medium">Status</th>
                      <th class="px-3 py-2 font-medium">Posting Date</th>
                      <th class="px-3 py-2 text-right font-medium">Qty</th>
                      <template v-if="field === 'sales_invoices'">
                        <th class="px-3 py-2 text-right font-medium">Grand Total</th>
                        <th class="px-3 py-2 text-right font-medium">Outstanding</th>
                      </template>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-outline-gray-1">
                    <tr v-for="ref in refsOf(detailsRow, field)" :key="ref.name">
                      <td class="px-3 py-2">
                        <button
                          class="text-ink-blue-link hover:underline"
                          :data-tour="`dms.details.link:${ref.name}`"
                          @click="sim.openInDesk(doctypeOf(field), ref.name)"
                        >
                          {{ ref.name }}
                        </button>
                      </td>
                      <td class="px-3 py-2"><Badge :label="ref.state" :theme="STATE_THEMES[ref.state]" /></td>
                      <td class="px-3 py-2 text-ink-gray-7">{{ ref.status }}</td>
                      <td class="px-3 py-2 text-ink-gray-7">{{ ref.posting_date }}</td>
                      <td class="px-3 py-2 text-right text-ink-gray-7">{{ ref.qty }}</td>
                      <template v-if="field === 'sales_invoices'">
                        <td class="px-3 py-2 text-right text-ink-gray-7">{{ money(ref.grand_total) }}</td>
                        <td class="px-3 py-2 text-right text-ink-gray-7">
                          {{ ref.outstanding_amount == null ? '' : money(ref.outstanding_amount) }}
                        </td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
            <p class="text-xs text-ink-gray-5">
              Cancelled invoices are hidden. Enable Show All Invoices to see them. Qty is the quantity of this order on
              the invoice. Grand Total is the whole invoice.
            </p>
          </div>
        </div>
      </div>
    </template>
  </DmsShell>
</template>
