<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSim } from '../../engine/sim'
import type { DiscountType } from '../../engine/types'
import PortalShell from './PortalShell.vue'

/** Copy of dms/www/sales-order: catalog on the left, order summary on the right. */
const sim = useSim()

const category = ref('All')
const search = ref('')
const shippingSame = ref(true)

const cart = computed(() => sim.state.cart)
const customer = computed(() => sim.customer(cart.value.customer))
const totals = computed(() => sim.cartTotals.value)

const groups = computed(() => {
  const counts = new Map<string, number>()
  for (const it of sim.state.items) counts.set(it.item_group, (counts.get(it.item_group) ?? 0) + 1)
  return [...counts.entries()]
})

const items = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sim.state.items.filter(
    (it) =>
      (category.value === 'All' || it.item_group === category.value) &&
      (!q || it.item_name.toLowerCase().includes(q) || it.item_code.toLowerCase().includes(q)),
  )
})

const dateError = computed(
  () => !!cart.value.order_date && !!cart.value.delivery_date && cart.value.delivery_date < cart.value.order_date,
)

function stockOf(code: string) {
  return cart.value.warehouse ? sim.availableQty(code, cart.value.warehouse, cart.value.editing) : null
}

const value = (event: Event) => (event.target as HTMLInputElement).value

function onWarehouse(event: Event) {
  sim.state.cart.warehouse = value(event)
}
function onQty(code: string, event: Event) {
  sim.setQty(code, Number(value(event)))
}
function onDiscountType(event: Event) {
  sim.state.cart.discount_type = value(event) as DiscountType
  if (!sim.state.cart.discount_type) sim.state.cart.discount_value = 0
}
function onDiscountValue(event: Event) {
  sim.state.cart.discount_value = Number(value(event)) || 0
}
</script>

