<script setup lang="ts">
import { useSim } from '../../engine/sim'
import SimDialogs from '../SimDialogs.vue'

/** The `/dms` app frame: AppSidebar.vue and the page header of each report. */
defineProps<{ active: string; title: string }>()

const sim = useSim()

const LINKS = [
  { key: 'desk', label: 'Back to System', icon: 'lucide-arrow-left', screen: '' },
  { key: 'checkin', label: 'Employee Checkin Record', icon: 'lucide-user-check', screen: '' },
  { key: 'availability', label: 'Sales Order Overview', icon: 'lucide-package-search', screen: '' },
  { key: 'customer_balance', label: 'Customer Balance', icon: 'lucide-wallet', screen: 'dms.customer_balance' },
  { key: 'so_status', label: 'Sales Order Status', icon: 'lucide-clipboard-list', screen: 'dms.so_status' },
]

function go(link: (typeof LINKS)[number]) {
  sim.state.ui.dms_picker = ''
  if (link.screen) sim.navigate(link.screen)
}
</script>

<template>
  <div class="dms relative flex h-full bg-surface-base text-ink-gray-8">
    <aside class="flex w-56 shrink-0 flex-col bg-surface-sidebar px-2" aria-label="DMS">
      <div class="flex h-12 shrink-0 items-center px-1">
        <div class="truncate text-base font-medium leading-tight text-ink-gray-8">DMS</div>
      </div>
      <div class="flex-1 space-y-0.5 overflow-y-auto">
        <button
          v-for="link in LINKS"
          :key="link.key"
          class="flex h-7 w-full items-center gap-2 rounded-4 px-2 text-left text-sm transition"
          :class="
            link.key === active
              ? 'bg-surface-elevation-3 text-ink-gray-8 shadow-sm'
              : 'text-ink-gray-6 hover:bg-surface-gray-2'
          "
          :data-tour="`dms.nav.${link.key}`"
          :title="link.screen ? undefined : 'Not part of this training'"
          @click="go(link)"
        >
          <span :class="link.icon" class="size-4 shrink-0 text-ink-gray-6" aria-hidden="true" />
          <span class="truncate">{{ link.label }}</span>
        </button>
      </div>
      <div class="mb-2 flex items-center gap-2 rounded-4 px-2 py-1.5 text-sm text-ink-gray-6">
        <span class="lucide-moon size-4" aria-hidden="true" />Dark Mode
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex min-h-12 items-center border-b bg-surface-base px-3 sm:px-5">
        <h1 class="text-lg font-semibold text-ink-gray-8">{{ title }}</h1>
      </header>
      <main class="dms-main min-h-0 flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>

    <slot name="overlay" />
    <SimDialogs />
  </div>
</template>

<style>
/* The frappe-ui TextInput, Select, Checkbox and Button looks, as plain elements the coach can point at. */
.dms-input {
  @apply h-7 w-full rounded-4 border border-[--surface-gray-2] bg-surface-gray-2 px-2 text-base leading-tighter text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-elevation-2 hover:bg-surface-gray-3 focus:border-outline-gray-4 focus:bg-surface-base focus:shadow-sm focus:outline-none focus:ring-0 dark:[color-scheme:dark];
}
.dms-label {
  @apply mb-1.5 block text-xs text-ink-gray-5;
}
.dms-check {
  @apply inline-flex cursor-pointer items-center gap-2 text-base text-ink-gray-8;
}
.dms-check input {
  @apply size-3.5 rounded-1;
  accent-color: currentColor;
}
.dms-btn {
  @apply inline-flex h-7 items-center gap-1.5 rounded-4 bg-surface-gray-2 px-2.5 text-base text-ink-gray-8 transition-colors hover:bg-surface-gray-3 active:bg-surface-gray-4;
}
.dms-btn.solid {
  @apply bg-surface-gray-10 text-ink-base hover:bg-surface-gray-9;
}
</style>
