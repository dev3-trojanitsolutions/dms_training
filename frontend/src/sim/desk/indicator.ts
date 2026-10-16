/** Desk indicator colours, as ERPNext's list and form views show them. */
export function statusColor(status: string): string {
  switch (status) {
    case 'Not Saved':
      return 'yellow'
    case 'To Deliver and Bill':
    case 'To Deliver':
    case 'To Bill':
    case 'Unpaid':
    case 'On Hold':
      return 'orange'
    case 'Partly Paid':
      return 'yellow'
    case 'Submitted':
      return 'blue'
    case 'Draft':
    case 'Overdue':
      return 'red'
    case 'Completed':
    case 'Paid':
    case 'Closed':
      return 'green'
    default:
      return 'gray'
  }
}
