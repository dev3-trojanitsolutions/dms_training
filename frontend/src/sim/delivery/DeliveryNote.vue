<script setup lang="ts">
import { computed } from 'vue'
import { useSim } from '../../engine/sim'
import DeliveryShell from './DeliveryShell.vue'
import { deliveryBadge } from './deliveryStatus'

/** Copy of dms/www/delivery-note: check quantities, add proof, submit. */
const sim = useSim()

const dn = computed(() => sim.deliveryNote(sim.state.ui.delivery_note))
const customer = computed(() => (dn.value ? sim.customer(dn.value.customer) : undefined))
const readonly = computed(() => dn.value?.docstatus === 1)
const qtyOf = (code: string) =>
  readonly.value ? (dn.value?.items.find((l) => l.item_code === code)?.qty ?? 0) : (sim.state.note.qty[code] ?? 0)

const totals = computed(() => {
  const items = dn.value?.items ?? []
  const ordered = items.reduce((s, l) => s + l.ordered_qty, 0)
  const delivered = items.reduce((s, l) => s + qtyOf(l.item_code), 0)
  const amount = items.reduce((s, l) => s + qtyOf(l.item_code) * l.rate, 0)
  return { ordered, delivered, remaining: Math.max(0, ordered - delivered), amount }
})

const so = computed(() => (dn.value ? sim.order(dn.value.sales_order) : undefined))
const invoice = computed(() => (dn.value ? sim.invoiceFor(dn.value.sales_order) : undefined))
const attachments = computed(() => (readonly.value ? (dn.value?.attachments ?? []) : sim.state.note.attachments))

function onQty(code: string, event: Event) {
  sim.setDeliveredQty(code, parseFloat((event.target as HTMLInputElement).value))
}
</script>

