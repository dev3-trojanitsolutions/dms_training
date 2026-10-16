<script setup lang="ts">
import { computed } from 'vue'
import { useSim } from '../../engine/sim'
import DeskShell from './DeskShell.vue'
import { deskDate, deskMoney } from './format'
import { statusColor } from './indicator'

/** Delivery Note list view: the in_list_view columns of delivery_note.json. */
const sim = useSim()
const rows = computed(() => [...sim.state.delivery_notes].sort((a, b) => b.name.localeCompare(a.name)))
const total = (items: { qty: number; rate: number }[]) => items.reduce((s, l) => s + l.qty * l.rate, 0)
</script>

<template>
  <DeskShell workspace="stock" doctype="Delivery Note" list-screen="desk.dn_list">
    <template #actions>
      <button class="d-btn"><span class="lucide-list size-4" aria-hidden="true" />List View <span class="lucide-chevrons-up-down size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Refresh"><span class="lucide-refresh-cw size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Menu"><span class="lucide-ellipsis size-4" aria-hidden="true" /></button>
      <button class="d-btn primary"><span class="lucide-plus size-4" aria-hidden="true" />Add Delivery Note</button>
    </template>

    <div class="d-filters">
      <input class="d-control" placeholder="ID" aria-label="ID" />
      <input class="d-control" placeholder="Customer" aria-label="Customer" />
      <input class="d-control" placeholder="Company" aria-label="Company" />
      <select class="d-control" aria-label="Status"><option>Status</option></select>
      <input class="d-control" placeholder="Set Target Warehouse" aria-label="Set Target Warehouse" />
      <span class="spacer" />
      <button class="d-btn"><span class="lucide-filter size-4" aria-hidden="true" />Filter</button>
      <button class="d-btn"><span class="lucide-arrow-down-wide-narrow size-4" aria-hidden="true" />Created On</button>
    </div>

    <div class="d-list" data-tour="desk.dn_list.table">
      <div class="d-list-row head">
        <input type="checkbox" aria-label="Select all" />
        <span>Title</span>
        <span>Status</span>
        <span>Date</span>
        <span>Grand Total</span>
        <span class="wide-only">% Amount Billed</span>
        <span class="wide-only">Assigned To</span>
        <span style="text-align: right">{{ rows.length }} of {{ rows.length }}</span>
      </div>
      <div
        v-for="dn in rows"
        :key="dn.name"
        class="d-list-row body"
        :data-tour="`desk.dn_row:${dn.name}`"
        @click="sim.openDeskDeliveryNote(dn.name)"
      >
        <input type="checkbox" :aria-label="`Select ${dn.name}`" @click.stop />
        <span class="d-list-title">{{ dn.customer_name }}</span>
        <span><span class="d-pill" :class="statusColor(dn.status)" style="margin: 0">{{ dn.status }}</span></span>
        <span>{{ deskDate(dn.posting_date) }}</span>
        <span>{{ deskMoney(total(dn.items)) }}</span>
        <span class="wide-only">
          <div class="d-progress"><div :style="{ width: sim.invoiceFor(dn.sales_order)?.docstatus === 1 ? '100%' : '0%' }" /></div>
        </span>
        <span class="wide-only">
          <span v-if="dn.assigned_to" class="d-avatar" :title="sim.partnerName(dn.assigned_to)">
            {{ sim.partnerName(dn.assigned_to).split(' ').map((w) => w[0]).join('').slice(0, 2) }}
          </span>
        </span>
        <span class="d-list-id">{{ dn.name }}</span>
      </div>
      <div v-if="!rows.length" class="d-grid-empty">No Delivery Note found</div>
    </div>
  </DeskShell>
</template>