<template>
  <PortalShell active="new_order">
    <div class="order-page">
      <section v-if="customer" class="addr-section">
        <div class="addr-col" data-tour="order.billing_address">
          <div class="addr-title">Billing address</div>
          <div class="addr-card">
            <b>{{ customer.customer_name }}</b><br />
            {{ customer.address }}<br />
            {{ customer.mobile }}
          </div>
        </div>
        <div class="addr-col">
          <div class="addr-head">
            <div class="addr-title">Shipping address</div>
            <label class="addr-same">
              <input v-model="shippingSame" type="checkbox" />
              <span>Same as Billing Address</span>
            </label>
          </div>
          <div class="addr-card">
            <template v-if="shippingSame">
              <b>{{ customer.customer_name }}</b><br />
              {{ customer.address }}
            </template>
            <template v-else>No other shipping addresses found.</template>
          </div>
        </div>
      </section>

      <div class="order-wrap">
        <!-- Categories and warehouse -->
        <aside class="cat-sidebar">
          <div class="cat-label">Categories</div>
          <div
            class="cat-item"
            :class="{ active: category === 'All' }"
            data-tour="order.category:All"
            @click="category = 'All'"
          >
            <span>All</span><span class="cat-count">{{ sim.state.items.length }}</span>
          </div>
          <div
            v-for="[group, count] in groups"
            :key="group"
            class="cat-item"
            :class="{ active: category === group }"
            :data-tour="`order.category:${group}`"
            @click="category = group"
          >
            <span>{{ group }}</span><span class="cat-count">{{ count }}</span>
          </div>
          <div class="wh-filter">
            <label class="p-label">Warehouse</label>
            <select class="p-select" :value="cart.warehouse" data-tour="order.warehouse" @change="onWarehouse">
              <option value="">Select warehouse…</option>
              <option v-for="wh in sim.state.warehouses" :key="wh" :value="wh">{{ wh }}</option>
            </select>
          </div>
        </aside>

        <!-- Catalog -->
        <div class="catalog">
          <div class="catalog-top">
            <input
              v-model="search"
              class="p-input"
              type="text"
              placeholder="Search items…"
              autocomplete="off"
              data-tour="order.item_search"
            />
            <div class="item-count">{{ items.length }} items</div>
          </div>
          <div class="items-grid">
            <div v-for="it in items" :key="it.item_code" class="item-card" :data-tour="`order.item:${it.item_code}`">
              <div class="item-img">{{ it.item_group.slice(0, 1) }}</div>
              <div class="item-name">{{ it.item_name }}</div>
              <div class="item-code">{{ it.item_code }}</div>
              <div class="item-price">{{ sim.fmt(it.rate) }} <span>/ {{ it.uom }}</span></div>
              <div class="item-stock" :class="{ low: (stockOf(it.item_code) ?? 1) <= 5 }">
                <template v-if="stockOf(it.item_code) === null">Select a warehouse to see stock</template>
                <template v-else>In stock: {{ stockOf(it.item_code) }}</template>
              </div>
              <button class="p-btn add-btn" :data-tour="`order.add:${it.item_code}`" @click="sim.addItem(it.item_code)">
                Add
              </button>
            </div>
          </div>
        </div>

        <!-- Order summary -->
        <div class="cart-panel p-card" data-tour="order.cart">
          <div class="cart-header">
            <div class="cart-title">Order summary</div>
            <span class="p-badge gray">DRAFT</span>
          </div>
          <div class="cart-meta">
            <div class="meta-row"><span>Sales rep</span><span>{{ sim.state.settings.rep_name }}</span></div>
            <div class="meta-row"><span>Customer</span><span>{{ customer?.customer_name ?? '—' }}</span></div>
            <div v-if="cart.editing" class="meta-row"><span>Editing</span><span>{{ cart.editing }}</span></div>
          </div>

          <div class="cart-items">
            <div v-if="!cart.lines.length" class="no-items">No items yet.<br />Add products from the catalog.</div>
            <div v-for="line in sim.cartLines.value" :key="line.item_code" class="cart-line">
              <div class="line-info">
                <div class="line-name">{{ line.item_name }}</div>
                <div class="line-rate">{{ sim.fmt(line.rate) }}</div>
              </div>
              <input
                class="p-input qty-input"
                type="number"
                min="0"
                inputmode="numeric"
                :value="line.qty"
                :data-tour="`order.qty:${line.item_code}`"
                :aria-label="`Quantity of ${line.item_name}`"
                @input="onQty(line.item_code, $event)"
              />
              <div class="line-amount">{{ sim.fmt(line.amount) }}</div>
              <button
                class="line-remove"
                :data-tour="`order.remove:${line.item_code}`"
                :aria-label="`Remove ${line.item_name}`"
                @click="sim.removeLine(line.item_code)"
              >
                ×
              </button>
            </div>
          </div>

          <div v-if="totals.credit.credit_limit > 0" class="credit-section" data-tour="order.credit">
            <div class="credit-row"><span>Credit Limit</span><span>{{ sim.fmt(totals.credit.credit_limit) }}</span></div>
            <div class="credit-row"><span>Outstanding</span><span>{{ sim.fmt(totals.credit.outstanding) }}</span></div>
            <div class="credit-row">
              <span>Available Credit</span>
              <span :style="{ color: totals.credit.available_credit <= 0 ? '#DC2626' : '#16a34a' }">
                {{ sim.fmt(totals.credit.available_credit) }}
              </span>
            </div>
            <div v-if="totals.exceeds" class="credit-warning">Order exceeds available credit</div>
          </div>

          <div class="discount-row">
            <select class="p-select" :value="cart.discount_type" data-tour="order.discount_type" @change="onDiscountType">
              <option value="">No discount</option>
              <option value="Percentage">Percentage</option>
              <option value="Amount">Amount</option>
            </select>
            <input
              class="p-input"
              type="number"
              min="0"
              placeholder="0"
              :value="cart.discount_value || ''"
              :disabled="!cart.discount_type"
              data-tour="order.discount_value"
              @input="onDiscountValue"
            />
          </div>

          <div class="cart-totals" data-tour="order.totals">
            <div class="total-row"><span>Subtotal</span><span>{{ sim.fmt(totals.subtotal) }}</span></div>
            <div v-if="totals.discount" class="total-row"><span>Discount</span><span>− {{ sim.fmt(totals.discount) }}</span></div>
            <div class="grand-row"><span>Grand total</span><span>{{ sim.fmt(totals.grand) }}</span></div>
          </div>

          <div class="cart-footer">
            <div class="date-pair">
              <div>
                <label class="p-label">Order Date</label>
                <input
                  v-model="sim.state.cart.order_date"
                  class="p-input"
                  type="date"
                  data-tour="order.order_date"
                />
              </div>
              <div>
                <label class="p-label">Delivery date</label>
                <input
                  v-model="sim.state.cart.delivery_date"
                  class="p-input"
                  type="date"
                  data-tour="order.delivery_date"
                />
              </div>
            </div>
            <div v-if="dateError" class="date-error">Delivery date cannot be before order date.</div>
            <div class="cart-buttons">
              <button class="p-btn" data-tour="order.save" @click="sim.saveCart()">Save</button>
              <button class="p-btn primary" data-tour="order.submit" @click="sim.submitCart()">
                Submit Sales Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PortalShell>
