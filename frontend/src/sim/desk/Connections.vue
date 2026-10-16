<script setup lang="ts">
import { statusColor } from './indicator'

/** The Connections tab: linked documents grouped like the doctype's dashboard. */
defineProps<{
  groups: {
    label: string
    items: { doctype: string; docs: { name: string; status: string; tour?: string; open?: () => void }[] }[]
  }[]
}>()
</script>

<template>
  <div class="d-section" style="border-bottom: none">
    <div class="d-section-inner">
      <div class="d-conn">
        <div v-for="g in groups" :key="g.label" class="d-conn-group">
          <h4>{{ g.label }}</h4>
          <template v-for="it in g.items" :key="it.doctype">
            <div class="d-conn-item">
              <span v-if="it.docs.length" class="d-conn-count">{{ it.docs.length }}</span>
              {{ it.doctype }}
            </div>
            <div v-for="d in it.docs" :key="d.name" class="d-conn-item" style="padding-left: 24px">
              <button class="d-conn-link" :data-tour="d.tour" @click="d.open?.()">{{ d.name }}</button>
              <span class="d-pill" :class="statusColor(d.status)">{{ d.status }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
