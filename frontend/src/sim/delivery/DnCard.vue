<script setup lang="ts">
import { formatDate } from '../../engine/dates'
import type { DeliveryNote } from '../../engine/types'
import { deliveryBadge } from './deliveryStatus'

/** pendingCard() / completedCard() in dms/www/delivery-dashboard/script.js. */
defineProps<{ dn: DeliveryNote; completed?: boolean }>()
</script>

<template>
  <div class="dl-card-top">
    <span class="dl-dn-no">{{ dn.name }}</span>
    <span class="dl-badge" :class="deliveryBadge(dn).cls">{{ deliveryBadge(dn).label }}</span>
  </div>
  <div class="dl-customer">{{ dn.customer_name }}</div>
  <div v-if="completed" class="dl-meta">
    <span><span class="lucide-paperclip size-4" aria-hidden="true" />{{ dn.items.length }} item{{ dn.items.length === 1 ? '' : 's' }}</span>
    <span style="margin-left: auto">View ›</span>
  </div>
  <template v-else>
    <div class="dl-meta">
      <span><span class="lucide-calendar size-4" aria-hidden="true" />{{ formatDate(dn.posting_date) }}</span>
    </div>
    <span class="dl-badge addr-ok" style="align-self: flex-start">
      <span class="lucide-map-pin size-4" aria-hidden="true" />Address available
    </span>
  </template>
</template>
