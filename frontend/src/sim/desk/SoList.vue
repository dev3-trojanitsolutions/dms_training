<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSim } from '../../engine/sim'
import type { SalesOrder } from '../../engine/types'
import DeskShell from './DeskShell.vue'
import { deskDate, deskMoney } from './format'
import { statusColor } from './indicator'

/** Sales Order list view: the in_list_view columns of sales_order.json, with the standard filters. */
const sim = useSim()
const search = ref('')

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sim.state.sales_orders
    .filter((so) => so.docstatus === 1)
    .filter((so) => !q || so.name.toLowerCase().includes(q) || so.customer_name.toLowerCase().includes(q))
    .sort((a, b) => b.name.localeCompare(a.name))
})

function perDelivered(so: SalesOrder) {
  const qty = so.items.reduce((s, l) => s + l.qty, 0)
  return qty ? (so.items.reduce((s, l) => s + Math.min(l.delivered_qty, l.qty), 0) / qty) * 100 : 0
}
const perBilled = (so: SalesOrder) => (sim.invoiceFor(so.name)?.docstatus === 1 ? 100 : 0)
</script>

<template>
  <DeskShell workspace="selling" doctype="Sales Order" list-screen="desk.so_list">
    <template #actions>
      <button class="d-btn"><span class="lucide-list size-4" aria-hidden="true" />List View <span class="lucide-chevrons-up-down size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Refresh"><span class="lucide-refresh-cw size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Menu"><span class="lucide-ellipsis size-4" aria-hidden="true" /></button>
      <button class="d-btn primary"><span class="lucide-plus size-4" aria-hidden="true" />Add Sales Order</button>
    </template>

    <div class="d-filters">
      <input class="d-control" placeholder="ID" aria-label="ID" />
      <input class="d-control" placeholder="Company" aria-label="Company" />
      <input class="d-control" placeholder="Customer" aria-label="Customer" />
      <input v-model="search" class="d-control" placeholder="Customer Name" aria-label="Customer Name" data-tour="desk.so_list.search" />
      <input class="d-control" placeholder="Date" aria-label="Date" />
      <span class="spacer" />
      <button class="d-btn"><span class="lucide-filter size-4" aria-hidden="true" />Filter</button>
      <button class="d-btn"><span class="lucide-arrow-down-wide-narrow size-4" aria-hidden="true" />Created On</button>
    </div>
    <div class="d-filters" style="padding-top: 0">
      <select class="d-control" aria-label="Delivery Status"><option>Delivery Status</option></select>
      <select class="d-control" aria-label="Billing Status"><option>Billing Status</option></select>
      <select class="d-control" aria-label="Advance Payment Status"><option>Advance Paym…</option></select>
    </div>

    <div class="d-list" data-tour="desk.so_list.table">
      <div class="d-list-row head">
        <input type="checkbox" aria-label="Select all" />
        <span>Title</span>
        <span>Status</span>
        <span>Delivery Date</span>
        <span>Grand Total</span>
        <span class="wide-only">% Delivered</span>
        <span class="wide-only">% Amount Billed</span>
        <span style="text-align: right">{{ rows.length }} of {{ rows.length }}</span>
      </div>
      <div
        v-for="so in rows"
        :key="so.name"
        class="d-list-row body"
        :data-tour="`desk.so_row:${so.name}`"
        @click="sim.openDeskOrder(so.name)"
      >
        <input type="checkbox" :aria-label="`Select ${so.name}`" @click.stop />
        <span class="d-list-title">{{ so.customer_name }}</span>
        <span><span class="d-pill" :class="statusColor(so.status)" style="margin: 0">{{ so.status }}</span></span>
        <span>{{ deskDate(so.delivery_date) }}</span>
        <span>{{ deskMoney(so.grand_total) }}</span>
        <span class="wide-only"><div class="d-progress"><div :style="{ width: `${perDelivered(so)}%` }" /></div></span>
        <span class="wide-only"><div class="d-progress"><div :style="{ width: `${perBilled(so)}%` }" /></div></span>
        <span class="d-list-id">{{ so.name }}</span>
      </div>
      <div v-if="!rows.length" class="d-grid-empty">No Sales Order found</div>
      <div class="d-list-foot">
        <span>20 · 100 · 500</span>
        <span>{{ rows.length }} of {{ rows.length }}</span>
      </div>
    </div>
  </DeskShell>
</template>
