<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSim } from '../../engine/sim'
import DeliveryShell from './DeliveryShell.vue'
import DnCard from './DnCard.vue'

/** Copy of the Pending Deliveries section: drafts assigned to this partner. */
const sim = useSim()
const search = ref('')
const notes = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sim.state.delivery_notes
    .filter((dn) => dn.docstatus === 0 && dn.assigned_to === sim.state.settings.partner_user)
    .filter((dn) => !q || dn.name.toLowerCase().includes(q) || dn.customer_name.toLowerCase().includes(q))
})
</script>

<template>
  <DeliveryShell active="pending">
    <div class="dl-row">
      <h1 class="dl-section-title">Pending Deliveries</h1>
      <span class="dl-count">{{ notes.length }}</span>
    </div>
    <input v-model="search" class="dl-search" type="search" placeholder="Search by number or customer" data-tour="dpending.search" />
    <div class="dl-cards" data-tour="dpending.list">
      <button
        v-for="dn in notes"
        :key="dn.name"
        class="dl-card"
        :data-tour="`dpending.open:${dn.name}`"
        @click="sim.openDeliveryNote(dn.name)"
      >
        <DnCard :dn="dn" />
      </button>
    </div>
    <div v-if="!notes.length" class="dl-empty">No pending deliveries found.</div>
  </DeliveryShell>
</template>
