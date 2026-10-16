<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button } from 'frappe-ui'
import type { ScenarioRun } from '../engine/useScenario'
import { screenLabel } from '../sim/registry'

const props = defineProps<{ run: ScenarioRun }>()

const CARD_WIDTH = 340
const GAP = 14
const MARGIN = 12

const rect = ref<DOMRect | null>(null)
const card = ref<HTMLElement | null>(null)
const cardPos = ref<{ top: number; left: number } | null>(null)
const pulsing = ref(false)
let frame = 0

const step = computed(() => props.run.step.value)
const isObserve = computed(() => step.value?.action_type === 'Observe')
const mode = props.run.mode

// Follow the target every frame: screens scroll, dialogs open, panels resize.
function track() {
  const el = props.run.findTarget()
  const next = el ? el.getBoundingClientRect() : null
  rect.value = next && next.width + next.height > 0 ? next : null
  placeCard()
  frame = requestAnimationFrame(track)
}

function placeCard() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const h = card.value?.offsetHeight ?? 200
  const w = Math.min(CARD_WIDTH, vw - MARGIN * 2)
  const r = rect.value
  if (vw < 640) {
    cardPos.value = null
    return
  }
  if (!r || !props.run.showSpotlight.value) {
    cardPos.value = cornerAwayFrom(r, w, h, vw, vh)
    return
  }
  const clampLeft = (x: number) => Math.min(Math.max(x, MARGIN), vw - w - MARGIN)
  const clampTop = (y: number) => Math.min(Math.max(y, MARGIN), vh - h - MARGIN)
  if (r.bottom + GAP + h < vh - MARGIN) {
    cardPos.value = { top: r.bottom + GAP, left: clampLeft(r.left) }
  } else if (r.top - GAP - h > MARGIN) {
    cardPos.value = { top: r.top - GAP - h, left: clampLeft(r.left) }
  } else if (r.right + GAP + w < vw - MARGIN) {
    cardPos.value = { top: clampTop(r.top), left: r.right + GAP }
  } else if (r.left - GAP - w > MARGIN) {
    cardPos.value = { top: clampTop(r.top), left: r.left - GAP - w }
  } else {
    cardPos.value = cornerAwayFrom(r, w, h, vw, vh)
  }
}

/** A screen corner for the card that doesn't cover the element the step needs. */
function cornerAwayFrom(r: DOMRect | null, w: number, h: number, vw: number, vh: number) {
  const corners = [
    { top: vh - h - MARGIN, left: vw - w - MARGIN },
    { top: vh - h - MARGIN, left: MARGIN },
    { top: MARGIN + 56, left: vw - w - MARGIN },
    { top: MARGIN + 56, left: MARGIN },
  ]
  if (!r) return corners[0]
  const overlaps = (c: { top: number; left: number }) =>
    c.left < r.right + GAP && c.left + w > r.left - GAP && c.top < r.bottom + GAP && c.top + h > r.top - GAP
  return corners.find((c) => !overlaps(c)) ?? corners[0]
}

watch(
  () => props.run.pulse.value,
  () => {
    pulsing.value = false
    requestAnimationFrame(() => (pulsing.value = true))
  },
)

onMounted(() => (frame = requestAnimationFrame(track)))
onBeforeUnmount(() => cancelAnimationFrame(frame))

const spotlightStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  const pad = 6
  return {
    top: `${r.top - pad}px`,
    left: `${r.left - pad}px`,
    width: `${r.width + pad * 2}px`,
    height: `${r.height + pad * 2}px`,
  }
})

const cardStyle = computed(() =>
  cardPos.value
    ? { top: `${cardPos.value.top}px`, left: `${cardPos.value.left}px`, width: `${CARD_WIDTH}px` }
    : {},
)
</script>

<template>
  <div v-if="step" class="pointer-events-none fixed inset-0 z-[60]">
    <div
      v-if="run.showSpotlight.value && rect"
      class="coach-spotlight"
      :class="{ 'coach-pulse': pulsing }"
      :style="spotlightStyle"
      @animationend="pulsing = false"
    />

    <div
      ref="card"
      class="pointer-events-auto fixed rounded-7 border border-outline-gray-2 bg-surface-elevation-2 p-4 text-ink-gray-8 shadow-2xl"
      :class="cardPos ? '' : 'coach-card-docked'"
      :style="cardStyle"
      role="dialog"
      aria-live="polite"
    >
      <div class="mb-1 flex items-center justify-between text-xs text-ink-gray-5">
        <span>Step {{ run.index.value + 1 }} of {{ run.total }}</span>
        <span>{{ mode }}</span>
      </div>
      <div class="mb-3 h-1 overflow-hidden rounded-4 bg-surface-gray-2">
        <div
          class="h-full rounded-4 bg-surface-gray-7 transition-all"
          :style="{ width: `${((run.index.value + 1) / run.total) * 100}%` }"
        />
      </div>

      <h3 class="mb-1 text-base font-semibold">{{ step.title }}</h3>
      <div v-if="step.body" class="coach-body text-sm leading-relaxed text-ink-gray-7" v-html="step.body" />

      <p
        v-if="run.showHint.value && step.hint"
        class="mt-2 rounded-4 bg-surface-amber-2 px-2 py-1.5 text-sm text-ink-amber-8"
      >
        {{ step.hint }}
      </p>

      <div
        v-if="run.onWrongScreen.value"
        class="mt-2 rounded-4 bg-surface-gray-2 px-2 py-1.5 text-sm text-ink-gray-7"
      >
        This step is on <b>{{ screenLabel(step.screen) }}</b>.
        <button class="ml-1 underline" @click="run.goToStepScreen()">Take me there</button>
      </div>

      <div class="mt-4 flex items-center justify-end gap-2">
        <template v-if="mode === 'Watch'">
          <Button
            :label="run.paused.value ? 'Resume' : 'Pause'"
            :icon-left="run.paused.value ? 'lucide-play' : 'lucide-pause'"
            @click="run.togglePause()"
          />
          <Button v-if="run.paused.value" label="Next" variant="solid" @click="run.next()" />
        </template>
        <template v-else>
          <Button
            v-if="!isObserve && mode === 'Guided'"
            label="Show me"
            icon-left="lucide-wand-sparkles"
            @click="run.useHint()"
          />
          <Button
            v-if="!isObserve && mode === 'Practice'"
            label="Hint"
            icon-left="lucide-lightbulb"
            @click="run.useHint()"
          />
          <Button v-if="isObserve" label="Next" variant="solid" icon-right="lucide-arrow-right" @click="run.next()" />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.coach-spotlight {
  position: fixed;
  border-radius: 10px;
  box-shadow:
    0 0 0 3px rgb(59 130 246 / 0.9),
    0 0 0 9999px rgb(15 15 15 / 0.42);
  transition:
    top 0.18s ease,
    left 0.18s ease,
    width 0.18s ease,
    height 0.18s ease;
}
.coach-pulse {
  animation: coach-pulse 0.5s ease 2;
}
@keyframes coach-pulse {
  50% {
    box-shadow:
      0 0 0 7px rgb(59 130 246 / 0.9),
      0 0 0 9999px rgb(15 15 15 / 0.5);
  }
}
.coach-card-docked {
  right: 16px;
  bottom: 16px;
  width: min(340px, calc(100vw - 32px));
}
.coach-body :deep(p) {
  margin: 0 0 0.4em;
}
.coach-body :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
