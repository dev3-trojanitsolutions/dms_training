<script setup lang="ts">
import { useSim } from '../engine/sim'

/**
 * The confirm dialog, message box and toast every simulated screen shares.
 * Each looks like what that real screen uses: the sales portal's own modal,
 * the browser's confirm()/alert(), or Desk's msgprint and alert.
 */
const sim = useSim()
</script>

<template>
  <!-- Confirm -->
  <div v-if="sim.state.dialog.open" class="sd-overlay" :class="`is-${sim.state.dialog.style}`">
    <div v-if="sim.state.dialog.style === 'portal'" class="sd-portal" role="dialog" aria-modal="true">
      <div class="sd-portal-title">{{ sim.state.dialog.title }}</div>
      <div class="sd-portal-msg">{{ sim.state.dialog.message }}</div>
      <div class="sd-portal-actions">
        <button class="sd-btn" data-tour="dialog.cancel" @click="sim.closeDialog(false)">Cancel</button>
        <button class="sd-btn primary" data-tour="dialog.confirm" @click="sim.closeDialog(true)">
          {{ sim.state.dialog.confirm_label }}
        </button>
      </div>
    </div>
    <div v-else-if="sim.state.dialog.style === 'browser'" class="sd-browser" role="dialog" aria-modal="true">
      <div class="sd-browser-origin">local.com says</div>
      <div class="sd-browser-msg">{{ sim.state.dialog.message }}</div>
      <div class="sd-browser-actions">
        <button class="sd-pill ghost" data-tour="dialog.cancel" @click="sim.closeDialog(false)">Cancel</button>
        <button class="sd-pill" data-tour="dialog.confirm" @click="sim.closeDialog(true)">
          {{ sim.state.dialog.confirm_label }}
        </button>
      </div>
    </div>
    <div v-else class="sd-desk" role="dialog" aria-modal="true">
      <div class="sd-desk-head">{{ sim.state.dialog.title || 'Confirm' }}</div>
      <div class="sd-desk-msg">{{ sim.state.dialog.message }}</div>
      <div class="sd-desk-actions">
        <button class="sd-desk-btn" data-tour="dialog.cancel" @click="sim.closeDialog(false)">No</button>
        <button class="sd-desk-btn primary" data-tour="dialog.confirm" @click="sim.closeDialog(true)">
          {{ sim.state.dialog.confirm_label || 'Yes' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Message -->
  <div v-if="sim.state.alert.open" class="sd-overlay" :class="`is-${sim.state.alert.style}`">
    <div v-if="sim.state.alert.style === 'desk'" class="sd-desk" role="alertdialog" aria-modal="true">
      <div class="sd-desk-head">Message</div>
      <div class="sd-desk-msg">{{ sim.state.alert.message }}</div>
      <div class="sd-desk-actions">
        <button class="sd-desk-btn primary" data-tour="alert.ok" @click="sim.closeAlert()">OK</button>
      </div>
    </div>
    <div v-else class="sd-browser" role="alertdialog" aria-modal="true">
      <div class="sd-browser-origin">local.com says</div>
      <div class="sd-browser-msg">{{ sim.state.alert.message }}</div>
      <div class="sd-browser-actions">
        <button class="sd-pill" data-tour="alert.ok" @click="sim.closeAlert()">OK</button>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div
    v-if="sim.state.toast.open"
    class="sd-toast"
    :class="[`is-${sim.state.toast.style}`, { error: sim.state.toast.error }]"
    role="status"
    data-tour="toast"
  >
    {{ sim.state.toast.message }}
  </div>
</template>

<style scoped>
.sd-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.45);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #201e1d;
}
.sd-overlay.is-browser {
  align-items: flex-start;
  padding-top: 24px;
  background: rgba(0, 0, 0, 0.2);
}
.sd-overlay.is-desk {
  align-items: flex-start;
  padding-top: 72px;
}

/* Sales portal modal */
.sd-portal {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.24);
}
.sd-portal-title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 8px;
}
.sd-portal-msg {
  font-size: 14px;
  color: #7d7979;
  margin-bottom: 20px;
  line-height: 1.45;
}
.sd-portal-actions {
  display: flex;
  gap: 12px;
}
.sd-btn {
  flex: 1;
  min-height: 48px;
  border-radius: 10px;
  border: 1.5px solid rgba(32, 30, 29, 0.16);
  background: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.sd-btn.primary {
  background: #2d2b2b;
  border-color: #2d2b2b;
  color: #fff;
}

/* Browser confirm() / alert() */
.sd-browser {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 440px;
  padding: 18px 20px 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  font-family: system-ui, sans-serif;
}
.sd-browser-origin {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.sd-browser-msg {
  font-size: 14px;
  line-height: 1.45;
  margin-bottom: 16px;
  word-break: break-word;
}
.sd-browser-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.sd-pill {
  min-width: 72px;
  padding: 6px 16px;
  border-radius: 999px;
  border: none;
  background: #1a73e8;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.sd-pill.ghost {
  background: #fff;
  color: #1a73e8;
  border: 1px solid #dadce0;
}

/* Desk msgprint */
.sd-desk {
  width: 100%;
  max-width: 460px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.22);
  font-family: Inter, -apple-system, sans-serif;
  font-size: 14px;
}
.sd-desk-head {
  padding: 16px 20px 8px;
  font-size: 16px;
  font-weight: 600;
}
.sd-desk-msg {
  padding: 0 20px 16px;
  line-height: 1.5;
  color: #383838;
}
.sd-desk-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
}
.sd-desk-btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 8px;
  border: none;
  background: #f3f3f3;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.sd-desk-btn.primary {
  background: #171717;
  color: #fff;
}

/* Toast */
.sd-toast {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 45;
  max-width: calc(100% - 32px);
  padding: 11px 18px;
  border-radius: 12px;
  background: #2e4034;
  color: #f6f3ed;
  font-family: Inter, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  /* Never block a click on what is underneath. */
  pointer-events: none;
}
.sd-toast.error {
  background: #9a4a35;
}
.sd-toast.is-desk {
  right: 16px;
  bottom: 16px;
  left: auto;
  transform: none;
  background: #fff;
  color: #171717;
  border: 1px solid #e2e2e2;
  border-left: 4px solid #30a66d;
}
.sd-toast.is-desk.error {
  border-left-color: #e03636;
}
</style>