<template>
  <DeliveryShell active="pending">
    <!-- Success screen -->
    <div v-if="dn && sim.state.ui.delivery_success" class="success" data-tour="dnote.success">
      <div class="success-circle"><span class="lucide-circle-check size-10" aria-hidden="true" /></div>
      <h1 class="success-title">Delivery Completed</h1>
      <p class="dl-sub">{{ dn.name }} · {{ dn.customer_name }}</p>
      <div class="dl-panel notify">
        <span class="lucide-megaphone size-5" aria-hidden="true" />
        <div>
          <div style="font-weight: 700">Office Notified</div>
          <div class="dl-sub">Dispatch and Procurement have been informed of this completion.</div>
        </div>
      </div>
      <div v-if="invoice" class="dl-note" style="max-width: 460px; text-align: left">
        <span aria-hidden="true">🎓</span>
        <span v-if="invoice.docstatus === 1">
          Behind the scenes: everything on {{ dn.sales_order }} is now delivered, so Sales Invoice
          <b>{{ invoice.name }}</b> was filled in and <b>submitted</b> automatically ({{ invoice.status }},
          {{ sim.fmt(invoice.grand_total) }}). The Sales Order is <b>{{ so?.status }}</b>.
        </span>
        <span v-else>
          Behind the scenes: Sales Invoice <b>{{ invoice.name }}</b> now holds the delivered quantities
          ({{ sim.fmt(invoice.grand_total) }}) but stays a <b>draft</b>, because part of {{ dn.sales_order }}
          is still to deliver. The Sales Order is <b>{{ so?.status }}</b>.
        </span>
      </div>
      <button class="dl-btn" data-tour="dnote.back" @click="sim.navigate('delivery.completed')">Back to Deliveries</button>
    </div>

    <template v-else-if="dn">
      <div class="dl-row">
        <div>
          <div class="dl-dn-no">{{ dn.name }}</div>
          <h1 class="dl-section-title">{{ dn.customer_name }}</h1>
        </div>
        <span class="dl-badge" :class="deliveryBadge(dn).cls">{{ deliveryBadge(dn).label }}</span>
      </div>

      <div v-if="readonly" class="dl-panel banner">
        <span class="lucide-circle-check size-5" aria-hidden="true" />
        <div>
          <div style="font-weight: 700">Delivery complete</div>
          <div class="dl-sub">This delivery note has been submitted and is now read-only.</div>
        </div>
      </div>

      <div class="summary" data-tour="dnote.summary">
        <div class="dl-panel">
          <div class="dl-eyebrow" style="margin-bottom: 10px">Customer Information</div>
          <div class="info"><span class="lucide-user size-4" aria-hidden="true" /><div><small>Customer Name</small>{{ dn.customer_name }}</div></div>
          <div class="info"><span class="lucide-phone size-4" aria-hidden="true" /><div><small>Phone Number</small>{{ customer?.mobile ?? '—' }}</div></div>
          <div class="info"><span class="lucide-map-pin size-4" aria-hidden="true" /><div><small>Delivery Address</small>{{ customer?.address ?? '—' }}</div></div>
        </div>
        <div class="dl-panel">
          <div class="dl-eyebrow" style="margin-bottom: 10px">Delivery Summary</div>
          <div class="minis">
            <div class="mini"><b>{{ totals.ordered }}</b><small>Ordered</small></div>
            <div class="mini"><b>{{ totals.delivered }}</b><small>Delivered</small></div>
            <div class="mini"><b class="green">{{ totals.remaining }}</b><small>Remaining</small></div>
          </div>
        </div>
      </div>

      <div class="dl-panel" data-tour="dnote.items">
        <div class="dl-row" style="margin-bottom: 6px">
          <div class="dl-h2" style="font-size: 17px">Items</div>
          <span class="dl-sub">{{ dn.items.length }} item{{ dn.items.length === 1 ? '' : 's' }}</span>
        </div>
        <div v-for="line in dn.items" :key="line.item_code" class="item">
          <div class="item-ph">{{ line.item_name.slice(0, 2).toUpperCase() }}</div>
          <div class="item-body">
            <div class="item-name">
              {{ line.item_name }}
              <span v-if="!readonly && qtyOf(line.item_code) >= 0 && qtyOf(line.item_code) < line.ordered_qty" class="partial">
                Partial Delivery
              </span>
            </div>
            <div class="dl-sub" style="font-size: 12.5px">Ordered {{ line.ordered_qty }} {{ line.uom }}</div>
            <div v-if="qtyOf(line.item_code) > line.ordered_qty" class="item-error">
              Delivered quantity cannot exceed the ordered quantity.
            </div>
            <div v-else-if="qtyOf(line.item_code) < 0" class="item-error">Delivered quantity cannot be negative.</div>
          </div>
          <div class="item-right">
            <template v-if="readonly">
              <span class="dl-sub">Delivered</span> <b>{{ line.qty }} {{ line.uom }}</b>
            </template>
            <div v-else class="stepper" :class="{ invalid: qtyOf(line.item_code) > line.ordered_qty || qtyOf(line.item_code) < 0 }">
              <button
                :disabled="qtyOf(line.item_code) <= 0"
                :data-tour="`dnote.minus:${line.item_code}`"
                :aria-label="`One less ${line.item_name}`"
                @click="sim.stepDeliveredQty(line.item_code, -1)"
              >
                −
              </button>
              <input
                type="number"
                inputmode="numeric"
                min="0"
                :max="line.ordered_qty"
                :value="qtyOf(line.item_code)"
                :data-tour="`dnote.qty:${line.item_code}`"
                :aria-label="`Delivered quantity of ${line.item_name}`"
                @input="onQty(line.item_code, $event)"
              />
              <button
                :disabled="qtyOf(line.item_code) >= line.ordered_qty"
                :data-tour="`dnote.plus:${line.item_code}`"
                :aria-label="`One more ${line.item_name}`"
                @click="sim.stepDeliveredQty(line.item_code, 1)"
              >
                +
              </button>
            </div>
            <div class="col"><small>Rate</small>{{ line.rate.toFixed(2) }}</div>
            <div class="col"><small>Amount</small>{{ (qtyOf(line.item_code) * line.rate).toFixed(2) }}</div>
          </div>
        </div>
        <div class="items-total"><span>Total</span><span>{{ totals.amount.toFixed(2) }}</span></div>
      </div>

      <div class="proof-row">
        <div v-if="!readonly" class="dl-panel" data-tour="dnote.proof">
          <div class="dl-row" style="margin-bottom: 12px">
            <div class="dl-h2" style="font-size: 17px">Proof of Delivery</div>
            <span class="required" :class="{ done: attachments.length }">{{ attachments.length ? 'Added' : 'Required' }}</span>
          </div>
          <button class="upload camera" data-tour="dnote.camera" @click="sim.addProof('camera')">
            <span class="lucide-camera size-6" aria-hidden="true" />Camera
          </button>
          <div class="upload-row">
            <button class="upload" data-tour="dnote.photo" @click="sim.addProof('photo')">
              <span class="lucide-image size-5" aria-hidden="true" />Photo / Gallery
            </button>
            <button class="upload" data-tour="dnote.pdf" @click="sim.addProof('pdf')">
              <span class="lucide-file-text size-5" aria-hidden="true" />PDF
            </button>
          </div>
          <p v-if="!attachments.length" class="dl-sub" style="font-size: 12.5px; margin-top: 10px">
            Upload at least one attachment to submit this delivery.
          </p>
          <div class="dl-note" style="margin-top: 10px">
            <span aria-hidden="true">🎓</span><span>In training, each button adds a sample file instead of opening the camera.</span>
          </div>
          <div class="attachments" data-tour="dnote.attachments">
            <div v-for="(file, i) in attachments" :key="file" class="attachment">
              <span :class="file.endsWith('.pdf') ? 'lucide-file-text' : 'lucide-image'" class="size-6" aria-hidden="true" />
              <span class="att-name">{{ file }}</span>
              <button class="att-remove" :data-tour="`dnote.remove:${i}`" aria-label="Remove attachment" @click="sim.removeProof(i)">×</button>
            </div>
          </div>
        </div>
        <div class="dl-panel">
          <div class="dl-h2" style="font-size: 17px; margin-bottom: 10px">Delivery Remarks</div>
          <textarea
            v-model="sim.state.note.remarks"
            class="remarks"
            :readonly="readonly"
            placeholder="Add any remarks about this delivery…"
            data-tour="dnote.remarks"
          />
        </div>
      </div>

      <div v-if="!readonly" class="actions">
        <button class="dl-btn ghost" data-tour="dnote.save" @click="sim.saveDeliveryDraft()">Save</button>
        <button class="dl-btn" :disabled="sim.noteHasInvalidQty()" data-tour="dnote.submit" @click="sim.submitDelivery()">
          <span class="lucide-circle-check size-5" aria-hidden="true" />Submit Delivery
        </button>
      </div>
    </template>

    <div v-else class="dl-empty">No delivery note specified.</div>
  </DeliveryShell>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 14px;
}
.info {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 0;
  border-top: 1px solid var(--dl-border);
}
.info:first-of-type {
  border-top: none;
}
.info > span {
  margin-top: 3px;
  color: #3a5e72;
}
.info small,
.mini small,
.col small {
  display: block;
  font-size: 11.5px;
  color: var(--dl-text-3);
}
.minis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  text-align: center;
}
.mini {
  background: var(--dl-bg);
  border-radius: 12px;
  padding: 14px 6px;
}
.mini b {
  font-size: 22px;
}
.mini b.green {
  color: #356048;
}
.item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 0;
  border-top: 1px solid var(--dl-border);
  flex-wrap: wrap;
}
.item-ph {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #f0ebe1;
  color: #8a8275;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.item-body {
  flex: 1;
  min-width: 180px;
}
.item-name {
  font-weight: 600;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.partial {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f6ead2;
  color: #9a6b12;
}
.item-error {
  margin-top: 4px;
  font-size: 12px;
  color: #9a4a35;
}
.item-right {
  display: flex;
  align-items: center;
  gap: 18px;
}
.col {
  min-width: 64px;
  text-align: right;
  font-weight: 600;
}
.stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--dl-border);
  border-radius: 999px;
  overflow: hidden;
  background: #fff;
}
.stepper.invalid {
  border-color: #9a4a35;
}
.stepper button {
  width: 34px;
  height: 34px;
  border: none;
  background: #f6f3ed;
  font-size: 18px;
  cursor: pointer;
}
.stepper button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.stepper input {
  width: 68px;
  height: 34px;
  border: none;
  text-align: center;
  font-weight: 600;
  outline: none;
}
.items-total {
  display: flex;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--dl-border);
  font-weight: 700;
}
.proof-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.required {
  font-size: 12px;
  font-weight: 700;
  color: #9a4a35;
}
.required.done {
  color: #356048;
}
.upload {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: 1.5px dashed #d8cfbf;
  border-radius: 12px;
  background: var(--dl-bg);
  font-weight: 600;
  color: var(--dl-text-2);
  cursor: pointer;
}
.upload.camera {
  padding: 18px;
  margin-bottom: 10px;
}
.upload-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.attachments {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.attachment {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 6px;
  border: 1px solid var(--dl-border);
  border-radius: 10px;
  color: #3a5e72;
}
.att-name {
  font-size: 11px;
  color: var(--dl-text-2);
  word-break: break-all;
  text-align: center;
}
.att-remove {
  position: absolute;
  top: 2px;
  right: 4px;
  border: none;
  background: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--dl-text-3);
}
.remarks {
  width: 100%;
  min-height: 140px;
  padding: 12px;
  border: 1px solid var(--dl-border);
  border-radius: 12px;
  resize: vertical;
  outline: none;
}
.actions {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 12px;
}
.banner,
.notify {
  display: flex;
  gap: 12px;
  align-items: center;
  color: #356048;
}
.success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 40px 0;
  text-align: center;
}
.success-circle {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: #e2ede5;
  color: #356048;
  display: flex;
  align-items: center;
  justify-content: center;
}
.success-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 34px;
  font-weight: 600;
}
@container (max-width: 760px) {
  .summary,
  .proof-row {
    grid-template-columns: 1fr;
  }
}
</style>
