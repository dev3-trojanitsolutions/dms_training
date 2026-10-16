<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDate } from '../../engine/dates'
import { useSim } from '../../engine/sim'
import PortalShell from './PortalShell.vue'
import { statusBadge } from './status'

/** Copy of dms/www/order-history: every order the rep created. */
const sim = useSim()
const search = ref('')
const status = ref('')
const expanded = ref('')

const STATUSES = ['Draft', 'To Deliver and Bill', 'To Bill', 'To Deliver', 'Completed', 'Cancelled']

const orders = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sim.state.sales_orders
    .filter((so) => so.mine)
    .filter((so) => !status.value || so.status === status.value)
    .filter((so) => !q || so.name.toLowerCase().includes(q) || so.customer_name.toLowerCase().includes(q))
    .sort((a, b) => b.name.localeCompare(a.name))
})

const invoiceFor = (name: string) => sim.state.sales_invoices.find((si) => si.sales_order === name)

function toggle(name: string) {
  expanded.value = expanded.value === name ? '' : name
}
</script>

<template>
  <PortalShell active="order_history">
    <div class="p-topbar">
      <div>
        <div class="p-page-title">Order History</div>
        <div class="p-page-sub">Your Sales Orders</div>
      </div>
      <div class="filters">
        <input
          v-model="search"
          class="p-input p-search"
          type="text"
          placeholder="Search by Order ID or Customer"
          autocomplete="off"
          data-tour="history.search"
        />
        <select v-model="status" class="p-select status-filter" data-tour="history.status_filter">
          <option value="">All statuses</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
    </div>
    <div class="p-content">
      <div class="order-list" data-tour="history.list">
        <div v-if="!orders.length" class="p-empty">No orders found.</div>
        <div
          v-for="so in orders"
          :key="so.name"
          class="p-card order-card"
          :data-tour="`history.row:${so.name}`"
          @click="toggle(so.name)"
        >
          <div class="order-head">
            <div>
              <div class="order-name">{{ so.name }}</div>
              <div class="order-customer">{{ so.customer_name }}</div>
            </div>
            <span class="p-badge" :class="statusBadge(so.status)">{{ so.status }}</span>
          </div>
          <div class="order-meta">
            <span>Ordered {{ formatDate(so.transaction_date) }}</span>
            <span>Delivery {{ formatDate(so.delivery_date) }}</span>
            <span class="order-total">{{ sim.fmt(so.grand_total) }}</span>
            <button
              v-if="so.docstatus === 0"
              class="p-link"
              :data-tour="`history.edit:${so.name}`"
              @click.stop="sim.reopenOrder(so.name)"
            >
              Edit
            </button>
          </div>
          <div v-if="expanded === so.name" class="order-lines">
            <div v-for="line in so.items" :key="line.item_code" class="order-line">
              <span>{{ line.item_name }}</span>
              <span>{{ line.qty }} × {{ sim.fmt(line.rate) }}</span>
            </div>
          </div>
          <div v-if="invoiceFor(so.name)" class="p-training-note">
            <span aria-hidden="true">🎓</span>
            <span>
              Behind the scenes: Sales Invoice <b>{{ invoiceFor(so.name)!.name }}</b> is
              {{ invoiceFor(so.name)!.status }}. It is submitted automatically when everything is delivered.
            </span>
          </div>
        </div>
      </div>
    </div>
  </PortalShell>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.status-filter {
  width: 190px;
}
.order-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.order-card {
  padding: 14px 18px;
  cursor: pointer;
}
.order-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.order-name {
  font-weight: 700;
}
.order-customer {
  color: var(--p-text-2);
  font-size: 13px;
  margin-top: 2px;
}
.order-meta {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--p-text-2);
}
.order-total {
  margin-left: auto;
  font-weight: 700;
  font-size: 14px;
  color: var(--p-text);
}
.order-lines {
  margin-top: 10px;
  border-top: 1px solid var(--p-bg-page);
  padding-top: 8px;
}
.order-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 3px 0;
}
</style>
