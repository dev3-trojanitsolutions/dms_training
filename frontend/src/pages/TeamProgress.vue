<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Badge, Button, ErrorMessage, LoadingIndicator, TextInput } from 'frappe-ui'
import { errorText, getTeamProgress, type TeamRow } from '../api'

/** For trainers: every trainee's best result per scenario. */
const rows = ref<TeamRow[]>([])
const scenarioCount = ref(0)
const loaded = ref(false)
const error = ref('')
const search = ref('')

onMounted(async () => {
  try {
    const data = await getTeamProgress()
    rows.value = data.rows
    scenarioCount.value = data.scenarios.length
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loaded.value = true
  }
})

const people = computed(() => {
  const q = search.value.trim().toLowerCase()
  const byUser = new Map<string, { user: string; full_name: string; rows: TeamRow[] }>()
  for (const row of rows.value) {
    if (q && !`${row.full_name} ${row.user} ${row.scenario}`.toLowerCase().includes(q)) continue
    const entry = byUser.get(row.user) ?? { user: row.user, full_name: row.full_name, rows: [] }
    entry.rows.push(row)
    byUser.set(row.user, entry)
  }
  return [...byUser.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))
})

function passedCount(list: TeamRow[]) {
  return list.filter((r) => r.passed).length
}

function formatWhen(value: string) {
  return value ? new Date(value.replace(' ', 'T')).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header class="mb-6 flex flex-wrap items-center gap-3">
        <Button icon="lucide-arrow-left" variant="ghost" tooltip="Back to Training" route="/" />
        <div class="flex-1">
          <h1 class="text-2xl font-bold">Team progress</h1>
          <p class="text-ink-gray-5">Best result for each trainee and scenario.</p>
        </div>
        <TextInput v-model="search" placeholder="Search people or scenarios" class="w-64" />
      </header>

      <ErrorMessage v-if="error" :message="error" />
      <div v-else-if="!loaded" class="flex justify-center py-16"><LoadingIndicator class="size-6" /></div>
      <p v-else-if="!people.length" class="text-ink-gray-5">No training attempts yet.</p>

      <section
        v-for="person in people"
        :key="person.user"
        class="mb-4 overflow-hidden rounded-6 border border-outline-gray-2"
      >
        <div class="flex items-center justify-between gap-3 bg-surface-gray-1 px-4 py-2">
          <div>
            <div class="font-semibold">{{ person.full_name }}</div>
            <div class="text-xs text-ink-gray-5">{{ person.user }}</div>
          </div>
          <span class="text-sm text-ink-gray-6">
            {{ passedCount(person.rows) }} of {{ scenarioCount }} scenarios passed
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-ink-gray-5">
              <tr>
                <th class="px-4 py-2 font-medium">Scenario</th>
                <th class="px-4 py-2 font-medium">Track</th>
                <th class="px-4 py-2 font-medium">Best score</th>
                <th class="px-4 py-2 font-medium">Attempts</th>
                <th class="px-4 py-2 font-medium">Last attempt</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in person.rows" :key="row.scenario" class="border-t border-outline-gray-1">
                <td class="px-4 py-2">{{ row.scenario }}</td>
                <td class="px-4 py-2 text-ink-gray-6">{{ row.track }}</td>
                <td class="px-4 py-2">
                  <Badge
                    :label="row.passed ? `Passed · ${row.best_score}` : row.best_score ? String(row.best_score) : row.last_status"
                    :theme="row.passed ? 'green' : row.best_score ? 'amber' : 'gray'"
                  />
                </td>
                <td class="px-4 py-2">{{ row.attempts }}</td>
                <td class="whitespace-nowrap px-4 py-2 text-ink-gray-6">{{ formatWhen(row.last_on) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>
