<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Badge, Button, ErrorMessage, LoadingIndicator, useColorScheme } from 'frappe-ui'
import { errorText, getHome } from '../api'
import { reloadIfStale } from '../appBuild'
import type { HomeData, Mode, ScenarioSummary } from '../engine/types'

const data = ref<HomeData | null>(null)
const error = ref('')
const { resolvedColorScheme, toggleColorScheme } = useColorScheme()

onMounted(async () => {
  try {
    const home = await getHome()
    if (reloadIfStale(home.app_build)) return
    data.value = home
  } catch (e) {
    error.value = errorText(e)
  }
})

const MODE_ICONS: Record<Mode, string> = {
  Watch: 'lucide-play',
  Guided: 'lucide-mouse-pointer-click',
  Practice: 'lucide-target',
}

function status(s: ScenarioSummary): { label: string; theme: 'green' | 'amber' | 'blue' | 'gray' } {
  if (s.best?.passed) return { label: `Passed · ${s.best.score}`, theme: 'green' }
  if (s.best && s.best.score > 0) return { label: `Best ${s.best.score}`, theme: 'amber' }
  if (s.best?.watched) return { label: 'Watched', theme: 'blue' }
  return { label: 'Not started', theme: 'gray' }
}

function progress(scenarios: ScenarioSummary[]) {
  const passed = scenarios.filter((s) => s.best?.passed).length
  return `${passed} of ${scenarios.length} passed`
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header class="mb-6 flex flex-wrap items-center gap-3">
        <div class="flex-1">
          <h1 class="text-2xl font-bold">Training</h1>
          <p class="text-ink-gray-5">
            Practise the DMS sales cycle in a safe copy of the system. Nothing you do here touches real orders.
          </p>
        </div>
        <Button v-if="data?.is_trainer" label="Team progress" icon-left="lucide-users" route="/team" />
        <Button
          :icon="resolvedColorScheme === 'dark' ? 'lucide-sun' : 'lucide-moon'"
          variant="ghost"
          :tooltip="resolvedColorScheme === 'dark' ? 'Light mode' : 'Dark mode'"
          @click="toggleColorScheme()"
        />
        <Button label="Back to System" icon-left="lucide-arrow-left" href="/desk" />
      </header>

      <ErrorMessage v-if="error" :message="error" />
      <div v-else-if="!data" class="flex justify-center py-16"><LoadingIndicator class="size-6" /></div>

      <div v-else-if="!data.tracks.length" class="rounded-6 border border-outline-gray-2 p-8 text-center">
        <p class="font-semibold">No training for your role yet</p>
        <p class="mt-1 text-ink-gray-5">
          Ask your manager to add your role to a Training Track.
        </p>
      </div>

      <section v-for="track in data?.tracks ?? []" :key="track.name" class="mb-8">
        <div class="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 class="flex items-center gap-2 text-lg font-semibold">
              <span class="lucide-graduation-cap size-5" aria-hidden="true" />
              {{ track.title }}
            </h2>
            <p v-if="track.description" class="text-sm text-ink-gray-5">{{ track.description }}</p>
          </div>
          <span v-if="track.scenarios.length" class="whitespace-nowrap text-sm text-ink-gray-5">
            {{ progress(track.scenarios) }}
          </span>
        </div>

        <p v-if="!track.scenarios.length" class="text-sm text-ink-gray-5">No scenarios in this track yet.</p>

        <div class="grid gap-3 sm:grid-cols-2">
          <article
            v-for="(s, i) in track.scenarios"
            :key="s.name"
            class="flex flex-col rounded-6 border border-outline-gray-2 bg-surface-elevation-1 p-4"
          >
            <div class="mb-1 flex items-start justify-between gap-2">
              <h3 class="font-semibold">{{ i + 1 }}. {{ s.title }}</h3>
              <Badge :label="status(s).label" :theme="status(s).theme" />
            </div>
            <p class="mb-3 flex-1 text-sm text-ink-gray-6">{{ s.description }}</p>
            <div class="flex flex-wrap items-center gap-2">
              <Badge :label="s.difficulty" variant="outline" />
              <div class="ml-auto flex flex-wrap gap-2">
                <Button
                  v-for="mode in s.modes"
                  :key="mode"
                  :label="mode"
                  :icon-left="MODE_ICONS[mode]"
                  :variant="mode === 'Guided' ? 'solid' : 'subtle'"
                  :route="{ path: `/s/${encodeURIComponent(s.name)}`, query: { mode: mode.toLowerCase() } }"
                />
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
