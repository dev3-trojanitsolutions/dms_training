<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, Dialog, ErrorMessage, LoadingIndicator, TabButtons } from 'frappe-ui'
import { errorText, getScenario, saveProgress, type ProgressResult } from '../api'
import type { Mode, Scenario } from '../engine/types'
import { reloadIfStale } from '../appBuild'
import ScenarioRunner from './ScenarioRunner.vue'

const props = defineProps<{ name: string }>()
const route = useRoute()
const router = useRouter()

const scenario = ref<Scenario | null>(null)
const loadError = ref('')
const attempt = ref(0)
const resultOpen = ref(false)
const result = ref<{ score: number; hints: number; mistakes: number; seconds: number } | null>(null)
const saved = ref<ProgressResult | null>(null)
const saveError = ref('')

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  Watch: 'The simulator does every step while you watch.',
  Guided: 'You do each step. The next thing to click is highlighted.',
  Practice: 'No highlights. Use a hint if you get stuck, but it costs points.',
}

const mode = computed<Mode>(() => {
  const modes = scenario.value?.modes ?? ['Guided']
  const wanted = String(route.query.mode ?? '').toLowerCase()
  return modes.find((m) => m.toLowerCase() === wanted) ?? (modes.includes('Guided') ? 'Guided' : modes[0])
})

const modeTabs = computed(() => (scenario.value?.modes ?? []).map((m) => ({ label: m, value: m })))

async function load() {
  scenario.value = null
  loadError.value = ''
  try {
    const loaded = await getScenario(props.name)
    if (reloadIfStale(loaded.app_build)) return
    scenario.value = loaded
  } catch (error) {
    loadError.value = errorText(error)
  }
}

watch(() => props.name, load, { immediate: true })

function restart() {
  resultOpen.value = false
  result.value = null
  saved.value = null
  attempt.value += 1
}

function setMode(next: string | number | undefined) {
  if (next === mode.value) return
  void router.replace({ query: { mode: String(next).toLowerCase() } })
  restart()
}

async function onFinished(r: { score: number; hints: number; mistakes: number; seconds: number }) {
  result.value = r
  resultOpen.value = true
  saveError.value = ''
  try {
    saved.value = await saveProgress({
      scenario: props.name,
      mode: mode.value,
      score: r.score,
      hints_used: r.hints,
      mistakes: r.mistakes,
      time_taken: r.seconds,
    })
  } catch (error) {
    saveError.value = errorText(error)
  }
}

const passed = computed(() => (result.value?.score ?? 0) >= (scenario.value?.passing_score ?? 70))

const resultTitle = computed(() => {
  if (mode.value === 'Watch') return 'Walkthrough finished'
  return passed.value ? 'Scenario passed' : 'Needs more practice'
})

function formatSeconds(s: number) {
  const m = Math.floor(s / 60)
  return m ? `${m} min ${s % 60} s` : `${s} s`
}

function goNext() {
  const next = scenario.value?.next_scenario
  if (!next) return
  resultOpen.value = false
  void router.push({ path: `/s/${encodeURIComponent(next)}`, query: { mode: mode.value.toLowerCase() } })
  attempt.value += 1
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex flex-wrap items-center gap-3 border-b border-outline-gray-2 px-4 py-2">
      <Button icon="lucide-arrow-left" variant="ghost" tooltip="Back to Training" route="/" />
      <div class="min-w-0 flex-1">
        <div class="truncate font-semibold">{{ scenario?.title ?? 'Loading…' }}</div>
        <div class="truncate text-xs text-ink-gray-5">
          {{ scenario?.track }} · Training sandbox: nothing here is saved to ERPNext
        </div>
      </div>
      <TabButtons
        v-if="modeTabs.length > 1"
        :options="modeTabs"
        :model-value="mode"
        @update:model-value="setMode"
      />
      <Badge v-else-if="scenario" :label="mode" />
      <Button label="Restart" icon-left="lucide-rotate-ccw" :disabled="!scenario" @click="restart" />
    </header>

    <div v-if="loadError" class="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <ErrorMessage :message="loadError" />
      <Button label="Back to Training" route="/" />
    </div>
    <div v-else-if="!scenario" class="flex flex-1 items-center justify-center">
      <LoadingIndicator class="size-6" />
    </div>
    <div v-else class="relative min-h-0 flex-1">
      <ScenarioRunner :key="`${attempt}-${mode}`" :scenario="scenario" :mode="mode" @finished="onFinished" />
    </div>

    <Dialog
      v-model:open="resultOpen"
      :title="resultTitle"
      :icon="mode === 'Watch' ? 'lucide-eye' : passed ? 'lucide-badge-check' : 'lucide-refresh-cw'"
      :theme="mode === 'Watch' ? 'blue' : passed ? 'green' : 'amber'"
    >
      <div v-if="result" class="space-y-3 text-base">
        <p v-if="mode === 'Watch'">
          You watched every step. Try it yourself in Guided mode, then prove it in Practice mode.
        </p>
        <template v-else>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold">{{ result.score }}</span>
            <span class="text-ink-gray-5">/ 100, pass mark {{ scenario?.passing_score }}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-sm">
            <div class="rounded-4 bg-surface-gray-2 p-2">
              <div class="text-ink-gray-5">Mistakes</div>
              <div class="font-semibold">{{ result.mistakes }}</div>
            </div>
            <div class="rounded-4 bg-surface-gray-2 p-2">
              <div class="text-ink-gray-5">Hints</div>
              <div class="font-semibold">{{ result.hints }}</div>
            </div>
            <div class="rounded-4 bg-surface-gray-2 p-2">
              <div class="text-ink-gray-5">Time</div>
              <div class="font-semibold">{{ formatSeconds(result.seconds) }}</div>
            </div>
          </div>
        </template>
        <p class="text-sm text-ink-gray-5">{{ MODE_DESCRIPTIONS[mode] }}</p>
        <ErrorMessage v-if="saveError" :message="`Your result wasn't saved: ${saveError}`" />
        <p v-else-if="saved" class="text-sm text-ink-gray-5">Result saved.</p>
      </div>
      <template #actions>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <Button label="Back to Training" route="/" />
          <Button label="Try again" icon-left="lucide-rotate-ccw" @click="restart" />
          <Button
            v-if="scenario?.next_scenario"
            label="Next scenario"
            variant="solid"
            icon-right="lucide-arrow-right"
            @click="goNext"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>
