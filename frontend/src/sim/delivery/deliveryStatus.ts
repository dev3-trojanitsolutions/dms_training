import type { DeliveryNote } from '../../engine/types'

/** badgeHtml() in dms/www/delivery-dashboard/script.js. Proof attached means "In Progress". */
export function deliveryBadge(dn: DeliveryNote): { label: string; cls: string } {
  if (dn.docstatus === 1) return { label: 'Completed', cls: 'completed' }
  if (dn.attachments.length) return { label: 'In Progress', cls: 'progress' }
  return { label: 'Pending', cls: 'pending' }
}
