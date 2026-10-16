<script setup lang="ts">
/** The right-hand sidebar of a saved Desk form: assignments, attachments, tags, share, history. */
defineProps<{
  title: string
  assignees?: string[]
  attachments?: string[]
  canAssign?: boolean
  owner: string
  /** How long ago it was created / edited, for example `2 days ago`. */
  created: string
  modified: string
}>()
defineEmits<{ assign: [] }>()
</script>

<template>
  <div class="d-fs-title">
    <span>{{ title }}</span>
    <span style="display: flex; gap: 10px; color: #7c7c7c">
      <span class="lucide-printer size-4" aria-hidden="true" />
      <span class="lucide-heart size-4" aria-hidden="true" />
    </span>
  </div>
  <div data-tour="desk.dn.assigned">
    <div class="d-fs-row">
      <span><span class="lucide-users size-4" aria-hidden="true" />Assign</span>
      <button
        v-if="canAssign"
        class="d-fs-add"
        data-tour="desk.assign"
        aria-label="Assign to someone"
        @click="$emit('assign')"
      >
        <span class="lucide-plus size-4" aria-hidden="true" />
      </button>
    </div>
    <div v-for="name in assignees ?? []" :key="name" class="d-assignee">
      <span class="d-avatar">{{ name.split(' ').map((w) => w[0]).join('').slice(0, 2) }}</span>{{ name }}
    </div>
  </div>
  <div class="d-fs-row">
    <span><span class="lucide-paperclip size-4" aria-hidden="true" />Attachments</span>
    <span class="d-fs-add"><span class="lucide-plus size-4" aria-hidden="true" /></span>
  </div>
  <div v-for="file in attachments ?? []" :key="file" class="d-assignee" style="font-size: 13px">
    <span class="lucide-file size-4" aria-hidden="true" />{{ file }}
  </div>
  <div class="d-fs-row">
    <span><span class="lucide-tag size-4" aria-hidden="true" />Tags</span>
    <span class="d-fs-add"><span class="lucide-plus size-4" aria-hidden="true" /></span>
  </div>
  <div class="d-fs-row">
    <span><span class="lucide-share-2 size-4" aria-hidden="true" />Share</span>
    <span class="d-fs-add"><span class="lucide-plus size-4" aria-hidden="true" /></span>
  </div>
  <div class="d-fs-meta">
    <div>Last Edited By <b>{{ owner }}</b></div>
    <div style="margin-bottom: 8px">{{ modified }}</div>
    <div>Created By <b>{{ owner }}</b></div>
    <div>{{ created }}</div>
  </div>
</template>
