<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSim } from '../../engine/sim'
import Connections from './Connections.vue'
import DeskShell from './DeskShell.vue'
import FormSidebar from './FormSidebar.vue'
import { deskDate, deskMoney, inWords } from './format'

/**
 * A Sales Invoice in Desk, laid out like erpnext/accounts/doctype/sales_invoice:
 * new from the Sales Order's Create ▾ Sales Invoice (Not Saved), or a saved Draft.
 */
const sim = useSim()
const tab = ref('Details')
const dirty = ref(false)
const showCurrency = ref(false)

const si = computed(() => sim.state.desk_si)
const saved = computed(() => !!si.value?.name)
const editable = computed(() => si.value?.docstatus === 0)
const so = computed(() => (si.value ? sim.order(si.value.sales_order) : undefined))
const status = computed(() => {
  if (!si.value) return ''
  if (!saved.value || dirty.value) return 'Not Saved'
  return si.value.status
})
const tabs = computed(() => {
  const base = ['Details', 'Address & Contact', 'Payments', 'Terms', 'More Info']
  return saved.value ? [...base, 'Connections'] : base
})
const totalQty = computed(() => si.value?.items.reduce((s, l) => s + l.qty, 0) ?? 0)
const total = computed(() => si.value?.items.reduce((s, l) => s + l.qty * l.rate, 0) ?? 0)
const discount = computed(() => {
  const o = so.value
  if (!o?.discount_type) return 0
  return o.discount_type === 'Percentage' ? (total.value * o.discount_value) / 100 : Math.min(o.discount_value, total.value)
})
const grand = computed(() => Math.round((total.value - discount.value) * 100) / 100)
const postingTime = new Date().toTimeString().slice(0, 8)
const menu = computed(() => sim.state.ui.desk_menu)
// The manager works from Accounting; the store keeper from Selling.
const workspace = computed(() => (sim.state.settings.desk_user_name ? 'accounting' : 'selling'))

watch(
  () => si.value?.name,
  () => (dirty.value = false),
)

const submitted = computed(() => si.value?.docstatus === 1)
const outstanding = computed(() => (submitted.value ? (si.value?.outstanding_amount ?? grand.value) : grand.value))
const overdue = computed(() => si.value?.status === 'Overdue')

/** The Create menu sales_invoice.js builds for a submitted invoice. */
const createItems = computed(() => {
  const items: string[] = []
  if (outstanding.value > 0) items.push('Payment')
  items.push('Return / Credit Note')
  if (outstanding.value > 0) items.push('Payment Request', 'Invoice Discounting')
  if (outstanding.value > 0 && overdue.value) items.push('Dunning')
  items.push('Maintenance Schedule')
  return items
})

function create(item: string) {
  if (!si.value) return
  if (item === 'Payment') sim.makePaymentEntry(si.value.name)
  else notInTraining()
}

const connections = computed(() => [
  {
    label: 'Payment',
    items: [
      {
        doctype: 'Payment Entry',
        docs: sim.state.payment_entries
          .filter((pe) => pe.reference_name === si.value?.name && pe.docstatus !== 2)
          .map((pe) => ({
            name: pe.name,
            status: pe.status,
            tour: `desk.si.pe_link:${pe.name}`,
            open: () => sim.openDeskPaymentEntry(pe.name),
          })),
      },
      { doctype: 'Payment Request', docs: [] },
      { doctype: 'Journal Entry', docs: [] },
    ],
  },
  {
    label: 'Reference',
    items: [
      { doctype: 'Timesheet', docs: [] },
      {
        doctype: 'Delivery Note',
        docs: sim.state.delivery_notes
          .filter((dn) => dn.sales_order === si.value?.sales_order)
          .map((dn) => ({ name: dn.name, status: dn.status, open: () => sim.openDeskDeliveryNote(dn.name) })),
      },
      {
        doctype: 'Sales Order',
        docs: so.value
          ? [{ name: so.value.name, status: so.value.status, tour: `desk.si.so_link:${so.value.name}`, open: () => sim.openDeskOrder(so.value!.name) }]
          : [],
      },
    ],
  },
  { label: 'Returns', items: [{ doctype: 'Sales Invoice', docs: [] }] },
])

function onQty(code: string, event: Event) {
  sim.setDeskSiQty(code, Number((event.target as HTMLInputElement).value))
  dirty.value = true
}

async function save() {
  await sim.saveDeskSalesInvoice()
  if (saved.value) dirty.value = false
}

function onSubmitClick() {
  void sim.submitDeskSalesInvoice()
}

function notInTraining() {
  sim.state.ui.desk_menu = ''
  void sim.alert('info', 'This action is not part of this training scenario.', 'desk')
}
</script>

