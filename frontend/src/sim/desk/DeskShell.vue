<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { useSim } from '../../engine/sim'
import SimDialogs from '../SimDialogs.vue'
import { statusColor } from './indicator'
import './desk.css'

/**
 * The Desk frame: app rail, workspace sidebar, page head with breadcrumb and
 * actions, form tabs, optional form sidebar, and dialogs.
 */
const props = defineProps<{
  workspace: 'selling' | 'stock' | 'accounting'
  doctype: string
  listScreen: string
  title?: string
  status?: string
  tabs?: string[]
}>()
const activeTab = defineModel<string>('tab', { default: 'Details' })

const sim = useSim()
const slots = useSlots()

interface SideItem {
  label: string
  icon: string
  screen?: string
  tour?: string
  more?: boolean
}

const SIDEBARS: Record<'selling' | 'stock' | 'accounting', SideItem[]> = {
  selling: [
    { label: 'Home', icon: 'lucide-house' },
    { label: 'Dashboard', icon: 'lucide-chart-no-axes-column' },
    { label: 'Customer', icon: 'lucide-user' },
    { label: 'Quotation', icon: 'lucide-file-text' },
    { label: 'Sales Order', icon: 'lucide-shopping-cart', screen: 'desk.so_list', tour: 'desk.nav.sales_order' },
    { label: 'Delivery Note', icon: 'lucide-truck', screen: 'desk.dn_list', tour: 'desk.nav.delivery_note' },
    { label: 'Sales Invoice', icon: 'lucide-receipt', screen: 'desk.si_list', tour: 'desk.nav.sales_invoice' },
    { label: 'Reports', icon: 'lucide-table', more: true },
    { label: 'Items', icon: 'lucide-package', more: true },
    { label: 'POS', icon: 'lucide-monitor', more: true },
    { label: 'Setup', icon: 'lucide-database', more: true },
  ],
  stock: [
    { label: 'Home', icon: 'lucide-house' },
    { label: 'Dashboard', icon: 'lucide-chart-no-axes-column' },
    { label: 'Item', icon: 'lucide-package' },
    { label: 'Material Request', icon: 'lucide-clipboard-list' },
    { label: 'Stock Entry', icon: 'lucide-arrow-left-right' },
    { label: 'Stock Reconciliation', icon: 'lucide-scale' },
    { label: 'Purchase Receipt', icon: 'lucide-package-check' },
    { label: 'Delivery Note', icon: 'lucide-truck', screen: 'desk.dn_list', tour: 'desk.nav.delivery_note' },
    { label: 'Sales Order', icon: 'lucide-shopping-cart', screen: 'desk.so_list', tour: 'desk.nav.sales_order' },
    { label: 'Reports', icon: 'lucide-table', more: true },
    { label: 'Tools', icon: 'lucide-wrench', more: true },
    { label: 'Serial & Batch', icon: 'lucide-layers', more: true },
    { label: 'Setup', icon: 'lucide-database', more: true },
  ],
  accounting: [
    { label: 'Home', icon: 'lucide-house' },
    { label: 'Dashboard', icon: 'lucide-chart-no-axes-column' },
    { label: 'Chart of Accounts', icon: 'lucide-list-tree' },
    { label: 'Sales Invoice', icon: 'lucide-receipt', screen: 'desk.si_list', tour: 'desk.nav.sales_invoice' },
    { label: 'Payment Entry', icon: 'lucide-hand-coins', screen: 'desk.pe_list', tour: 'desk.nav.payment_entry' },
    { label: 'Journal Entry', icon: 'lucide-book-open' },
    { label: 'Purchase Invoice', icon: 'lucide-file-input' },
    { label: 'Reports', icon: 'lucide-table', more: true },
    { label: 'Banking', icon: 'lucide-landmark', more: true },
    { label: 'Setup', icon: 'lucide-database', more: true },
  ],
}

const WORKSPACE_LABELS = { selling: 'Selling', stock: 'Stock', accounting: 'Accounting' }

const RAIL = [
  { icon: 'lucide-sliders-horizontal', ws: '' },
  { icon: 'lucide-calculator', ws: 'accounting' },
  { icon: 'lucide-store', ws: 'selling' },
  { icon: 'lucide-shopping-cart', ws: '' },
  { icon: 'lucide-warehouse', ws: 'stock' },
  { icon: 'lucide-factory', ws: '' },
  { icon: 'lucide-chart-gantt', ws: '' },
  { icon: 'lucide-ship', ws: '' },
  { icon: 'lucide-badge-check', ws: '' },
]

const items = computed(() => SIDEBARS[props.workspace])
const user = computed(() => sim.state.settings.desk_user_name || sim.state.settings.store_keeper_name)
const initials = computed(() =>
  user.value
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

function open(item: SideItem) {
  if (item.screen) sim.navigate(item.screen)
}
</script>

<template>
  <div class="desk">
    <nav class="d-rail" aria-label="Apps">
      <div class="d-logo">E</div>
      <div class="d-rail-sep" />
      <span
        v-for="r in RAIL"
        :key="r.icon"
        class="d-rail-icon"
        :class="{ active: r.ws === workspace }"
      >
        <span :class="r.icon" class="size-5" aria-hidden="true" />
      </span>
      <span class="d-rail-avatar" :title="user">{{ initials }}</span>
    </nav>

    <aside class="d-sidebar">
      <div class="d-ws-head">
        {{ WORKSPACE_LABELS[workspace] }}
        <span class="lucide-chevron-down size-4" aria-hidden="true" />
      </div>
      <div class="d-side-item"><span class="lucide-search size-4" aria-hidden="true" />Search</div>
      <div class="d-side-item"><span class="lucide-bell size-4" aria-hidden="true" />Notification</div>
      <div class="d-side-gap" />
      <button
        v-for="item in items"
        :key="item.label"
        class="d-side-item"
        :class="{ link: item.screen, active: item.screen && item.label === doctype }"
        :data-tour="item.tour"
        :title="item.screen ? undefined : 'Not part of this training'"
        @click="open(item)"
      >
        <span :class="item.icon" class="size-4" aria-hidden="true" />
        {{ item.label }}
        <span v-if="item.more" class="chev lucide-chevron-right size-4" aria-hidden="true" />
      </button>
    </aside>

    <div class="d-page">
      <header class="d-head">
        <div class="d-crumbs">
          <template v-if="props.title">
            <button class="d-crumb" @click="sim.navigate(listScreen)">{{ doctype }}</button>
            <span class="d-crumb" aria-hidden="true">/</span>
            <span class="d-title">{{ props.title }}</span>
          </template>
          <span v-else class="d-title">{{ doctype }}</span>
        </div>
        <span v-if="props.status" class="d-pill" :class="statusColor(props.status)" data-tour="desk.status">
          {{ props.status }}
        </span>
        <div class="d-actions"><slot name="actions" /></div>
      </header>

      <div class="d-body">
        <div class="d-form-col">
          <div v-if="tabs?.length" class="d-tabs" role="tablist">
            <button
              v-for="t in tabs"
              :key="t"
              class="d-tab"
              :class="{ active: activeTab === t }"
              role="tab"
              :aria-selected="activeTab === t"
              :data-tour="`desk.tab:${t}`"
              @click="activeTab = t"
            >
              {{ t }}
            </button>
          </div>
          <main class="d-main"><slot /></main>
        </div>
        <aside v-if="slots.sidebar" class="d-form-sidebar"><slot name="sidebar" /></aside>
      </div>
    </div>

    <slot name="overlay" />
    <SimDialogs />
  </div>
</template>
