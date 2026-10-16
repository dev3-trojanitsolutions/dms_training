/** `today`, `today+2` or `today-3` to an ISO date. Other strings pass through. */
export function resolveDate(value: string): string {
  const match = /^today([+-]\d+)?$/.exec(value.trim())
  if (!match) return value
  const date = new Date()
  date.setDate(date.getDate() + Number(match[1] ?? 0))
  return toISODate(date)
}

export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function today(): string {
  return toISODate(new Date())
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
