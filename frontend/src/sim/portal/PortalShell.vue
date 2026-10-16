<script setup lang="ts">
import { computed } from 'vue'
import { useSim } from '../../engine/sim'
import SimDialogs from '../SimDialogs.vue'
import './portal.css'

/** The sidebar and dialogs shared by every field sales portal page. */
defineProps<{ active: string }>()

const sim = useSim()

const ICONS: Record<string, string> = {
  dashboard:
    'M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z',
  customers:
    'M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z',
  new_order:
    'M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z',
  quotation:
    'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z',
  order_history:
    'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z',
  pending_orders:
    'M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z',
}

const links = [
  { key: 'dashboard', label: 'Dashboard', screen: 'portal.sales_home' },
  { key: 'customers', label: 'Customers', screen: 'portal.sales_customer' },
  { key: 'new_order', label: 'New Order', screen: 'portal.sales_customer' },
  { key: 'quotation', label: 'Quotation', screen: '' },
  { key: 'order_history', label: 'Order History', screen: 'portal.order_history' },
  { key: 'pending_orders', label: 'Pending Orders', screen: 'portal.pending_orders' },
]

const initials = computed(() => sim.state.settings.rep_name.slice(0, 2).toUpperCase())

function go(link: (typeof links)[number]) {
  if (!link.screen) return
  // Customers and New Order both open the customer list, as on the real portal.
  if (link.key === 'customers' || link.key === 'new_order') sim.closeCustomer()
  sim.navigate(link.screen)
}
</script>

<template>
  <div class="portal">
    <aside class="p-sidebar">
      <div class="p-brand">
        <div class="p-brand-badge">LS</div>
        <div class="p-brand-text">
          <div class="p-brand-name">Luxury Stationery</div>
          <div class="p-brand-role">Field Sales</div>
        </div>
      </div>
      <div class="p-nav-section">Workspace</div>
      <button
        v-for="link in links"
        :key="link.key"
        class="p-nav-link"
        :class="{ active: active === link.key, disabled: !link.screen }"
        :data-tour="link.screen ? `nav.${link.key}` : undefined"
        :title="link.screen ? link.label : 'Not part of this training'"
        @click="go(link)"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" clip-rule="evenodd" :d="ICONS[link.key]" />
        </svg>
        <span>{{ link.label }}</span>
      </button>
      <div class="p-sidebar-footer">
        <div class="p-avatar">{{ initials }}</div>
        <div class="p-uname">{{ sim.state.settings.rep_name }}</div>
      </div>
    </aside>

    <main class="p-main">
      <slot />
    </main>

    <SimDialogs />
  </div>
</template>