<template>
  <DeskShell
    v-model:tab="tab"
    :workspace="workspace"
    doctype="Sales Invoice"
    list-screen="desk.si_list"
    :title="si?.name || 'New Sales Invoice'"
    :status="status"
    :tabs="tabs"
  >
    <template #actions>
      <template v-if="saved">
        <button class="d-btn icon" aria-label="Previous document"><span class="lucide-chevron-left size-4" aria-hidden="true" /></button>
        <button class="d-btn icon" aria-label="Next document"><span class="lucide-chevron-right size-4" aria-hidden="true" /></button>
        <button class="d-btn icon" aria-label="Menu"><span class="lucide-ellipsis size-4" aria-hidden="true" /></button>
      </template>
      <template v-if="editable">
        <button class="d-btn" @click="sim.toggleDeskMenu('si_get_items')">
          Get Items From <span class="lucide-chevrons-up-down size-4" aria-hidden="true" />
        </button>
        <button v-if="saved && !dirty" class="d-btn primary" data-tour="desk.si.submit" @click="onSubmitClick">Submit</button>
        <button v-else class="d-btn primary" data-tour="desk.si.save" @click="save">Save</button>
      </template>
      <template v-if="submitted">
        <button class="d-btn" @click="sim.toggleDeskMenu('si_view')">
          View <span class="lucide-chevrons-up-down size-4" aria-hidden="true" />
        </button>
        <button class="d-btn primary" data-tour="desk.si.create" @click="sim.toggleDeskMenu('si_create')">
          Create <span class="lucide-chevrons-up-down size-4" aria-hidden="true" />
        </button>
      </template>
      <div v-if="menu === 'si_view'" class="d-menu" role="menu" style="right: 80px">
        <button class="d-menu-item" @click="notInTraining">Accounting Ledger</button>
      </div>
      <div v-if="menu === 'si_create'" class="d-menu" role="menu">
        <button
          v-for="item in createItems"
          :key="item"
          class="d-menu-item"
          :data-tour="item === 'Payment' ? 'desk.si.create.payment' : undefined"
          :title="item === 'Payment' ? undefined : 'Not part of this training'"
          @click="create(item)"
        >
          {{ item }}
        </button>
      </div>
      <div v-if="menu === 'si_get_items'" class="d-menu" role="menu">
        <button class="d-menu-item" @click="notInTraining">Delivery Note</button>
        <button class="d-menu-item" @click="notInTraining">Sales Order</button>
        <button class="d-menu-item" @click="notInTraining">Quotation</button>
      </div>
    </template>

    <template v-if="si && tab === 'Details'">
      <section class="d-section">
        <div class="d-section-inner">
          <div class="d-columns">
            <div class="d-column">
              <div v-if="!saved" class="d-field">
                <span class="d-label">Series<span class="reqd">*</span></span>
                <select class="d-control" aria-label="Series"><option>ACC-SINV-.YYYY.-</option></select>
              </div>
              <div class="d-field">
                <span class="d-label">Customer<span class="reqd">*</span></span>
                <div class="d-control">{{ si.customer_name }}</div>
              </div>
            </div>
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Date<span class="reqd">*</span></span>
                <div class="d-control" style="color: #7c7c7c">{{ deskDate(si.posting_date ?? '') }}</div>
              </div>
              <div class="d-field">
                <span class="d-label">Posting Time</span>
                <div class="d-control" style="color: #7c7c7c">{{ postingTime }}</div>
              </div>
              <label v-if="editable" class="d-check"><input type="checkbox" />Edit Posting Date and Time</label>
              <div class="d-field">
                <span class="d-label">Payment Due Date</span>
                <div class="d-control">{{ deskDate(si.due_date ?? '') }}</div>
              </div>
            </div>
            <div class="d-column">
              <label class="d-check"><input type="checkbox" :disabled="saved" />Include Payment (POS)</label>
              <label class="d-check"><input type="checkbox" :disabled="saved" />Is Return (Credit Note)</label>
            </div>
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
            <div class="d-column">
              <div v-if="editable" class="d-field">
                <span class="d-label">Scan Barcode</span>
                <div class="d-control" style="justify-content: flex-end">
                  <span class="lucide-scan-barcode size-4" aria-hidden="true" />
                </div>
              </div>
              <label v-if="editable" class="d-check"><input type="checkbox" />Update Stock</label>
            </div>
            <div class="d-column" />
          </div>
          <div class="d-full">
            <div class="d-grid-label">Items</div>
            <div class="d-grid" data-tour="desk.si.items">
              <table>
                <thead>
                  <tr>
                    <th class="chk"><input type="checkbox" aria-label="Select all" /></th>
                    <th class="no">No.</th>
                    <th>Item<span class="reqd">*</span></th>
                    <th class="num">Quantity<span class="reqd">*</span></th>
                    <th class="num">Rate (QAR)<span class="reqd">*</span></th>
                    <th class="num">Amount (QAR)<span class="reqd">*</span></th>
                    <th>Warehouse</th>
                    <th class="edit"><span class="lucide-settings size-4" aria-hidden="true" /></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(line, i) in si.items" :key="line.item_code">
                    <td class="chk"><input type="checkbox" :aria-label="`Select row ${i + 1}`" /></td>
                    <td class="no">{{ i + 1 }}</td>
                    <td>{{ line.item_code }}: {{ line.item_name }}</td>
                    <td v-if="editable" class="cell-input">
                      <input
                        type="number"
                        min="0"
                        :value="line.qty"
                        :data-tour="`desk.si.qty:${line.item_code}`"
                        :aria-label="`Quantity of ${line.item_name}`"
                        @input="onQty(line.item_code, $event)"
                      />
                    </td>
                    <td v-else class="num">{{ line.qty }}</td>
                    <td class="num">{{ deskMoney(line.rate) }}</td>
                    <td class="num">{{ deskMoney(line.qty * line.rate) }}</td>
                    <td>{{ so?.warehouse }}</td>
                    <td class="edit"><span class="lucide-pencil size-4" aria-hidden="true" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="editable" class="d-grid-foot">
              <div>
                <button class="d-btn" @click="notInTraining">Add row</button>
                <button class="d-btn" @click="notInTraining">Add multiple</button>
              </div>
              <div>
                <button class="d-btn" @click="notInTraining">Download</button>
                <button class="d-btn" @click="notInTraining">Upload</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-inner">
          <div class="d-columns">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Total Quantity</span><div class="d-control" style="color: #7c7c7c">{{ totalQty }}</div></div>
            </div>
            <div class="d-column" />
            <div class="d-column">
              <div class="d-field"><span class="d-label">Total (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ deskMoney(total) }}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="editable" class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Taxes and Charges</div></div>
        <div class="d-section-inner">
          <div class="d-columns">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Tax Category</span><div class="d-control empty" /></div>
              <div class="d-field"><span class="d-label">Sales Taxes and Charges Template</span><div class="d-control empty" /></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">Shipping Rule</span><div class="d-control empty" /></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">Incoterm</span><div class="d-control empty" /></div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Totals</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Grand Total (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ deskMoney(grand) }}</div></div>
              <div class="d-field"><span class="d-label">In Words (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ inWords(grand) }}</div></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">Rounded Total (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ deskMoney(Math.round(grand)) }}</div></div>
              <div class="d-field" data-tour="desk.si.outstanding">
                <span class="d-label">Outstanding Amount (QAR)</span>
                <div class="d-control" style="color: #7c7c7c">{{ deskMoney(outstanding) }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="si && tab === 'Address & Contact'">
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Billing Address</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Customer Address</span><div class="d-control">{{ si.customer_name }}-Billing</div></div>
              <div class="d-field">
                <span class="d-label">Address</span>
                <div class="d-control" style="padding: 6px 8px; font-weight: 420">{{ sim.customer(si.customer)?.address }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="si && tab === 'Payments'">
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Advance Payments</div></div>
        <div class="d-section-inner">
          <div class="d-full"><div class="d-grid"><div class="d-grid-empty">No Data</div></div></div>
        </div>
      </section>
    </template>

    <template v-else-if="si && tab === 'Terms'">
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
                  <tr><td class="no">1</td><td>{{ deskDate(si.due_date ?? '') }}</td><td class="num">100</td><td class="num">{{ deskMoney(grand) }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="si && tab === 'More Info'">
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Status</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Status</span><div class="d-control">{{ saved ? si.status : 'Draft' }}</div></div>
            </div>
          </div>
        </div>
      </section>
      <section v-for="s in ['Accounting Details', 'Commission', 'Sales Team', 'Print Settings']" :key="s" class="d-section">
        <div class="d-section-head collapsible">
          <div style="max-width: 900px; width: 100%; margin: 0 auto; display: flex; gap: 6px; align-items: center">
            {{ s }}<span class="lucide-chevron-right size-4" aria-hidden="true" />
          </div>
        </div>
      </section>
    </template>

    <Connections v-else-if="si && tab === 'Connections'" :groups="connections" />

    <template v-if="saved && si" #sidebar>
      <FormSidebar :title="si.name" :owner="sim.state.settings.store_keeper_name" created="just now" modified="just now" />
    </template>
  </DeskShell>
</template>
