<script setup lang="ts">
import { FrappeUIProvider, useColorScheme } from 'frappe-ui'

useColorScheme()
</script>

<template>
  <FrappeUIProvider>
    <div class="h-screen bg-surface-base text-ink-gray-8">
      <RouterView />
    </div>
  </FrappeUIProvider>
</template>
