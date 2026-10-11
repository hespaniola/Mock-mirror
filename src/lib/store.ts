// All persistence lives here. localStorage only, one key, versioned.

export type Result = 'win' | 'partial' | 'miss'
export type Phase = 'morning' | 'evening'

export interface Profile {
  best: string
  want: string
  why: string
  createdAt: number
}

export interface Day {
  date: string // YYYY-MM-DD (a "day" starts at 4am)
  oneThing?: string
  morningAt?: number
  how?: string
  acted?: string
  summary?: string
  result?: Result
  eveningAt?: number
}

export interface Settings {
  voiceURI: string | null // null = system default
  muted: boolean // captions only
  phase: 'auto' | Phase // preview override for demos
}

export interface Data {
  profile: Profile | null
  days: Record<string, Day>
  settings: Settings
}

const KEY = 'mirror.v1'
const empty = (): Data => ({ profile: null, days: {}, settings: { voiceURI: null, muted: false, phase: 'auto' } })

export function load(): Data {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const d = JSON.parse(raw) as Partial<Data>
    return { ...empty(), ...d, settings: { ...empty().settings, ...d.settings } }
  } catch {
    return empty()
  }
}

export function save(d: Data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* private mode or full: the session still works, it just won't persist */
  }
}

export function reset() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  return empty()
}

// ---- dates ----
const DAY_START_HOUR = 4

export function dayKey(d = new Date()): string {
  const t = new Date(d.getTime() - DAY_START_HOUR * 3600_000)
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const day = String(t.getDate()).padStart(2, '0')
  return `${t.getFullYear()}-${m}-${day}`
}

export function shiftKey(key: string, by: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(y, m - 1, d + by, 12)
  return dayKey(new Date(t.getTime() + DAY_START_HOUR * 3600_000))
}

export function phaseNow(s: Settings, d = new Date()): Phase {
  if (s.phase !== 'auto') return s.phase
  const h = d.getHours()
  return h >= DAY_START_HOUR && h < 15 ? 'morning' : 'evening'
}

export const counts = (day?: Day) => !!(day && (day.morningAt || day.eveningAt))

export function streak(days: Record<string, Day>, today = dayKey()): number {
  let key = counts(days[today]) ? today : shiftKey(today, -1)
  let n = 0
  while (counts(days[key])) {
    n++
    key = shiftKey(key, -1)
  }
  return n
}

// ---- demo data so the history screen has something to show ----
const DEMO = [
  ['Ship the landing page', 'Shipped it before lunch.', 'Yes. Felt like me.', 'win'],
  ['Call mom back', 'We talked for an hour.', 'Yeah, mostly.', 'win'],
  ['Gym before work', 'Went, but late.', 'Kind of.', 'partial'],
  ['Write 500 words', "Didn't happen. Scrolled instead.", 'No.', 'miss'],
  ['Finish the pitch deck', 'Done and sent.', 'Yes.', 'win'],
  ['No phone after 9', 'Held it till 10.', 'Partly.', 'partial'],
  ['Run 5k', 'Ran it. Slow but done.', 'Yes, totally.', 'win'],
  ['Plan the week', 'Done in 20 minutes.', 'Yep.', 'win'],
  ['Reply to investors', 'Sent two of three.', 'Mostly.', 'partial'],
] as const

export function withDemoDays(d: Data): Data {
  const today = dayKey()
  const days = { ...d.days }
  const skip = 11 // leave one gap so the streak looks real
  for (let i = 1; i <= 16; i++) {
    const key = shiftKey(today, -i)
    if (i === skip) continue
    if (days[key]) continue
    const [oneThing, how, acted, result] = DEMO[i % DEMO.length]
    const at = new Date(key + 'T08:00').getTime()
    const morningOnly = i % 5 === 0
    days[key] = morningOnly
      ? { date: key, oneThing, morningAt: at }
      : {
          date: key,
          oneThing,
          morningAt: at,
          how,
          acted,
          result,
          summary: `${oneThing}: ${how.replace(/\.$/, '').toLowerCase()}.`,
          eveningAt: at + 12 * 3600_000,
        }
  }
  return { ...d, days }
}
