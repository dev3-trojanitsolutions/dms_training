<script setup lang="ts">
import { useSim } from '../../engine/sim'
import SimDialogs from '../SimDialogs.vue'
import './delivery.css'

/** Sidebar and dialogs shared by the delivery partner portal pages. */
defineProps<{ active: string }>()
const sim = useSim()

const links = [
  { key: 'home', label: 'Dashboard', screen: 'delivery.home', icon: 'lucide-house' },
  { key: 'assign', label: 'Delivery Assign', screen: 'delivery.assign', icon: 'lucide-user-check' },
  { key: 'pending', label: 'Pending Deliveries', screen: 'delivery.pending', icon: 'lucide-package' },
  { key: 'completed', label: 'Completed Deliveries', screen: 'delivery.completed', icon: 'lucide-circle-check' },
]
</script>

<template>
  <div class="dportal">
    <aside class="dl-sidebar">
      <div class="dl-brand">Luxury Stationery</div>
      <button
        v-for="link in links"
        :key="link.key"
        class="dl-nav"
        :class="{ active: active === link.key }"
        :data-tour="`dnav.${link.key}`"
        @click="sim.navigate(link.screen)"
      >
        <span :class="link.icon" class="size-5" aria-hidden="true" />
        <span>{{ link.label }}</span>
      </button>
      <button class="dl-nav muted" title="Not part of this training">
        <span class="lucide-user size-5" aria-hidden="true" />
        <span>Profile</span>
      </button>
      <div class="dl-sidebar-foot">
        Signed in as
        <b>{{ sim.state.settings.partner_name }}</b>
      </div>
    </aside>
    <main class="dl-main">
      <div class="dl-wrap"><slot /></div>
    </main>
    <SimDialogs />
  </div>
</template>
