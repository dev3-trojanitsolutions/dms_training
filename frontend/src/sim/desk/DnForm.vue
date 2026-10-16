<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSim } from '../../engine/sim'
import Connections from './Connections.vue'
import DeskShell from './DeskShell.vue'
import FormSidebar from './FormSidebar.vue'
import { deskDate, deskMoney, inWords } from './format'

/**
 * A Delivery Note in Desk, laid out like erpnext/stock/doctype/delivery_note:
 * new from Create ▾ Delivery Note (Not Saved), or a saved Draft with the
 * form sidebar and Assign To.
 */
const sim = useSim()
const tab = ref('Details')
const dirty = ref(false)
const showCurrency = ref(false)
const assignee = ref('')
const assignToMe = ref(false)
const priority = ref('Medium')
const comment = ref('')

const dn = computed(() => sim.state.desk_dn)
const saved = computed(() => !!dn.value?.name)
const editable = computed(() => dn.value?.docstatus === 0)
const status = computed(() => {
  if (!dn.value) return ''
  if (!saved.value) return 'Not Saved'
  return dirty.value ? 'Not Saved' : dn.value.status
})
const totalQty = computed(() => dn.value?.items.reduce((s, l) => s + l.qty, 0) ?? 0)
const total = computed(() => dn.value?.items.reduce((s, l) => s + l.qty * l.rate, 0) ?? 0)
const so = computed(() => (dn.value ? sim.order(dn.value.sales_order) : undefined))
const invoice = computed(() => (dn.value ? sim.invoiceFor(dn.value.sales_order) : undefined))
const tabs = computed(() =>
  saved.value
    ? ['Details', 'Address & Contact', 'Terms', 'More Info', 'Connections']
    : ['Details', 'Address & Contact', 'Terms', 'More Info'],
)
const postingTime = new Date().toTimeString().slice(0, 8)
const menu = computed(() => sim.state.ui.desk_menu)

watch(
  () => dn.value?.name,
  () => (dirty.value = false),
)

const connections = computed(() => [
  {
    label: 'Related',
    items: [
      { doctype: 'Sales Invoice', docs: [] },
      { doctype: 'Packing Slip', docs: [] },
      { doctype: 'Delivery Trip', docs: [] },
    ],
  },
  {
    label: 'Reference',
    items: [
      {
        doctype: 'Sales Order',
        docs: so.value
          ? [{ name: so.value.name, status: so.value.status, open: () => sim.openDeskOrder(so.value!.name) }]
          : [],
      },
      { doctype: 'Shipment', docs: [] },
      { doctype: 'Quality Inspection', docs: [] },
    ],
  },
  { label: 'Returns', items: [{ doctype: 'Stock Entry', docs: [] }] },
])

function onQty(code: string, event: Event) {
  sim.setDeskDnQty(code, Number((event.target as HTMLInputElement).value))
  dirty.value = true
}

function onWarehouse(event: Event) {
  if (!dn.value) return
  dn.value.warehouse = (event.target as HTMLSelectElement).value
  dirty.value = true
}

async function save() {
  await sim.saveDeskDeliveryNote()
  if (saved.value) dirty.value = false
}

function onSubmitClick() {
  void sim.alert(
    'info',
    'In this business the delivery partner submits the Delivery Note from the delivery portal, after uploading proof of delivery. Leave it as a draft.',
    'desk',
  )
}

function notInTraining() {
  sim.state.ui.desk_menu = ''
  void sim.alert('info', 'This action is not part of this training scenario.', 'desk')
}

function openAssign() {
  assignee.value = ''
  assignToMe.value = false
  priority.value = 'Medium'
  comment.value = ''
  sim.state.ui.assign_open = true
}
</script>

