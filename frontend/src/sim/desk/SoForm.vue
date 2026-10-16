<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSim } from '../../engine/sim'
import Connections from './Connections.vue'
import DeskShell from './DeskShell.vue'
import FormSidebar from './FormSidebar.vue'
import { deskDate, deskMoney, inWords } from './format'

/**
 * A submitted Sales Order in Desk, laid out like erpnext/selling/doctype/sales_order:
 * the Details tab with its sections, the Update Items / Status / Create buttons
 * that sales_order.js adds for "To Deliver and Bill", and the Connections tab.
 */
const sim = useSim()
const tab = ref('Details')
const openRow = ref('')
const showCurrency = ref(false)

const so = computed(() => sim.order(sim.state.ui.desk_so))
const customer = computed(() => (so.value ? sim.customer(so.value.customer) : undefined))
const invoice = computed(() => (so.value ? sim.invoiceFor(so.value.name) : undefined))
const notes = computed(() => sim.state.delivery_notes.filter((dn) => dn.sales_order === so.value?.name))
const menu = computed(() => sim.state.ui.desk_menu)

const totalQty = computed(() => so.value?.items.reduce((s, l) => s + l.qty, 0) ?? 0)
const perDelivered = computed(() => {
  const lines = so.value?.items ?? []
  const qty = lines.reduce((s, l) => s + l.qty, 0)
  return qty ? (lines.reduce((s, l) => s + Math.min(l.delivered_qty, l.qty), 0) / qty) * 100 : 0
})
const perBilled = computed(() => (invoice.value?.docstatus === 1 ? 100 : 0))
const fullyDelivered = computed(() => perDelivered.value >= 100)
const row = computed(() => so.value?.items.find((l) => l.item_code === openRow.value))

/** The Create menu sales_order.js builds for a submitted, undelivered, unbilled order. */
const CREATE_ITEMS = [
  'Pick List',
  'Delivery Note',
  'Work Order',
  'Production Plan',
  'Sales Invoice',
  'Material Request',
  'Request for Raw Materials',
  'Purchase Order',
  'Project',
  'Payment Request',
  'Payment',
]

/** Once everything is delivered, sales_order.js drops the delivery and purchasing items. */
const DELIVERY_ONLY = new Set([
  'Pick List',
  'Delivery Note',
  'Work Order',
  'Production Plan',
  'Material Request',
  'Request for Raw Materials',
  'Purchase Order',
])
const createItems = computed(() =>
  fullyDelivered.value ? CREATE_ITEMS.filter((item) => !DELIVERY_ONLY.has(item)) : CREATE_ITEMS,
)

const connections = computed(() => [
  {
    label: 'Fulfillment',
    items: [
      {
        doctype: 'Sales Invoice',
        docs: invoice.value
          ? [
              {
                name: invoice.value.name,
                status: invoice.value.status,
                tour: `desk.so.si_link:${invoice.value.name}`,
                open: () => sim.openDeskSalesInvoice(invoice.value!.name),
              },
            ]
          : [],
      },
      { doctype: 'Pick List', docs: [] },
      {
        doctype: 'Delivery Note',
        docs: notes.value.map((dn) => ({
          name: dn.name,
          status: dn.status,
          tour: `desk.so.dn_link:${dn.name}`,
          open: () => sim.openDeskDeliveryNote(dn.name),
        })),
      },
      { doctype: 'Maintenance Visit', docs: [] },
    ],
  },
  { label: 'Purchasing', items: [{ doctype: 'Material Request', docs: [] }, { doctype: 'Purchase Order', docs: [] }] },
  { label: 'Projects', items: [{ doctype: 'Project', docs: [] }] },
  { label: 'Manufacturing', items: [{ doctype: 'Work Order', docs: [] }, { doctype: 'BOM', docs: [] }, { doctype: 'Blanket Order', docs: [] }] },
  { label: 'Reference', items: [{ doctype: 'Quotation', docs: [] }, { doctype: 'Auto Repeat', docs: [] }, { doctype: 'Stock Reservation Entry', docs: [] }] },
  { label: 'Payment', items: [{ doctype: 'Payment Entry', docs: [] }, { doctype: 'Payment Request', docs: [] }, { doctype: 'Journal Entry', docs: [] }] },
])

