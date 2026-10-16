<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDate } from '../../engine/dates'
import { useSim } from '../../engine/sim'
import PortalShell from './PortalShell.vue'

/** Copy of dms/www/pending-orders: the rep's draft Sales Orders. */
const sim = useSim()
const search = ref('')

const pending = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sim.state.sales_orders
    .filter((so) => so.mine && so.docstatus === 0)
    .filter((so) => !q || so.name.toLowerCase().includes(q) || so.customer_name.toLowerCase().includes(q))
    .sort((a, b) => b.name.localeCompare(a.name))
})

function onAction(name: string, event: Event) {
  const select = event.target as HTMLSelectElement
  const action = select.value
  select.value = ''
  if (action === 'reopen') sim.reopenOrder(name)
  else if (action === 'submit') void sim.submitPending(name)
  else if (action === 'discard') void sim.discardPending(name)
}
</script>

<template>
  <PortalShell active="pending_orders">
    <div class="p-topbar">
      <div>
        <div class="p-page-title">Pending Orders</div>
        <div class="p-page-sub">Saved Sales Orders</div>
      </div>
      <input
        v-model="search"
        class="p-input p-search"
        type="text"
        placeholder="Search by Order ID or Customer"
        autocomplete="off"
        data-tour="pending.search"
      />
    </div>
    <div class="p-content">
      <div class="p-card p-table-wrap" data-tour="pending.table">
        <table class="p-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Items</th>
              <th>Grand Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="so in pending" :key="so.name" :data-tour="`pending.row:${so.name}`">
              <td class="order-id">{{ so.name }}</td>
              <td>{{ so.customer_name }}</td>
              <td>{{ formatDate(so.transaction_date) }}</td>
              <td>{{ so.items.length }}</td>
              <td>{{ sim.fmt(so.grand_total) }}</td>
              <td>
                <select class="p-select action-select" :data-tour="`pending.action:${so.name}`" @change="onAction(so.name, $event)">
                  <option value="">Select Action</option>
                  <option value="reopen">Reopen</option>
                  <option value="submit">Submit</option>
                  <option value="discard">Discard</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!pending.length" class="p-empty">No pending orders yet.</div>
      </div>
    </div>
  </PortalShell>
</template>

<style scoped>
.order-id {
  font-weight: 600;
}
.action-select {
  width: 150px;
  padding: 6px 10px;
  font-size: 13px;
}
</style>
