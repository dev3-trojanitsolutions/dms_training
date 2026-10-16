<script setup lang="ts">
import { provide, ref, watch } from 'vue'
import { Button } from 'frappe-ui'
import CoachOverlay from '../coach/CoachOverlay.vue'
import { createSim, SIM_KEY } from '../engine/sim'
import type { Mode, Scenario } from '../engine/types'
import { useScenario } from '../engine/useScenario'
import { screenComponents, screenLabel } from '../sim/registry'

/**
 * One attempt at a scenario: a fresh simulator, the screen it is on, and the
 * coach. The parent remounts this component to restart.
 */
const props = defineProps<{ scenario: Scenario; mode: Mode }>()
const emit = defineEmits<{
  finished: [result: { score: number; hints: number; mistakes: number; seconds: number }]
}>()

const sim = createSim(props.scenario.seed_data)
provide(SIM_KEY, sim)

const root = ref<HTMLElement | null>(null)
const reload = () => window.location.reload()
const run = useScenario(props.scenario, props.mode, sim, root)

watch(run.finished, (done) => {
  if (!done) return
  emit('finished', {
    score: run.score.value,
    hints: run.hints.value,
    mistakes: run.mistakes.value,
    seconds: run.elapsedSeconds(),
  })
})
</script>

<template>
  <div ref="root" class="relative h-full overflow-hidden">
    <component :is="screenComponents[sim.state.screen]" v-if="screenComponents[sim.state.screen]" />
    <div v-else class="flex h-full flex-col items-center justify-center gap-3 text-ink-gray-6">
      <p>{{ screenLabel(sim.state.screen) }} isn't in this version of the training app.</p>
      <p class="text-sm text-ink-gray-5">The app was updated after this page was opened.</p>
      <Button label="Reload" variant="solid" icon-left="lucide-rotate-ccw" @click="reload" />
    </div>
  </div>
  <CoachOverlay v-if="!run.finished.value" :run="run" />
</template>