const IN_TRAINING: Record<string, string> = {
  'Delivery Note': 'desk.create.delivery_note',
  'Sales Invoice': 'desk.create.sales_invoice',
}

function create(item: string) {
  if (!so.value) return
  if (item === 'Delivery Note') sim.makeDeliveryNote(so.value.name)
  else if (item === 'Sales Invoice') sim.makeSalesInvoice(so.value.name)
  else notInTraining()
}

function notInTraining() {
  sim.state.ui.desk_menu = ''
  void sim.alert('info', 'This action is not part of this training scenario.', 'desk')
}
</script>

<template>
  <DeskShell
    v-model:tab="tab"
    workspace="selling"
    doctype="Sales Order"
    list-screen="desk.so_list"
    :title="so?.name"
    :status="so?.status"
    :tabs="['Details', 'Address & Contact', 'Terms', 'More Info', 'Connections']"
  >
    <template #actions>
      <button class="d-btn icon" aria-label="Previous document"><span class="lucide-chevron-left size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Next document"><span class="lucide-chevron-right size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Menu"><span class="lucide-ellipsis size-4" aria-hidden="true" /></button>
      <button v-if="!fullyDelivered" class="d-btn" data-tour="desk.update_items" @click="notInTraining">Update Items</button>
      <button class="d-btn" data-tour="desk.status_menu" @click="sim.toggleDeskMenu('status')">
        Status <span class="lucide-chevrons-up-down size-4" aria-hidden="true" />
      </button>
      <button class="d-btn primary" data-tour="desk.create" @click="sim.toggleDeskMenu('create')">
        Create <span class="lucide-chevrons-up-down size-4" aria-hidden="true" />
      </button>
      <div v-if="menu === 'status'" class="d-menu" role="menu" style="right: 80px">
        <button class="d-menu-item" @click="notInTraining">Hold</button>
        <button class="d-menu-item" @click="notInTraining">Close</button>
      </div>
      <div v-if="menu === 'create' && so" class="d-menu" role="menu">
        <button
          v-for="item in createItems"
          :key="item"
          class="d-menu-item"
          :data-tour="IN_TRAINING[item]"
          :title="IN_TRAINING[item] ? undefined : 'Not part of this training'"
          @click="create(item)"
        >
          {{ item }}
        </button>
      </div>
    </template>

    <template v-if="so && tab === 'Details'">
      <section class="d-section">
        <div class="d-section-inner">
          <div class="d-columns">
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Customer<span class="reqd">*</span></span>
                <div class="d-control">{{ so.customer_name }}</div>
              </div>
            </div>
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Order Type<span class="reqd">*</span></span>
                <div class="d-control">Sales</div>
              </div>
              <div class="d-field">
                <span class="d-label">Date<span class="reqd">*</span></span>
                <div class="d-control">{{ deskDate(so.transaction_date) }}</div>
              </div>
              <div class="d-field">
                <span class="d-label">Delivery Date</span>
                <div class="d-control">{{ deskDate(so.delivery_date) }}</div>
              </div>
            </div>
            <div class="d-column" />
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-head collapsible" @click="showCurrency = !showCurrency">
          <div style="max-width: 900px; width: 100%; margin: 0 auto; display: flex; gap: 6px; align-items: center">
            Currency and Price List
            <span :class="showCurrency ? 'lucide-chevron-down' : 'lucide-chevron-right'" class="size-4" aria-hidden="true" />
          </div>
        </div>
        <div v-if="showCurrency" class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Currency</span><div class="d-control">QAR</div></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">Price List</span><div class="d-control">Standard Selling</div></div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-inner">
          <div class="d-section-head" style="padding: 3px 15px 15px">Items</div>
          <div class="d-columns two">
            <div class="d-column" />
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Set Source Warehouse</span>
                <div class="d-control">{{ so.warehouse }}</div>
              </div>
            </div>
          </div>
          <div class="d-full">
            <div class="d-grid-label">Items</div>
            <div class="d-grid" data-tour="desk.so.items">
              <table>
                <thead>
                  <tr>
                    <th class="chk"><input type="checkbox" disabled aria-label="Select all" /></th>
                    <th class="no">No.</th>
                    <th>Item Code<span class="reqd">*</span></th>
                    <th>Delivery Date<span class="reqd">*</span></th>
                    <th class="num">Quantity<span class="reqd">*</span></th>
                    <th class="num">Rate (QAR)</th>
                    <th class="num">Amount (QAR)</th>
                    <th class="edit"><span class="lucide-settings size-4" aria-hidden="true" /></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(line, i) in so.items" :key="line.item_code">
                    <td class="chk"><input type="checkbox" disabled :aria-label="`Select row ${i + 1}`" /></td>
                    <td class="no">{{ i + 1 }}</td>
                    <td>{{ line.item_code }}: {{ line.item_name }}</td>
                    <td>{{ deskDate(so.delivery_date) }}</td>
                    <td class="num">{{ line.qty }}</td>
                    <td class="num">{{ deskMoney(line.rate) }}</td>
                    <td class="num">{{ deskMoney(line.amount) }}</td>
                    <td class="edit">
                      <button
                        class="d-fs-add"
                        :data-tour="`desk.so.row:${line.item_code}`"
                        :aria-label="`Open row ${i + 1}`"
                        @click="openRow = openRow === line.item_code ? '' : line.item_code"
                      >
                        <span class="lucide-pencil size-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="row" class="row-panel" data-tour="desk.so.row_panel">
              <div class="row-panel-head">
                <span>Editing Row #{{ so.items.indexOf(row) + 1 }}</span>
                <button class="d-fs-add" aria-label="Close row" @click="openRow = ''">
                  <span class="lucide-x size-4" aria-hidden="true" />
                </button>
              </div>
              <div class="d-columns two" style="padding-top: 12px">
                <div class="d-column">
                  <div class="d-field"><span class="d-label">Item Code</span><div class="d-control">{{ row.item_code }}</div></div>
                  <div class="d-field"><span class="d-label">Item Name</span><div class="d-control">{{ row.item_name }}</div></div>
                  <div class="d-field"><span class="d-label">Quantity</span><div class="d-control">{{ row.qty }}</div></div>
                  <div class="d-field"><span class="d-label">Rate (QAR)</span><div class="d-control">{{ deskMoney(row.rate) }}</div></div>
                </div>
                <div class="d-column">
                  <div class="d-field"><span class="d-label">Warehouse</span><div class="d-control">{{ so.warehouse }}</div></div>
                  <div class="d-field" data-tour="desk.so.row_delivered">
                    <span class="d-label">Delivered Qty</span><div class="d-control">{{ row.delivered_qty }}</div>
                  </div>
                  <div class="d-field">
                    <span class="d-label">Billed Amt</span>
                    <div class="d-control">{{ deskMoney(invoice?.docstatus === 1 ? row.amount : 0) }}</div>
                  </div>
                  <div class="d-field"><span class="d-label">Amount (QAR)</span><div class="d-control">{{ deskMoney(row.amount) }}</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-inner">
          <div class="d-columns">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Total Quantity</span><div class="d-control">{{ totalQty }}</div></div>
            </div>
            <div class="d-column" />
            <div class="d-column">
              <div class="d-field"><span class="d-label">Total (QAR)</span><div class="d-control">{{ deskMoney(so.total) }}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Totals</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Grand Total (QAR)</span><div class="d-control">{{ deskMoney(so.grand_total) }}</div></div>
              <div class="d-field"><span class="d-label">In Words (QAR)</span><div class="d-control">{{ inWords(so.grand_total) }}</div></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">Rounded Total (QAR)</span><div class="d-control">{{ deskMoney(Math.round(so.grand_total)) }}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="so.discount_amount" class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Additional Discount</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Apply Additional Discount On</span><div class="d-control">Grand Total</div></div>
            </div>
            <div class="d-column">
              <div v-if="so.discount_type === 'Percentage'" class="d-field">
                <span class="d-label">Additional Discount Percentage</span><div class="d-control">{{ so.discount_value }}</div>
              </div>
              <div class="d-field"><span class="d-label">Additional Discount Amount (QAR)</span><div class="d-control">{{ deskMoney(so.discount_amount) }}</div></div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="so && tab === 'Address & Contact'">
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Billing Address</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Customer Address</span><div class="d-control">{{ so.customer_name }}-Billing</div></div>
              <div class="d-field"><span class="d-label">Address</span><div class="d-control" style="padding: 6px 8px; font-weight: 420">{{ customer?.address }}</div></div>
              <div class="d-field"><span class="d-label">Territory</span><div class="d-control">{{ customer?.territory }}</div></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">Mobile No</span><div class="d-control">{{ customer?.mobile }}</div></div>
            </div>
          </div>
        </div>
      </section>
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Shipping Address</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Shipping Address Name</span><div class="d-control">{{ so.customer_name }}-Billing</div></div>
              <div class="d-field"><span class="d-label">Shipping Address</span><div class="d-control" style="padding: 6px 8px; font-weight: 420">{{ customer?.address }}</div></div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="so && tab === 'Terms'">
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Payment Terms</div></div>
        <div class="d-section-inner">
          <div class="d-full">
            <div class="d-grid-label">Payment Schedule</div>
            <div class="d-grid">
              <table>
                <thead>
                  <tr><th class="no">No.</th><th>Due Date</th><th class="num">Invoice Portion</th><th class="num">Payment Amount</th></tr>
                </thead>
                <tbody>
                  <tr><td class="no">1</td><td>{{ deskDate(so.delivery_date) }}</td><td class="num">100</td><td class="num">{{ deskMoney(so.grand_total) }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="so && tab === 'More Info'">
      <section class="d-section" data-tour="desk.so.status_section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Status</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Status</span><div class="d-control">{{ so.status }}</div></div>
              <div class="d-field"><span class="d-label">% Delivered</span><div class="d-control">{{ perDelivered.toFixed(2) }}</div></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">% Amount Billed</span><div class="d-control">{{ perBilled.toFixed(2) }}</div></div>
              <div class="d-field"><span class="d-label">% Picked</span><div class="d-control">0.00</div></div>
            </div>
          </div>
        </div>
      </section>
      <section v-for="s in ['Commission', 'Sales Team', 'Auto Repeat', 'Print Settings']" :key="s" class="d-section">
        <div class="d-section-head collapsible">
          <div style="max-width: 900px; width: 100%; margin: 0 auto; display: flex; gap: 6px; align-items: center">
            {{ s }}<span class="lucide-chevron-right size-4" aria-hidden="true" />
          </div>
        </div>
      </section>
    </template>

    <div v-else-if="so && tab === 'Connections'" data-tour="desk.so.connections">
      <Connections :groups="connections" />
      <div class="d-section" style="border-bottom: none">
        <div class="d-section-inner">
          <div class="d-full">
            <div class="d-note">
              🎓 The store keeper saves the Sales Invoice as a draft before the Delivery Note. When a Delivery Note is
              submitted, the draft invoice's quantities are set to what was delivered, and it is submitted once
              everything is delivered.
            </div>
          </div>
        </div>
      </div>
    </div>

    <template v-if="so" #sidebar>
      <FormSidebar
        :title="so.name"
        :owner="sim.state.settings.rep_name"
        created="3 days ago"
        modified="3 days ago"
      />
    </template>
  </DeskShell>
</template>

<style scoped>
.row-panel {
  margin-top: 12px;
  border: 1px solid var(--d-border);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}
.row-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px;
  border-bottom: 1px solid var(--d-border);
  color: var(--d-text);
  font-weight: 500;
}
</style>
