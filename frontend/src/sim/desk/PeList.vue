<script setup lang="ts">
import { computed } from 'vue'
import { useSim } from '../../engine/sim'
import DeskShell from './DeskShell.vue'
import { deskDate, deskMoney } from './format'
import { statusColor } from './indicator'

/** Payment Entry list view: the in_list_view columns of payment_entry.json. */
const sim = useSim()
const rows = computed(() => [...sim.state.payment_entries].sort((a, b) => b.name.localeCompare(a.name)))
</script>

<template>
  <DeskShell workspace="accounting" doctype="Payment Entry" list-screen="desk.pe_list">
    <template #actions>
      <button class="d-btn"><span class="lucide-list size-4" aria-hidden="true" />List View <span class="lucide-chevrons-up-down size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Refresh"><span class="lucide-refresh-cw size-4" aria-hidden="true" /></button>
      <button class="d-btn icon" aria-label="Menu"><span class="lucide-ellipsis size-4" aria-hidden="true" /></button>
      <button class="d-btn primary"><span class="lucide-plus size-4" aria-hidden="true" />Add Payment Entry</button>
    </template>

    <div class="d-filters">
      <input class="d-control" placeholder="ID" aria-label="ID" />
      <select class="d-control" aria-label="Payment Type"><option>Payment Type</option></select>
      <input class="d-control" placeholder="Mode of Payment" aria-label="Mode of Payment" />
      <input class="d-control" placeholder="Party" aria-label="Party" />
      <span class="spacer" />
      <button class="d-btn"><span class="lucide-filter size-4" aria-hidden="true" />Filter</button>
      <button class="d-btn"><span class="lucide-arrow-down-wide-narrow size-4" aria-hidden="true" />Created On</button>
    </div>

    <div class="d-list" data-tour="desk.pe_list.table">
      <div class="d-list-row head">
        <input type="checkbox" aria-label="Select all" />
        <span>Title</span>
        <span>Status</span>
        <span>Posting Date</span>
        <span>Mode of Payment</span>
        <span class="wide-only">Paid Amount</span>
        <span class="wide-only" />
        <span style="text-align: right">{{ rows.length }} of {{ rows.length }}</span>
      </div>
      <div
        v-for="pe in rows"
        :key="pe.name"
        class="d-list-row body"
        :data-tour="`desk.pe_row:${pe.name}`"
        @click="sim.openDeskPaymentEntry(pe.name)"
      >
        <input type="checkbox" :aria-label="`Select ${pe.name}`" @click.stop />
        <span class="d-list-title">{{ pe.party_name }}</span>
        <span><span class="d-pill" :class="statusColor(pe.status)" style="margin: 0">{{ pe.status }}</span></span>
        <span>{{ deskDate(pe.posting_date) }}</span>
        <span>{{ pe.mode_of_payment }}</span>
        <span class="wide-only">{{ deskMoney(pe.paid_amount) }}</span>
        <span class="wide-only" />
        <span class="d-list-id">{{ pe.name }}</span>
      </div>
      <div v-if="!rows.length" class="d-grid-empty">No Payment Entry found</div>
    </div>
  </DeskShell>
</template>
