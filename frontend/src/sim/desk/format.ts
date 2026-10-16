/** Desk formats on the training site: dd-mm-yyyy dates and Qatari Riyal amounts. */

export function deskDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/** QAR has its symbol on the right in ERPNext: `1,800.00 ر.ق`. */
export function deskMoney(n: number): string {
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.ق`
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function words(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) return `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim()
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred ${words(n % 100)}`.trim()
  if (n < 1_000_000) return `${words(Math.floor(n / 1000))} Thousand ${words(n % 1000)}`.trim()
  return `${words(Math.floor(n / 1_000_000))} Million ${words(n % 1_000_000)}`.trim()
}

/** The In Words field: `QAR Two Thousand Five Hundred only.` */
export function inWords(n: number): string {
  const whole = Math.floor(n)
  const fils = Math.round((n - whole) * 100)
  const main = whole ? words(whole) : 'Zero'
  return fils ? `QAR ${main} and ${words(fils)} Dirham only.` : `QAR ${main} only.`
}
