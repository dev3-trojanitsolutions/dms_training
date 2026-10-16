<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDate } from '../../engine/dates'
import { useSim } from '../../engine/sim'
import type { DeliveryNote } from '../../engine/types'
import DeliveryShell from './DeliveryShell.vue'

/** Copy of the Delivery Assign section: pick up unassigned notes, or release your own. */
const sim = useSim()
const search = ref('')
const me = computed(() => sim.state.settings.partner_user)

const drafts = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sim.state.delivery_notes
    .filter((dn) => dn.docstatus === 0)
    .filter((dn) => !q || dn.name.toLowerCase().includes(q) || dn.customer_name.toLowerCase().includes(q))
})
const unassigned = computed(() => drafts.value.filter((dn) => !dn.assigned_to))
const mine = computed(() => drafts.value.filter((dn) => dn.assigned_to === me.value))

const itemsLabel = (dn: DeliveryNote) => `${dn.items.length} item${dn.items.length === 1 ? '' : 's'}`
</script>

<template>
  <DeliveryShell active="assign">
    <div>
      <div class="dl-eyebrow">Self Service</div>
      <h1 class="dl-section-title" style="margin: 6px 0 4px">Delivery Assign</h1>
      <p class="dl-sub">Pick up unassigned deliveries or release ones assigned to you.</p>
    </div>
    <input v-model="search" class="dl-search" type="search" placeholder="Search by number or customer" data-tour="dassign.search" />

    <section data-tour="dassign.unassigned">
      <div class="dl-row" style="margin-bottom: 12px">
        <h2 class="dl-h2">Unassigned Deliveries</h2>
        <span class="dl-count">{{ unassigned.length }}</span>
      </div>
      <div class="dl-cards">
        <div v-for="dn in unassigned" :key="dn.name" class="dl-card">
          <div class="dl-card-top">
            <span class="dl-dn-no">{{ dn.name }}</span>
            <span class="dl-badge addr-ok"><span class="lucide-map-pin size-4" aria-hidden="true" />Address available</span>
          </div>
          <div class="dl-customer">{{ dn.customer_name }}</div>
          <div class="dl-meta">
            <span><span class="lucide-calendar size-4" aria-hidden="true" />{{ formatDate(dn.posting_date) }}</span>
            <span><span class="lucide-package size-4" aria-hidden="true" />{{ itemsLabel(dn) }}</span>
          </div>
          <button class="dl-btn pill" :data-tour="`dassign.assign:${dn.name}`" @click="sim.assignToMe(dn.name)">
            <span class="lucide-user-plus size-4" aria-hidden="true" />Assign to Me
          </button>
        </div>
      </div>
      <div v-if="!unassigned.length" class="dl-empty">No unassigned deliveries.</div>
    </section>

    <section data-tour="dassign.mine">
      <div class="dl-row" style="margin-bottom: 12px">
        <h2 class="dl-h2">My Assigned Deliveries</h2>
        <span class="dl-count">{{ mine.length }}</span>
      </div>
      <div class="dl-cards">
        <div v-for="dn in mine" :key="dn.name" class="dl-card">
          <div class="dl-card-top">
            <span class="dl-dn-no">{{ dn.name }}</span>
            <span class="dl-badge addr-ok"><span class="lucide-map-pin size-4" aria-hidden="true" />Address available</span>
          </div>
          <div class="dl-customer">{{ dn.customer_name }}</div>
          <div class="dl-meta">
            <span><span class="lucide-calendar size-4" aria-hidden="true" />{{ formatDate(dn.posting_date) }}</span>
            <span><span class="lucide-package size-4" aria-hidden="true" />{{ itemsLabel(dn) }}</span>
          </div>
          <button class="dl-btn pill ghost" :data-tour="`dassign.unassign:${dn.name}`" @click="sim.unassign(dn.name)">
            <span class="lucide-user-minus size-4" aria-hidden="true" />Unassign
          </button>
        </div>
      </div>
      <div v-if="!mine.length" class="dl-empty">Nothing assigned to you yet.</div>
    </section>
  </DeliveryShell>
</template>
