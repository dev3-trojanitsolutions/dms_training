/** Read `a.b.c` from an object. Item codes with dots are not supported. */
export function getPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((value, key) => (value == null ? undefined : (value as Record<string, unknown>)[key]), source)
}

const OPERATOR = /^(>=|<=|!=|>|<)\s*(.+)$/

/**
 * Compare a simulator value with the Expected Value text from Desk.
 * `>=2`, `<5` and `!=Draft` work, `a|b` accepts either value, and anything
 * else is a case-insensitive match.
 */
export function matches(actual: unknown, expected: string): boolean {
  const want = expected.trim()
  if (want.includes('|') && !OPERATOR.test(want)) return want.split('|').some((alt) => equals(actual, alt.trim()))
  const op = OPERATOR.exec(want)
  if (op) {
    const [, operator, rhs] = op
    if (operator === '!=') return !equals(actual, rhs)
    const a = Number(actual)
    const b = Number(rhs)
    if (Number.isNaN(a) || Number.isNaN(b)) return false
    return operator === '>=' ? a >= b : operator === '<=' ? a <= b : operator === '>' ? a > b : a < b
  }
  return equals(actual, want)
}

function equals(actual: unknown, want: string): boolean {
  if (typeof actual === 'number') return actual === Number(want)
  if (typeof actual === 'boolean') return String(actual) === want.toLowerCase()
  return String(actual ?? '').toLowerCase() === want.toLowerCase()
}