<template>
  <DeskShell
    v-model:tab="tab"
    workspace="stock"
    doctype="Delivery Note"
    list-screen="desk.dn_list"
    :title="dn?.name || 'New Delivery Note'"
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
        <button class="d-btn" @click="sim.toggleDeskMenu('get_items')">
          Get Items From <span class="lucide-chevrons-up-down size-4" aria-hidden="true" />
        </button>
        <button v-if="saved && !dirty" class="d-btn" @click="sim.toggleDeskMenu('dn_create')">
          Create <span class="lucide-chevrons-up-down size-4" aria-hidden="true" />
        </button>
        <button v-if="saved && !dirty" class="d-btn primary" data-tour="desk.dn.submit" @click="onSubmitClick">Submit</button>
        <button v-else class="d-btn primary" data-tour="desk.save" @click="save">Save</button>
      </template>
      <div v-if="menu === 'get_items'" class="d-menu" role="menu">
        <button class="d-menu-item" @click="notInTraining">Sales Order</button>
        <button class="d-menu-item" @click="notInTraining">Pick List</button>
      </div>
      <div v-if="menu === 'dn_create'" class="d-menu" role="menu">
        <button class="d-menu-item" @click="notInTraining">Packing Slip</button>
      </div>
    </template>

    <template v-if="dn && tab === 'Details'">
      <section class="d-section">
        <div class="d-section-inner">
          <div class="d-columns">
            <div class="d-column">
              <div v-if="!saved" class="d-field">
                <span class="d-label">Series<span class="reqd">*</span></span>
                <select class="d-control" aria-label="Series"><option>MAT-DN-.YYYY.-</option></select>
              </div>
              <div class="d-field">
                <span class="d-label">Customer<span class="reqd">*</span></span>
                <div class="d-control">{{ dn.customer_name }}</div>
              </div>
            </div>
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Date<span class="reqd">*</span></span>
                <div class="d-control" style="color: #7c7c7c">{{ deskDate(dn.posting_date) }}</div>
              </div>
              <div class="d-field">
                <span class="d-label">Posting Time<span class="reqd">*</span></span>
                <div class="d-control" style="color: #7c7c7c">{{ postingTime }}</div>
              </div>
              <label v-if="editable" class="d-check"><input type="checkbox" />Edit Posting Date and Time</label>
            </div>
            <div class="d-column">
              <label class="d-check"><input type="checkbox" :disabled="saved" />Is Return</label>
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
            </div>
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Set Source Warehouse</span>
                <select
                  v-if="editable"
                  class="d-control"
                  :value="dn.warehouse"
                  data-tour="desk.dn.warehouse"
                  @change="onWarehouse"
                >
                  <option v-for="wh in sim.state.warehouses" :key="wh" :value="wh">{{ wh }}</option>
                </select>
                <div v-else class="d-control">{{ dn.warehouse }}</div>
              </div>
            </div>
          </div>
          <div class="d-full">
            <div class="d-grid-label">Delivery Note Item</div>
            <div class="d-grid" data-tour="desk.dn.items">
              <table>
                <thead>
                  <tr>
                    <th class="chk"><input type="checkbox" aria-label="Select all" /></th>
                    <th class="no">No.</th>
                    <th>Item Code<span class="reqd">*</span></th>
                    <th class="num">Quantity<span class="reqd">*</span></th>
                    <th>UOM<span class="reqd">*</span></th>
                    <th class="num">Rate (QAR)</th>
                    <th class="num">Amount (QAR)</th>
                    <th>Warehouse</th>
                    <th class="edit"><span class="lucide-settings size-4" aria-hidden="true" /></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(line, i) in dn.items" :key="line.item_code">
                    <td class="chk"><input type="checkbox" :aria-label="`Select row ${i + 1}`" /></td>
                    <td class="no">{{ i + 1 }}</td>
                    <td>{{ line.item_code }}: {{ line.item_name }}</td>
                    <td v-if="editable" class="cell-input">
                      <input
                        type="number"
                        min="0"
                        :value="line.qty"
                        :data-tour="`desk.dn.qty:${line.item_code}`"
                        :aria-label="`Quantity of ${line.item_name}`"
                        @input="onQty(line.item_code, $event)"
                      />
                    </td>
                    <td v-else class="num">{{ line.qty }}</td>
                    <td>{{ line.uom }}</td>
                    <td class="num">{{ deskMoney(line.rate) }}</td>
                    <td class="num">{{ deskMoney(line.qty * line.rate) }}</td>
                    <td>{{ dn.warehouse }}</td>
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
              <div class="d-field"><span class="d-label">Grand Total (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ deskMoney(total) }}</div></div>
              <div class="d-field"><span class="d-label">In Words (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ inWords(total) }}</div></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">Rounded Total (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ deskMoney(Math.round(total)) }}</div></div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="dn && tab === 'Address & Contact'">
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Billing Address</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Billing Address Name</span><div class="d-control">{{ dn.customer_name }}-Billing</div></div>
              <div class="d-field">
                <span class="d-label">Billing Address</span>
                <div class="d-control" style="padding: 6px 8px; font-weight: 420">{{ sim.customer(dn.customer)?.address }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Shipping Address</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Shipping Address</span><div class="d-control">{{ dn.customer_name }}-Billing</div></div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="dn && tab === 'Terms'">
      <section class="d-section">
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Terms</span><div class="d-control empty" /></div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="dn && tab === 'More Info'">
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Status</div></div>
        <div class="d-section-inner">
          <div class="d-columns">
            <div class="d-column">
              <div class="d-field"><span class="d-label">% Amount Billed</span><div class="d-control">{{ invoice?.docstatus === 1 ? '100.00' : '0.00' }}</div></div>
              <div class="d-field"><span class="d-label">Status</span><div class="d-control">{{ saved ? dn.status : 'Draft' }}</div></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">% Installed</span><div class="d-control">0.00</div></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">% Returned</span><div class="d-control">0.00</div></div>
            </div>
          </div>
        </div>
      </section>
      <section v-for="s in ['Transporter Info', 'Customer PO Details', 'Commission', 'Sales Team', 'Print Settings']" :key="s" class="d-section">
        <div class="d-section-head collapsible">
          <div style="max-width: 900px; width: 100%; margin: 0 auto; display: flex; gap: 6px; align-items: center">
            {{ s }}<span class="lucide-chevron-right size-4" aria-hidden="true" />
          </div>
        </div>
      </section>
    </template>

    <Connections v-else-if="dn && tab === 'Connections'" :groups="connections" />

    <template v-if="saved && dn" #sidebar>
      <FormSidebar
        :title="dn.name"
        :assignees="dn.assigned_to ? [sim.partnerName(dn.assigned_to)] : []"
        :attachments="dn.attachments"
        :can-assign="editable"
        :owner="sim.state.settings.store_keeper_name"
        created="just now"
        modified="just now"
        @assign="openAssign"
      />
    </template>

    <template #overlay>
      <div v-if="sim.state.ui.assign_open" class="d-modal-overlay">
        <div class="d-modal" role="dialog" aria-modal="true" aria-label="Add to ToDo">
          <div class="d-modal-head">
            Add to ToDo
            <button class="d-fs-add" aria-label="Close" @click="sim.state.ui.assign_open = false">
              <span class="lucide-x size-4" aria-hidden="true" />
            </button>
          </div>
          <div class="d-modal-body">
            <div class="d-field">
              <span class="d-label">Assign To</span>
              <select v-model="assignee" class="d-control" data-tour="desk.assign.user">
                <option value="">Select users…</option>
                <option v-for="p in sim.state.delivery_partners" :key="p.user" :value="p.user">
                  {{ p.full_name }}: {{ p.user }}
                </option>
              </select>
            </div>
            <label class="d-check"><input v-model="assignToMe" type="checkbox" />Assign to me</label>
            <div class="d-columns two" style="margin: 0 -15px">
              <div class="d-column">
                <div class="d-field"><span class="d-label">Complete By</span><input class="d-control" type="date" /></div>
              </div>
              <div class="d-column">
                <div class="d-field">
                  <span class="d-label">Priority</span>
                  <select v-model="priority" class="d-control"><option>Low</option><option>Medium</option><option>High</option></select>
                </div>
              </div>
            </div>
            <div class="d-field">
              <span class="d-label">Comment</span>
              <textarea v-model="comment" class="d-control" />
            </div>
            <div class="d-note">
              🎓 Assigning puts the note in that driver's Pending Deliveries. You can also leave it unassigned: drivers
              pick up notes themselves under Delivery Assign.
            </div>
          </div>
          <div class="d-modal-foot">
            <button class="d-btn primary" data-tour="desk.assign.add" :disabled="!assignee" @click="sim.assignDeliveryNote(assignee)">
              Add
            </button>
          </div>
        </div>
      </div>
    </template>
  </DeskShell>
</template>
