<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSim } from '../../engine/sim'

/**
 * SearchPicker.vue: a Combobox over search_customers. Typing narrows the list,
 * picking one sets the filter, and the × clears it.
 */
const props = defineProps<{ name: string; label: string; placeholder: string; tour: string }>()
const model = defineModel<string>({ default: '' })

const sim = useSim()
const query = ref('')
const open = computed(() => sim.state.ui.dms_picker === props.name)
const picked = computed(() => sim.customer(model.value))

const options = computed(() => {
  const q = query.value.trim().toLowerCase()
  return sim.state.customers
    .filter((c) => !q || c.customer_name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    .slice(0, 20)
})

function toggle() {
  query.value = ''
  sim.toggleDmsPicker(props.name)
}

function pick(name: string) {
  model.value = name
  sim.state.ui.dms_picker = ''
}

function clear() {
  model.value = ''
  query.value = ''
}
</script>

<template>
  <div class="relative flex items-end gap-1">
    <div class="w-56">
      <span class="dms-label">{{ label }}</span>
      <input
        v-if="open"
        v-model="query"
        class="dms-input"
        :placeholder="placeholder"
        :data-tour="tour"
        :aria-label="label"
        autocomplete="off"
        @keydown.escape="sim.state.ui.dms_picker = ''"
      />
      <button
        v-else
        class="dms-input flex items-center justify-between text-left"
        :data-tour="tour"
        :aria-label="label"
        @click="toggle"
      >
        <span :class="picked ? '' : 'text-ink-gray-4'" class="truncate">{{ picked?.customer_name ?? placeholder }}</span>
        <span class="lucide-chevron-down size-4 text-ink-gray-5" aria-hidden="true" />
      </button>
    </div>
    <button v-if="model" class="dms-btn !bg-transparent px-1.5" :aria-label="`Clear ${label}`" :data-tour="`${tour}_clear`" @click="clear">
      <span class="lucide-x size-4" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      class="absolute left-0 top-full z-20 mt-1 max-h-64 w-72 overflow-y-auto rounded-6 border border-outline-gray-1 bg-surface-elevation-1 p-1.5 shadow-xl"
      role="listbox"
    >
      <button
        v-for="c in options"
        :key="c.name"
        class="flex w-full flex-col rounded-4 px-2 py-1.5 text-left hover:bg-surface-gray-3"
        role="option"
        :data-tour="`dms.pick:${c.name}`"
        @click="pick(c.name)"
      >
        <span class="text-sm text-ink-gray-8">{{ c.customer_name }}</span>
        <span class="text-xs text-ink-gray-5">{{ c.name }}</span>
      </button>
      <div v-if="!options.length" class="px-2 py-1.5 text-sm text-ink-gray-5">No results found</div>
    </div>
  </div>
</template>
