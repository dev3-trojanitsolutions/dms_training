<script setup lang="ts">
import { computed } from 'vue'
import { useSim } from '../../engine/sim'
import DeliveryShell from './DeliveryShell.vue'
import { deliveryBadge } from './deliveryStatus'

/** Copy of the Dashboard section of dms/www/delivery-dashboard. */
const sim = useSim()
const me = computed(() => sim.state.settings.partner_user)
const mine = computed(() => sim.state.delivery_notes.filter((dn) => dn.assigned_to === me.value))
const pending = computed(() => mine.value.filter((dn) => dn.docstatus === 0))
const inProgress = computed(() => pending.value.filter((dn) => dn.attachments.length))
const completed = computed(() => mine.value.filter((dn) => dn.docstatus === 1))
const open = computed(() => sim.state.delivery_notes.filter((dn) => dn.docstatus === 0 && !dn.assigned_to))

const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const hour = new Date().getHours()
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
const firstName = computed(() => sim.state.settings.partner_name.split(' ')[0])

const stats = computed(() => [
  { label: 'Pending', value: pending.value.length, icon: 'lucide-package' },
  { label: 'In Progress', value: inProgress.value.length, icon: 'lucide-truck' },
  { label: 'Completed Today', value: completed.value.length, icon: 'lucide-circle-check' },
  { label: 'Open Deliveries', value: open.value.length, icon: 'lucide-boxes' },
  { label: 'Total Assigned', value: mine.value.length, icon: 'lucide-clipboard-list' },
])
const recent = computed(() => [...mine.value].sort((a, b) => b.name.localeCompare(a.name)).slice(0, 5))
</script>

<template>
  <DeliveryShell active="home">
    <div class="dl-row">
      <div>
        <div class="dl-eyebrow">{{ dateLine }}</div>
        <h1 class="dl-h1">{{ greeting }}, {{ firstName }}</h1>
        <p class="dl-sub">
          You have {{ pending.length }} pending deliver{{ pending.length === 1 ? 'y' : 'ies' }}.
        </p>
      </div>
      <button class="dl-btn" data-tour="dhome.start" @click="sim.navigate('delivery.pending')">
        <span class="lucide-truck size-4" aria-hidden="true" />Start Deliveries
      </button>
    </div>

    <div class="stats" data-tour="dhome.stats">
      <div v-for="s in stats" :key="s.label" class="stat">
        <div class="stat-icon"><span :class="s.icon" class="size-5" aria-hidden="true" /></div>
        <div>
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value">{{ s.value }}</div>
        </div>
      </div>
    </div>

    <div class="dl-panel" data-tour="dhome.activity">
      <div class="dl-h2" style="font-size: 17px; margin-bottom: 8px">Recent Activity</div>
      <div v-if="!recent.length" class="dl-sub" style="padding: 8px 0">No recent activity.</div>
      <div v-for="dn in recent" :key="dn.name" class="activity">
        <div>
          <div style="font-weight: 600">{{ dn.customer_name }}</div>
          <div class="dl-dn-no">{{ dn.name }}</div>
        </div>
        <span class="dl-badge" :class="deliveryBadge(dn).cls">{{ deliveryBadge(dn).label }}</span>
      </div>
    </div>
  </DeliveryShell>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}
@container (max-width: 1000px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.stat {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow:
    0 1px 2px rgba(16, 24, 40, 0.03),
    0 4px 10px -4px rgba(16, 24, 40, 0.08);
}
.stat-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #e0ecf0;
  color: #2e5a6a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.stat-label {
  font-size: 12.5px;
  color: var(--dl-text-2);
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
}
.activity {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--dl-border);
}
</style>
