<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, today } from '../../engine/dates'
import { useSim } from '../../engine/sim'
import PortalShell from './PortalShell.vue'
import { statusBadge } from './status'

/** Copy of dms/www/sales-home: the Sales Rep dashboard. */
const sim = useSim()

const mine = computed(() => sim.state.sales_orders.filter((so) => so.mine))
const todays = computed(() => mine.value.filter((so) => so.transaction_date === today()))
const todaysSales = computed(() =>
  todays.value.filter((so) => so.docstatus === 1).reduce((sum, so) => sum + so.grand_total, 0),
)
const recent = computed(() =>
  [...mine.value].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.name.localeCompare(a.name)).slice(0, 8),
)

const dateLine = new Date().toLocaleDateString('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const hour = new Date().getHours()
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
const firstName = computed(() => sim.state.settings.rep_name.split(' ')[0])

function newOrder() {
  sim.closeCustomer()
  sim.navigate('portal.sales_customer')
}
</script>

<template>
  <PortalShell active="dashboard">
    <div class="p-topbar">
      <div>
        <div class="p-page-date">{{ dateLine }}</div>
        <div class="p-greeting">{{ greeting }}, {{ firstName }}</div>
      </div>
      <button class="p-btn" data-tour="home.new_order" @click="newOrder">+ New Order</button>
    </div>

    <div class="p-content">
      <div class="stats-grid" data-tour="home.stats">
        <div class="p-card stat-card">
          <div class="stat-label">Today's Sales</div>
          <div class="stat-value">{{ sim.fmt(todaysSales) }}</div>
        </div>
        <div class="p-card stat-card">
          <div class="stat-label">Orders Created</div>
          <div class="stat-value">{{ todays.length }}</div>
        </div>
        <div class="p-card stat-card">
          <div class="stat-label">Customers</div>
          <div class="stat-value">{{ sim.state.customers.length }}</div>
        </div>
        <div class="p-card stat-card">
          <div class="stat-label">Currency</div>
          <div class="stat-value">{{ sim.state.settings.currency }}</div>
        </div>
      </div>

      <div class="two-col">
        <div class="p-card" data-tour="home.activity">
          <div class="p-section-header">
            <div class="p-section-title">Recent activity</div>
            <button class="p-link" @click="sim.navigate('portal.order_history')">View all</button>
          </div>
          <div v-if="!recent.length" class="p-empty">No orders yet.</div>
          <div v-for="so in recent" :key="so.name" class="activity-row">
            <div>
              <div class="activity-name">{{ so.customer_name }}</div>
              <div class="activity-sub">{{ so.name }} · {{ formatDate(so.transaction_date) }}</div>
            </div>
            <div class="activity-right">
              <div class="activity-amount">{{ sim.fmt(so.grand_total) }}</div>
              <span class="p-badge" :class="statusBadge(so.status)">{{ so.status }}</span>
            </div>
          </div>
        </div>

        <div class="p-card" data-tour="home.quick_actions">
          <div class="p-section-header">
            <div class="p-section-title">Quick actions</div>
          </div>
          <div class="quick-grid">
            <button class="quick-item" @click="newOrder">New Order</button>
            <button class="quick-item" @click="newOrder">Find Customer</button>
            <button class="quick-item" @click="sim.navigate('portal.order_history')">Order History</button>
            <button class="quick-item" @click="sim.navigate('portal.pending_orders')">Pending Orders</button>
          </div>
        </div>
      </div>
    </div>
  </PortalShell>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  padding: 20px 22px;
}
.stat-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--p-text-2);
  margin-bottom: 8px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
}
.two-col {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
}
.activity-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--p-bg-page);
}
.activity-name {
  font-weight: 600;
}
.activity-sub {
  font-size: 12px;
  color: var(--p-text-2);
  margin-top: 2px;
}
.activity-right {
  text-align: right;
}
.activity-amount {
  font-weight: 600;
  margin-bottom: 4px;
}
.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
}
.quick-item {
  padding: 18px 10px;
  border: 1.5px solid var(--p-border);
  border-radius: 12px;
  background: var(--p-surface);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
.quick-item:hover {
  background: var(--p-hover);
}
@container (max-width: 1000px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .two-col {
    grid-template-columns: 1fr;
  }
}
</style>
