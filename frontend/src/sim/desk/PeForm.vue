<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MODES_OF_PAYMENT, useSim } from '../../engine/sim'
import DeskShell from './DeskShell.vue'
import FormSidebar from './FormSidebar.vue'
import { deskDate, deskMoney, inWords } from './format'

/**
 * A Payment Entry in Desk, laid out like erpnext/accounts/doctype/payment_entry:
 * new from the Sales Invoice's Create ▾ Payment (Not Saved), a saved Draft, or Submitted.
 */
const sim = useSim()
const dirty = ref(false)

const pe = computed(() => sim.state.desk_pe)
const saved = computed(() => !!pe.value?.name)
const editable = computed(() => pe.value?.docstatus === 0)
const invoice = computed(() => (pe.value ? sim.salesInvoice(pe.value.reference_name) : undefined))
const status = computed(() => {
  if (!pe.value) return ''
  if (!saved.value || dirty.value) return 'Not Saved'
  return pe.value.status
})
/** Before submit, the reference row shows the invoice's outstanding; after, what it was when paid. */
const refOutstanding = computed(() => {
  if (!pe.value || !invoice.value) return 0
  const now = invoice.value.outstanding_amount ?? invoice.value.grand_total
  return pe.value.docstatus === 1 ? now + pe.value.allocated_amount : now
})
const unallocated = computed(() => (pe.value ? pe.value.paid_amount - pe.value.allocated_amount : 0))
const owner = computed(() => sim.state.settings.desk_user_name || sim.state.settings.store_keeper_name)

watch(
  () => pe.value?.name,
  () => (dirty.value = false),
)

function onField(field: 'mode_of_payment' | 'paid_amount' | 'reference_no' | 'reference_date', event: Event) {
  sim.setPeField(field, (event.target as HTMLInputElement).value)
  dirty.value = true
}

async function save() {
  await sim.saveDeskPaymentEntry()
  if (saved.value) dirty.value = false
}

function notInTraining() {
  sim.state.ui.desk_menu = ''
  void sim.alert('info', 'This action is not part of this training scenario.', 'desk')
}
</script>

