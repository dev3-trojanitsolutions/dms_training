import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { resolveDate } from './dates'
import { getPath, matches } from './expect'
import type { Sim } from './sim'
import type { Mode, Scenario, Step } from './types'

const WATCH_READ_MS = 1800
const WATCH_OBSERVE_MS = 4000
const WATCH_STUCK_MS = 4000
const TYPING_SETTLE_MS = 600
const BLOCKING_ALERTS = new Set(['validation', 'credit', 'stock'])

/** `desk.so_form` → `desk`. Screens of one app are used by the same person. */
const appOf = (screen: string) => screen.split('.')[0]

/**
 * Runs a scenario's steps against the simulator.
 *
 * It listens to clicks and inputs on the simulator root, so the screens don't
 * need to report anything: a step is done when its target was used and its
 * Expected Field matches. In Guided mode, clicks outside the target are
 * blocked and counted as mistakes. Watch mode performs each step itself.
 */
export function useScenario(scenario: Scenario, mode: Mode, sim: Sim, root: Ref<HTMLElement | null>) {
  const index = ref(0)
  const finished = ref(false)
  const hints = ref(0)
  const mistakes = ref(0)
  const pulse = ref(0)
  const paused = ref(false)
  const hintRevealed = ref(false)
  const startedAt = Date.now()
  let finishedAt = 0

  // Per-step state; reset in enterStep().
  let interacted = false
  let satisfiedAtStart = false
  let lastMistakeAt = 0
  let typingTimer: number | undefined
  let watchTimer: number | undefined

  const step = computed<Step | undefined>(() => scenario.steps[index.value])
  const total = scenario.steps.length

  /** The target with `@last_so` / `@last_si` filled in from the simulator. */
  const target = computed(() =>
    (step.value?.target ?? '')
      .replace('@last_so', sim.state.last.so)
      .replace('@last_si', sim.state.last.si),
  )

  const showSpotlight = computed(() => mode !== 'Practice' || hintRevealed.value)
  const showHint = computed(() => mode === 'Guided' || hintRevealed.value)
  const onWrongScreen = computed(() => !!step.value && sim.state.screen !== step.value.screen)

  const score = computed(() => {
    if (mode === 'Watch') return 0
    const hintCost = mode === 'Practice' ? 15 : 10
    return Math.max(0, 100 - mistakes.value * 5 - hints.value * hintCost)
  })

  function elapsedSeconds() {
    return Math.round(((finishedAt || Date.now()) - startedAt) / 1000)
  }

  function findTarget(): HTMLElement | null {
    if (!root.value || !target.value) return null
    return root.value.querySelector<HTMLElement>(`[data-tour="${CSS.escape(target.value)}"]`)
  }

  function isSatisfied(): boolean {
    const s = step.value
    if (!s?.expected_field) return true
    return matches(getPath(sim.context(), s.expected_field), s.expected_value)
  }

  // ── Step lifecycle ──────────────────────────────────────────────

  function enterStep() {
    const s = step.value
    if (!s) return
    interacted = false
    hintRevealed.value = false
    satisfiedAtStart = !!s.expected_field && isSatisfied()
    clearTimeout(typingTimer)
    // The first step, and a step in another app (portal → Desk is a different
    // person at work), start on their own screen. Within an app the trainee navigates.
    if (sim.state.screen !== s.screen && (index.value === 0 || appOf(sim.state.screen) !== appOf(s.screen)))
      sim.navigate(s.screen)
    if (mode !== 'Practice') scrollTargetIntoView()
    if (mode === 'Watch') scheduleWatch()
    if (satisfiedAtStart) skipIfAlreadyDone()
  }

  /**
   * The trainee may already be where this step leads, by another route (for
   * example Connections ▸ Sales Order instead of the list). Then the step's
   * target isn't on screen and there is nothing left to do: move on.
   */
  function skipIfAlreadyDone() {
    const current = index.value
    window.setTimeout(() => {
      if (index.value === current && !finished.value && isSatisfied() && !findTarget()) advance()
    }, 400)
  }

  function advance() {
    if (finished.value) return
    clearTimeout(watchTimer)
    if (index.value + 1 >= total) {
      finishedAt = Date.now()
      finished.value = true
      return
    }
    index.value += 1
    enterStep()
  }

  function tryComplete() {
    const s = step.value
    if (!s || finished.value || s.action_type === 'Observe') return
    if (s.expected_field) {
      if (!isSatisfied()) return
      // A value that was already right when the step began only counts once the trainee acts.
      if (satisfiedAtStart && !interacted) return
      advance()
    } else if (interacted) {
      advance()
    }
  }

  /** Observe steps, and the Next button. */
  function next() {
    advance()
  }

  // ── Events from the simulator ───────────────────────────────────

  function onSimEvent(event: Event) {
    const s = step.value
    if (!s || finished.value) return
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tour]')
    if (!el || el.dataset.tour !== target.value) return

    const type = event.type
    if (s.action_type === 'Click' && type === 'click') interacted = true
    else if (s.action_type === 'Select Option' && type === 'change') interacted = true
    else if (s.action_type === 'Enter Value' && (type === 'input' || type === 'change')) {
      if (!s.expected_field) {
        // No value to check: wait until the trainee stops typing something.
        clearTimeout(typingTimer)
        const value = (el as HTMLInputElement).value
        typingTimer = window.setTimeout(() => {
          interacted = !!value
          tryComplete()
        }, TYPING_SETTLE_MS)
        return
      }
      interacted = true
    } else return

    // Let the screen's own handler (and any dialog it opens) run first.
    window.setTimeout(tryComplete, 60)
  }

  /** Guided mode: only the highlighted element can be used. */
  function onCapture(event: Event) {
    if (mode !== 'Guided' || finished.value || paused.value) return
    const el = findTarget()
    if (el && el.contains(event.target as Node)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.type !== 'click') return
    pulse.value += 1
    const now = Date.now()
    if (step.value?.action_type !== 'Observe' && el && now - lastMistakeAt > 600) {
      lastMistakeAt = now
      mistakes.value += 1
    }
  }

  // Unplanned errors (submitting without a warehouse, over credit, short of
  // stock) count as mistakes, unless the step is about that very error.
  watch(
    () => sim.state.alert.open,
    (open) => {
      if (!open || mode === 'Watch' || finished.value) return
      const kind = sim.state.alert.kind
      const expected = (step.value?.expected_value ?? '').toLowerCase()
      if (BLOCKING_ALERTS.has(kind) && expected !== kind) mistakes.value += 1
    },
  )

  watch(
    () => sim.state.toast.open && sim.state.toast.error,
    (error) => {
      if (!error || mode === 'Watch' || finished.value) return
      if ((step.value?.expected_value ?? '') !== sim.state.toast.code) mistakes.value += 1
    },
  )

  // Steps can also finish when the expected value turns true by another route,
  // for example opening Customers from a quick action instead of the sidebar.
  watch(
    () => (step.value?.expected_field ? isSatisfied() : false),
    (ok) => {
      if (ok) window.setTimeout(tryComplete, 60)
    },
  )

  // ── Help ────────────────────────────────────────────────────────

  /** Guided: do the step for the trainee. Practice: show the highlight and hint. */
  function useHint() {
    hints.value += 1
    if (mode === 'Practice' && !hintRevealed.value) {
      hintRevealed.value = true
      scrollTargetIntoView()
      return
    }
    void perform()
  }

  function goToStepScreen() {
    if (!step.value) return
    hints.value += 1
    sim.navigate(step.value.screen)
  }

  // ── Watch mode ──────────────────────────────────────────────────

  function scheduleWatch() {
    clearTimeout(watchTimer)
    if (paused.value || finished.value) return
    const s = step.value
    if (!s) return
    const current = index.value
    if (s.action_type === 'Observe') {
      watchTimer = window.setTimeout(advance, WATCH_OBSERVE_MS)
      return
    }
    watchTimer = window.setTimeout(async () => {
      await perform()
      // Never hang in Watch mode, even if a step is set up wrongly.
      watchTimer = window.setTimeout(() => {
        if (index.value === current && !paused.value) advance()
      }, WATCH_STUCK_MS)
    }, WATCH_READ_MS)
  }

  function togglePause() {
    paused.value = !paused.value
    if (paused.value) clearTimeout(watchTimer)
    else scheduleWatch()
  }

  /** Do the current step: click the target, or type/select its value. */
  async function perform() {
    const s = step.value
    if (!s) return
    if (sim.state.screen !== s.screen) sim.navigate(s.screen)
    const el = await waitForTarget(2500)
    if (!el) {
      advance()
      return
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (s.action_type === 'Observe') {
      advance()
    } else if (s.action_type === 'Click') {
      el.click()
    } else {
      const value = resolveDate(s.auto_value || plainExpectedValue(s))
      const input = el as HTMLInputElement | HTMLSelectElement
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  function plainExpectedValue(s: Step) {
    return /^(>=|<=|!=|>|<)/.test(s.expected_value) ? '' : s.expected_value
  }

  function waitForTarget(timeout: number): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const started = Date.now()
      const poll = () => {
        const el = findTarget()
        if (el || Date.now() - started > timeout) resolve(el)
        else window.setTimeout(poll, 100)
      }
      poll()
    })
  }

  function scrollTargetIntoView() {
    void waitForTarget(1500).then((el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  // ── Wiring ──────────────────────────────────────────────────────

  const EVENTS = ['click', 'input', 'change'] as const
  const BLOCKED = ['pointerdown', 'mousedown', 'click'] as const

  onMounted(() => {
    const el = root.value
    if (!el) return
    for (const type of EVENTS) el.addEventListener(type, onSimEvent)
    for (const type of BLOCKED) el.addEventListener(type, onCapture, true)
    enterStep()
  })

  onBeforeUnmount(() => {
    clearTimeout(watchTimer)
    clearTimeout(typingTimer)
    const el = root.value
    if (!el) return
    for (const type of EVENTS) el.removeEventListener(type, onSimEvent)
    for (const type of BLOCKED) el.removeEventListener(type, onCapture, true)
  })

  return {
    mode,
    index,
    total,
    step,
    target,
    finished,
    hints,
    mistakes,
    score,
    pulse,
    paused,
    showSpotlight,
    showHint,
    onWrongScreen,
    elapsedSeconds,
    findTarget,
    next,
    useHint,
    goToStepScreen,
    togglePause,
  }
}

export type ScenarioRun = ReturnType<typeof useScenario>
