<script setup lang="ts">
import { computed } from 'vue'
import { useSim } from '../../engine/sim'
import DmsPicker from './DmsPicker.vue'
import DmsShell from './DmsShell.vue'

/** Copy of dms/frontend/src/pages/CustomerBalanceReport.vue. */
const sim = useSim()
const f = computed(() => sim.state.balance)
const rows = computed(() => sim.balanceRows.value)
const total = computed(() => rows.value.reduce((s, r) => s + r.outstanding_balance, 0))

const money = (n: number) =>
  `${sim.state.settings.currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function exportReport() {
  void sim.alert('info', 'In training, Export does not download a file. On the real site it saves an Excel sheet of these rows.', 'desk')
}
</script>

<template>
  <DmsShell active="customer_balance" title="Customer Balance Report">
    <div class="w-full space-y-4 px-3 pb-10 pt-6 sm:px-5">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-40"><span class="dms-label">Company</span><input class="dms-input" aria-label="Company" /></div>
        <div class="w-36"><span class="dms-label">As On Date</span><input class="dms-input" type="date" aria-label="As On Date" readonly /></div>
        <DmsPicker
          v-model="f.customer"
          name="balance_customer"
          label="Customer"
          placeholder="Search customer name or ID"
          tour="dms.balance.customer"
        />
        <div class="w-40"><span class="dms-label">Customer Group</span><input class="dms-input" aria-label="Customer Group" /></div>
        <label class="dms-check mb-1.5">
          <input v-model="f.show_zero_balance" type="checkbox" data-tour="dms.balance.zero" />Show Zero Balance
        </label>
        <button class="dms-btn" @click="exportReport"><span class="lucide-download size-4" aria-hidden="true" />Export</button>
      </div>

      <div class="flex flex-wrap gap-3">
        <div class="min-w-48 rounded-6 border border-outline-gray-1 px-4 py-3" data-tour="dms.balance.total">
          <p class="text-sm text-ink-gray-5">Total Pending Balance</p>
          <p class="mt-1 text-lg font-semibold text-ink-gray-8">{{ money(total) }}</p>
        </div>
        <div class="min-w-48 rounded-6 border border-outline-gray-1 px-4 py-3">
          <p class="text-sm text-ink-gray-5">Total Customers</p>
          <p class="mt-1 text-lg font-semibold text-ink-gray-8">{{ rows.length }}</p>
        </div>
      </div>

      <div v-if="!rows.length" class="flex flex-col items-center justify-center gap-3 py-16 text-center" data-tour="dms.balance.table">
        <span class="lucide-wallet size-6 text-ink-gray-5" aria-hidden="true" />
        <p class="text-sm text-ink-gray-5">No customer balances for these filters.</p>
      </div>
      <template v-else>
        <div class="overflow-x-auto rounded-6 border border-outline-gray-1" data-tour="dms.balance.table">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-outline-gray-1 text-ink-gray-6">
                <th class="w-10 px-4 py-2"><input type="checkbox" aria-label="Select all rows" /></th>
                <th class="px-4 py-2 text-right font-medium">Sl No</th>
                <th class="px-4 py-2 font-medium">Customer ID</th>
                <th class="px-4 py-2 font-medium">Customer Name</th>
                <th class="px-4 py-2 text-right font-medium">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-gray-1">
              <tr v-for="row in rows" :key="row.customer" :data-tour="`dms.balance.row:${row.customer}`">
                <td class="w-10 px-4 py-2"><input type="checkbox" :aria-label="`Select ${row.customer}`" /></td>
                <td class="px-4 py-2 text-right text-ink-gray-7">{{ row.sl_no }}</td>
                <td class="px-4 py-2 text-ink-gray-8"><span class="text-ink-blue-link">{{ row.customer }}</span></td>
                <td class="px-4 py-2 text-ink-gray-8">{{ row.customer_name }}</td>
                <td class="px-4 py-2 text-right text-ink-gray-7" :data-tour="`dms.balance.amount:${row.customer}`">
                  {{ money(row.outstanding_balance) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex gap-1">
            <button v-for="size in [20, 100, 500, 2500]" :key="size" class="dms-btn" :class="{ solid: size === 20 }">{{ size }}</button>
            <button class="dms-btn">All</button>
          </div>
          <span class="text-sm text-ink-gray-5">Showing {{ rows.length }} of {{ rows.length }}</span>
        </div>
      </template>
    </div>
  </DmsShell>
</template>