</template>

<style scoped>
.order-page {
  padding: 20px 24px;
}
.addr-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.addr-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-2);
  margin-bottom: 6px;
}
.addr-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.addr-same {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: var(--p-text-2);
}
.addr-card {
  background: var(--p-surface);
  border: 1px solid var(--p-border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
}
.order-wrap {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}
.cat-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--p-text-2);
  margin-bottom: 8px;
}
.cat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13.5px;
}
.cat-item:hover,
.cat-item.active {
  background: var(--p-hover);
  font-weight: 600;
}
.cat-count {
  color: var(--p-text-2);
  font-size: 12px;
}
.wh-filter {
  margin-top: 18px;
}
.catalog-top {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.item-count {
  font-size: 12.5px;
  color: var(--p-text-2);
  white-space: nowrap;
}
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.item-card {
  background: var(--p-surface);
  border: 1px solid var(--p-border);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.item-img {
  height: 64px;
  border-radius: 8px;
  background: var(--p-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: var(--p-text-2);
  margin-bottom: 8px;
}
.item-name {
  font-weight: 600;
  font-size: 13.5px;
  line-height: 1.3;
}
.item-code {
  font-size: 11.5px;
  color: var(--p-text-2);
  margin-top: 2px;
}
.item-price {
  font-weight: 700;
  margin-top: 6px;
}
.item-price span {
  font-weight: 400;
  font-size: 12px;
  color: var(--p-text-2);
}
.item-stock {
  font-size: 12px;
  color: var(--p-success);
  margin-top: 2px;
}
.item-stock.low {
  color: #b45309;
}
.add-btn {
  margin-top: auto;
  padding: 7px;
  margin-top: 10px;
}
.cart-panel {
  position: sticky;
  top: 0;
  padding: 16px;
}
.cart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.cart-title {
  font-weight: 700;
  font-size: 15px;
}
.cart-meta {
  font-size: 13px;
  border-bottom: 1px solid var(--p-border);
  padding-bottom: 8px;
  margin-bottom: 8px;
}
.meta-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
}
.meta-row span:first-child {
  color: var(--p-text-2);
}
.meta-row span:last-child {
  font-weight: 600;
}
.no-items {
  text-align: center;
  color: var(--p-text-2);
  font-size: 13px;
  padding: 20px 0;
}
.cart-line {
  display: grid;
  grid-template-columns: 1fr 64px 84px 22px;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--p-bg-page);
}
.line-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
}
.line-rate {
  font-size: 12px;
  color: var(--p-text-2);
}
.qty-input {
  padding: 6px 6px;
  text-align: center;
}
.line-amount {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}
.line-remove {
  border: none;
  background: none;
  font-size: 18px;
  color: var(--p-text-2);
  cursor: pointer;
}
.credit-section {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--p-bg-page);
  border-radius: 10px;
  font-size: 13px;
}
.credit-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}
.credit-row span:last-child {
  font-weight: 600;
}
.credit-warning {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--p-error-bg);
  color: var(--p-error);
  font-weight: 600;
  font-size: 12.5px;
}
.discount-row {
  display: grid;
  grid-template-columns: 1fr 90px;
  gap: 8px;
  margin-top: 12px;
}
.cart-totals {
  margin-top: 12px;
  font-size: 13.5px;
}
.total-row,
.grand-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}
.total-row span:first-child {
  color: var(--p-text-2);
}
.grand-row {
  font-weight: 700;
  font-size: 16px;
  border-top: 1px solid var(--p-border);
  margin-top: 4px;
  padding-top: 8px;
}
.cart-footer {
  margin-top: 12px;
}
.date-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.date-error {
  font-size: 11.5px;
  color: var(--p-error);
  margin-top: 4px;
}
.cart-buttons {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 8px;
  margin-top: 12px;
}
@container (max-width: 1150px) {
  .order-wrap {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
  .cat-sidebar {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .cat-label {
    display: none;
  }
  .wh-filter {
    margin: 0 0 0 auto;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .wh-filter .p-label {
    margin: 0;
  }
}
@container (max-width: 760px) {
  .order-page {
    padding: 12px;
  }
  .order-wrap,
  .addr-section {
    grid-template-columns: 1fr;
  }
  .cart-panel {
    position: static;
  }
}
</style>
