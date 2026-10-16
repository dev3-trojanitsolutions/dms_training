<script setup lang="ts">
import { computed } from 'vue'
import { useSim } from '../../engine/sim'
import DeskShell from './DeskShell.vue'
import { deskDate, deskMoney } from './format'
import { statusColor } from './indicator'

/** Sales Invoice list view: the in_list_view columns of sales_invoice.json. */
const sim = useSim()
// The manager works from Accounting; the store keeper from Selling.
const workspace = computed(() => (sim.state.settings.desk_user_name ? 'accounting' : 'selling'))
const rows = computed(() => [...sim.state.sales_invoices].sort((a, b) => b.name.localeCompare(a.name)))
</script>

<template>
  <DeskShell :workspace="workspace" doctype="Sales Invoice" list-screen="desk.si_list">
    <template #actions>
      <button class="d-btn"><span class="lucide-list size-4" aria-hidden="true" />List View <span class="lucide-chevrons-up-down size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Refresh"><span class="lucide-refresh-cw size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Menu"><span class="lucide-ellipsis size-4" aria-hidden="true" /></button>
      <button class="d-btn primary"><span class="lucide-plus size-4" aria-hidden="true" />Add Sales Invoice</button>
    </template>

    <div class="d-filters">
      <input class="d-control" placeholder="ID" aria-label="ID" />
      <input class="d-control" placeholder="Customer" aria-label="Customer" />
      <input class="d-control" placeholder="Company" aria-label="Company" />
      <input class="d-control" placeholder="Posting Date" aria-label="Posting Date" />
      <select class="d-control" aria-label="Status"><option>Status</option></select>
      <span class="spacer" />
      <button class="d-btn"><span class="lucide-filter size-4" aria-hidden="true" />Filter</button>
      <button class="d-btn"><span class="lucide-arrow-down-wide-narrow size-4" aria-hidden="true" />Created On</button>
    </div>

    <div class="d-list" data-tour="desk.si_list.table">
      <div class="d-list-row head">
        <input type="checkbox" aria-label="Select all" />
        <span>Title</span>
        <span>Status</span>
        <span>Posting Date</span>
        <span>Payment Due Date</span>
        <span class="wide-only">Grand Total</span>
        <span class="wide-only" />
        <span style="text-align: right">{{ rows.length }} of {{ rows.length }}</span>
      </div>
      <div
        v-for="si in rows"
        :key="si.name"
        class="d-list-row body"
        :data-tour="`desk.si_row:${si.name}`"
        @click="sim.openDeskSalesInvoice(si.name)"
      >
        <input type="checkbox" :aria-label="`Select ${si.name}`" @click.stop />
        <span class="d-list-title">{{ si.customer_name ?? sim.customer(si.customer)?.customer_name }}</span>
        <span><span class="d-pill" :class="statusColor(si.status)" style="margin: 0">{{ si.status }}</span></span>
        <span>{{ deskDate(si.posting_date ?? '') }}</span>
        <span>{{ deskDate(si.due_date ?? '') }}</span>
        <span class="wide-only">{{ deskMoney(si.grand_total) }}</span>
        <span class="wide-only" />
        <span class="d-list-id">{{ si.name }}</span>
      </div>
      <div v-if="!rows.length" class="d-grid-empty">No Sales Invoice found</div>
    </div>
  </DeskShell>
</template>
