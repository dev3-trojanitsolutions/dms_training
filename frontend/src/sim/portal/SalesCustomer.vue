<script setup lang="ts">
import { computed } from 'vue'
import { useSim } from '../../engine/sim'
import PortalShell from './PortalShell.vue'

/** Copy of dms/www/sales-customer: the customer list and the customer detail panel. */
const sim = useSim()

const filtered = computed(() => {
  const q = sim.state.ui.customer_search.trim().toLowerCase()
  if (!q) return sim.state.customers
  return sim.state.customers.filter((c) =>
    [c.name, c.customer_name, c.mobile, c.territory].some((v) => v.toLowerCase().includes(q)),
  )
})

const detail = computed(() =>
  sim.state.ui.customer_detail ? sim.customer(sim.state.ui.customer_detail) : undefined,
)
const credit = computed(() => (detail.value ? sim.creditOf(detail.value.name) : undefined))

function onSearch(event: Event) {
  sim.state.ui.customer_search = (event.target as HTMLInputElement).value
}
</script>

<template>
  <PortalShell active="customers">
    <template v-if="!detail">
      <div class="p-topbar bordered">
        <div>
          <div class="p-page-title">Customers</div>
          <div class="p-page-sub">{{ sim.state.customers.length }} customers</div>
        </div>
        <input
          class="p-input p-search"
          type="text"
          placeholder="Search by name, ID or mobile…"
          autocomplete="off"
          :value="sim.state.ui.customer_search"
          data-tour="customer.search"
          @input="onSearch"
        />
      </div>
      <div class="p-content">
        <div v-if="!filtered.length" class="p-empty">No customers match your search.</div>
        <div class="customer-grid">
          <div
            v-for="c in filtered"
            :key="c.name"
            class="customer-card"
            :data-tour="`customer.open:${c.name}`"
            @click="sim.openCustomer(c.name)"
          >
            <div class="cust-avatar">{{ c.customer_name.slice(0, 2).toUpperCase() }}</div>
            <div class="cust-info">
              <div class="cust-name">{{ c.customer_name }}</div>
              <div class="cust-meta">{{ c.name }} · {{ c.territory }}</div>
              <div class="cust-meta">{{ c.mobile }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="p-topbar bordered">
        <div class="detail-head">
          <button class="p-btn" data-tour="customer.back" @click="sim.closeCustomer()">← Back</button>
          <div>
            <div class="p-page-title">{{ detail.customer_name }}</div>
            <div class="p-page-sub">{{ detail.name }} · {{ detail.territory }}</div>
          </div>
        </div>
        <div class="detail-actions">
          <button class="p-btn" disabled title="Not part of this training">New Quotation</button>
          <button class="p-btn primary" data-tour="customer.new_order" @click="sim.startOrder(detail.name)">
            + New Order
          </button>
        </div>
      </div>
      <div class="p-content detail-grid">
        <div class="p-card detail-card">
          <div class="p-section-title">Contact</div>
          <div class="kv"><span>Mobile</span><span>{{ detail.mobile }}</span></div>
          <div class="kv"><span>Territory</span><span>{{ detail.territory }}</span></div>
          <div class="kv"><span>Address</span><span>{{ detail.address }}</span></div>
        </div>
        <div class="p-card detail-card" data-tour="customer.credit">
          <div class="p-section-title">Credit</div>
          <template v-if="credit && credit.credit_limit > 0">
            <div class="kv"><span>Credit Limit</span><span>{{ sim.fmt(credit.credit_limit) }}</span></div>
            <div class="kv"><span>Outstanding</span><span>{{ sim.fmt(credit.outstanding) }}</span></div>
            <div class="kv">
              <span>Available Credit</span>
              <span :class="credit.available_credit < 1000 ? 'low' : 'ok'">{{ sim.fmt(credit.available_credit) }}</span>
            </div>
          </template>
          <div v-else class="kv"><span>Credit Limit</span><span>No limit set</span></div>
        </div>
      </div>
    </template>
  </PortalShell>
</template>

<style scoped>
.customer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.customer-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px;
  background: var(--p-surface);
  border: 1.5px solid var(--p-border);
  border-radius: 14px;
  cursor: pointer;
}
.customer-card:hover {
  border-color: var(--p-primary);
}
.cust-avatar {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--p-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex: none;
}
.cust-name {
  font-weight: 600;
}
.cust-meta {
  font-size: 12.5px;
  color: var(--p-text-2);
  margin-top: 2px;
}
.detail-head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.detail-actions {
  display: flex;
  gap: 10px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}
.detail-card {
  padding: 18px 20px;
}
.detail-card .p-section-title {
  margin-bottom: 10px;
}
.kv {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  border-bottom: 1px solid var(--p-bg-page);
  font-size: 13.5px;
}
.kv span:first-child {
  color: var(--p-text-2);
}
.kv span:last-child {
  font-weight: 600;
  text-align: right;
}
.low {
  color: #dc2626;
}
.ok {
  color: #16a34a;
}
</style>