<template>
  <DeskShell
    workspace="accounting"
    doctype="Payment Entry"
    list-screen="desk.pe_list"
    :title="pe?.name || 'New Payment Entry'"
    :status="status"
  >
    <template #actions>
      <template v-if="saved">
        <button class="d-btn icon" aria-label="Previous document"><span class="lucide-chevron-left size-4" aria-hidden="true" /></button>
        <button class="d-btn icon" aria-label="Next document"><span class="lucide-chevron-right size-4" aria-hidden="true" /></button>
        <button class="d-btn icon" aria-label="Menu"><span class="lucide-ellipsis size-4" aria-hidden="true" /></button>
      </template>
      <template v-if="editable">
        <button v-if="saved && !dirty" class="d-btn primary" data-tour="desk.pe.submit" @click="sim.submitDeskPaymentEntry()">Submit</button>
        <button v-else class="d-btn primary" data-tour="desk.pe.save" @click="save">Save</button>
      </template>
      <button v-else class="d-btn" @click="notInTraining">
        View <span class="lucide-chevrons-up-down size-4" aria-hidden="true" />
      </button>
    </template>

    <template v-if="pe">
      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Type of Payment</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div v-if="!saved" class="d-field">
                <span class="d-label">Series<span class="reqd">*</span></span>
                <select class="d-control" aria-label="Series"><option>ACC-PAY-.YYYY.-</option></select>
              </div>
              <div class="d-field">
                <span class="d-label">Payment Type<span class="reqd">*</span></span>
                <div class="d-control">{{ pe.payment_type }}</div>
              </div>
            </div>
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Posting Date<span class="reqd">*</span></span>
                <div class="d-control">{{ deskDate(pe.posting_date) }}</div>
              </div>
              <div class="d-field">
                <span class="d-label">Company<span class="reqd">*</span></span>
                <div class="d-control">{{ sim.state.settings.company }}</div>
              </div>
              <div class="d-field" data-tour="desk.pe.mode_field">
                <span class="d-label">Mode of Payment</span>
                <select
                  v-if="editable"
                  class="d-control"
                  :value="pe.mode_of_payment"
                  data-tour="desk.pe.mode"
                  aria-label="Mode of Payment"
                  @change="onField('mode_of_payment', $event)"
                >
                  <option value="" />
                  <option v-for="(_account, mode) in MODES_OF_PAYMENT" :key="mode" :value="mode">{{ mode }}</option>
                </select>
                <div v-else class="d-control">{{ pe.mode_of_payment }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section" data-tour="desk.pe.party">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Payment From / To</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Party Type</span><div class="d-control">Customer</div></div>
              <div class="d-field"><span class="d-label">Party</span><div class="d-control">{{ pe.party }}</div></div>
              <div class="d-field"><span class="d-label">Party Name</span><div class="d-control">{{ pe.party_name }}</div></div>
            </div>
            <div class="d-column">
              <div class="d-field"><span class="d-label">Contact</span><div class="d-control empty" /></div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section" data-tour="desk.pe.accounts">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Accounts</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Account Paid From<span class="reqd">*</span></span><div class="d-control">{{ pe.paid_from }}</div></div>
              <div class="d-field"><span class="d-label">Account Currency (From)<span class="reqd">*</span></span><div class="d-control">QAR</div></div>
            </div>
            <div class="d-column">
              <div class="d-field" data-tour="desk.pe.paid_to">
                <span class="d-label">Account Paid To<span class="reqd">*</span></span><div class="d-control">{{ pe.paid_to }}</div>
              </div>
              <div class="d-field"><span class="d-label">Account Currency (To)<span class="reqd">*</span></span><div class="d-control">QAR</div></div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Amount</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Paid Amount (QAR)<span class="reqd">*</span></span>
                <input
                  v-if="editable"
                  class="d-control"
                  type="number"
                  min="0"
                  step="0.01"
                  :value="pe.paid_amount"
                  data-tour="desk.pe.paid_amount"
                  aria-label="Paid Amount"
                  @input="onField('paid_amount', $event)"
                />
                <div v-else class="d-control">{{ deskMoney(pe.paid_amount) }}</div>
              </div>
            </div>
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Received Amount (QAR)<span class="reqd">*</span></span>
                <div class="d-control" style="color: #7c7c7c">{{ deskMoney(pe.paid_amount) }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Reference</div></div>
        <div class="d-section-inner">
          <div class="d-full">
            <div class="d-grid-label">Payment References</div>
            <div class="d-grid" data-tour="desk.pe.references">
              <table>
                <thead>
                  <tr>
                    <th class="no">No.</th>
                    <th>Type<span class="reqd">*</span></th>
                    <th>Name<span class="reqd">*</span></th>
                    <th class="num">Grand Total (QAR)</th>
                    <th class="num">Outstanding (QAR)</th>
                    <th class="num">Allocated (QAR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="invoice">
                    <td class="no">1</td>
                    <td>Sales Invoice</td>
                    <td>{{ invoice.name }}</td>
                    <td class="num">{{ deskMoney(invoice.grand_total) }}</td>
                    <td class="num">{{ deskMoney(refOutstanding) }}</td>
                    <td class="num">{{ deskMoney(pe.allocated_amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Writeoff</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field"><span class="d-label">Total Allocated Amount (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ deskMoney(pe.allocated_amount) }}</div></div>
            </div>
            <div class="d-column">
              <div class="d-field" data-tour="desk.pe.unallocated">
                <span class="d-label">Unallocated Amount (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ deskMoney(unallocated) }}</div>
              </div>
              <div class="d-field"><span class="d-label">Difference Amount (Company Currency)</span><div class="d-control" style="color: #7c7c7c">{{ deskMoney(0) }}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section" data-tour="desk.pe.transaction">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">Transaction ID</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Cheque/Reference No</span>
                <input
                  v-if="editable"
                  class="d-control"
                  type="text"
                  :value="pe.reference_no"
                  data-tour="desk.pe.reference_no"
                  aria-label="Cheque/Reference No"
                  autocomplete="off"
                  @input="onField('reference_no', $event)"
                />
                <div v-else class="d-control">{{ pe.reference_no }}</div>
              </div>
            </div>
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">Cheque/Reference Date</span>
                <input
                  v-if="editable"
                  class="d-control"
                  type="date"
                  :value="pe.reference_date"
                  data-tour="desk.pe.reference_date"
                  aria-label="Cheque/Reference Date"
                  @input="onField('reference_date', $event)"
                />
                <div v-else class="d-control">{{ deskDate(pe.reference_date) }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="d-section">
        <div class="d-section-head"><div style="max-width: 900px; margin: 0 auto">More Information</div></div>
        <div class="d-section-inner">
          <div class="d-columns two">
            <div class="d-column">
              <div class="d-field">
                <span class="d-label">In Words (QAR)</span><div class="d-control" style="color: #7c7c7c">{{ inWords(pe.paid_amount) }}</div>
              </div>
            </div>
            <div class="d-column" />
          </div>
        </div>
      </section>
    </template>

    <template v-if="saved && pe" #sidebar>
      <FormSidebar :title="pe.name" :owner="owner" created="just now" modified="just now" />
    </template>
  </DeskShell>
</template>
