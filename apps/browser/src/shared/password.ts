// Password rules for X Orbit accounts. The same rules the Support Center and the website use; Firebase enforces the
// core ones (8+ characters, upper, lower, number) on its servers too, so this list is advice, never the only gate.
const COMMON = new Set([
  'password1',
  'password123',
  'qwerty123',
  'letmein123',
  'welcome123',
  'iloveyou1',
  'admin1234',
  'abc12345',
  'xorbit123',
  'passw0rd1',
])

export const PASSWORD_RULES = [
  'at least 8 characters',
  'an uppercase letter',
  'a lowercase letter',
  'a number',
] as const

/** What is still missing; an empty list means the password is accepted. */
export function passwordProblems(pw: string, email = ''): string[] {
  const p: string[] = []
  if (pw.length < 8) p.push('at least 8 characters')
  if (!/[A-Z]/.test(pw)) p.push('an uppercase letter')
  if (!/[a-z]/.test(pw)) p.push('a lowercase letter')
  if (!/\d/.test(pw)) p.push('a number')
  const local = email.split('@')[0].toLowerCase()
  if (COMMON.has(pw.toLowerCase())) p.push('something less common')
  else if (local.length >= 4 && pw.toLowerCase().includes(local))
    p.push('no part of your email address')
  return p
}
