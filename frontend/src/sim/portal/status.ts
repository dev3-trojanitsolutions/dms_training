/** Badge colour per Sales Order status, as in dms/www/order-history. */
export function statusBadge(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'delivered':
      return 'green'
    case 'to deliver and bill':
    case 'to deliver':
    case 'to bill':
      return 'orange'
    case 'cancelled':
    case 'closed':
      return 'red'
    case 'on hold':
      return 'blue'
    default:
      return 'gray'
  }
}
