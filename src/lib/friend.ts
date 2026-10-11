// The friend's brain. MOCK: templates filled with the user's own words.
//
// Contract for a real AI later: keep the signature of getFriendReply.
// Return plain text. Wrap anything quoted from the user in [[double brackets]]
// so the UI can highlight it. Short sentences. One idea per sentence.

import type { Day, Profile, Result } from './store'

export type Intent =
  | 'onboard_best' // intro + "Who are you at your best?"
  | 'onboard_want' // ack best + "What do you want most?"
  | 'onboard_why' // ack want + "Why does it matter?"
  | 'onboard_close' // reflect all three back
  | 'morning_open' // greet + identity
  | 'morning_ask' // yesterday + "What's the one thing today?"
  | 'morning_close' // lock it in
  | 'evening_how' // "How did it go?"
  | 'evening_acted' // ack + "Did you act like that person today?"
  | 'evening_close' // one-line day summary
  | 'fog' // identity + today's one thing, right now

export type Answers = Partial<Record<'best' | 'want' | 'why' | 'oneThing' | 'how' | 'acted', string>>

export interface FriendContext {
  intent: Intent
  profile: Profile | null
  answers: Answers // what was said in this session so far
  today?: Day
  yesterday?: Day
  now?: Date
}

export async function getFriendReply(ctx: FriendContext): Promise<string> {
  // Swap this body for an API call. The UI already awaits it.
  await new Promise((r) => setTimeout(r, 250)) // a beat, like a breath
  return mockReply(ctx)
}

// ---------------- mock implementation ----------------

const last: Record<string, number> = {}
function pick<T>(key: string, options: T[]): T {
  let i = Math.floor(Math.random() * options.length)
  if (options.length > 1 && i === last[key]) i = (i + 1) % options.length
  last[key] = i
  return options[i]
}

const q = (s: string) => `[[${s}]]`

function tidy(s = '') {
  return s.trim().replace(/\s+/g, ' ').replace(/[.!\s]+$/, '')
}

// Cut long answers at a natural break so read-backs stay short.
function short(s: string, words = 14) {
  const t = tidy(s)
  const parts = t.split(' ')
  if (parts.length <= words) return t
  const head = parts.slice(0, words).join(' ')
  const cut = head.search(/[,;:.](?=[^,;:.]*$)/)
  return cut > 20 ? head.slice(0, cut) : head + '…'
}

// Turn "I'm calm and my kids..." into "you're calm and your kids..."
function youify(s: string) {
  return s
    .replace(/\bI'm\b|\bI am\b/gi, "you're")
    .replace(/\bI've\b/gi, "you've")
    .replace(/\bI'll\b/gi, "you'll")
    .replace(/\bI'd\b/gi, "you'd")
    .replace(/\bmyself\b/gi, 'yourself')
    .replace(/\bmy\b/gi, 'your')
    .replace(/\bmine\b/gi, 'yours')
    .replace(/\bme\b/gi, 'you')
    .replace(/\bI\b/g, 'you')
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)

function strip(s: string, re: RegExp) {
  return lowerFirst(tidy(s).replace(re, '').trim())
}

// "At your best, you're [[calm and kind]]" / "At your best, [[you show up]]"
function bestLine(best: string) {
  const b = youify(strip(best, /^(at my best,?\s*)?(i'm|i am)\s+/i))
  return /^you\b/i.test(b) ? `At your best, ${q(short(b))}.` : `At your best, you're ${q(short(b))}.`
}
const wantPart = (want: string) => q(short(youify(strip(want, /^(what )?i (really )?(want|'d like|would like)( most)?( is)?\s*/i))))
const whyText = (why: string) => short(youify(strip(why, /^(it matters )?(because|cause|'cause)\s*/i)))
const whyPart = (why: string) => q(whyText(why))
const WhyPart = (why: string) => q(whyText(why).replace(/^./, (c) => c.toUpperCase()))
const raw = (s = '') => q(short(s, 16))

// Tiny tone read for yes/no-ish answers. Good enough for a mock.
export function tone(s = ''): 'yes' | 'some' | 'no' {
  const t = s.toLowerCase()
  if (/\b(kind of|kinda|sort of|partly|partially|half|some|mostly|a bit|a little|almost|ish)\b/.test(t)) return 'some'
  const neg = (t.match(/\b(no|nope|nah|not|didn'?t|did not|failed|skipped|missed|forgot|couldn'?t|wasn'?t|bad|badly|nothing|never|avoided|dodged|procrastinat\w*|scroll\w*)\b/g) || []).length
  const pos = (t.match(/\b(yes|yeah|yep|yup|did|done|finished|shipped|great|good|well|nailed|crushed|made it|completed|totally|absolutely|sent|went)\b/g) || []).length
  if (pos > neg) return 'yes'
  if (neg > pos) return 'no'
  return 'some'
}

export function summarizeDay(a: Answers): { summary: string; result: Result } {
  const how = tone(a.how)
  const acted = tone(a.acted)
  const score = { yes: 2, some: 1, no: 0 }[how] + { yes: 2, some: 1, no: 0 }[acted]
  const result: Result = score >= 3 ? 'win' : score >= 1 ? 'partial' : 'miss'
  const head = a.oneThing ? tidy(a.oneThing) : 'Today'
  const summary = `${head}: ${lowerFirst(short(a.how || 'no notes', 10))}.`
  return { summary, result }
}

function greeting(now: Date, phase: 'morning' | 'evening') {
  const h = now.getHours()
  if (phase === 'morning') {
    if (h < 6) return pick('gm', ['Early one.', "You're up early."])
    if (h >= 11) return pick('gm', ['Hey. Still morning.', 'Late morning. Still counts.'])
    return pick('gm', ['Morning.', 'Good morning.', 'Hey. Morning.'])
  }
  if (h < 4 || h >= 23) return pick('ge', ['Late one.', "Still up. Let's close the day."])
  return pick('ge', ['Evening.', 'Hey. Evening.', 'Good evening.'])
}

function yesterdayLine(y?: Day) {
  if (!y || (!y.morningAt && !y.eveningAt)) return pick('y0', ['Fresh start today.', 'New day. Clean page.'])
  const t = y.oneThing ? raw(y.oneThing) : null
  if (!y.eveningAt || !y.result) return pick('y1', ["We never closed out yesterday. That's fine.", "Yesterday's still open. Let it go."])
  if (y.result === 'win')
    return pick('yw', [
      `Yesterday you did ${t ?? 'what you said'}. That's evidence.`,
      `Yesterday: ${t ?? 'done'}. You kept your word to yourself.`,
      `You did ${t ?? 'it'} yesterday. Remember that feeling.`,
    ])
  if (y.result === 'partial')
    return pick('yp', [
      `Yesterday was half there. ${t ?? 'It'} got some of you. Still movement.`,
      `Yesterday, ${t ?? 'the one thing'} only half happened. That's okay. Finish stronger.`,
    ])
  return pick('ym', [
    `Yesterday you dodged ${t ?? 'it'}. I'm not mad. I'm just not pretending.`,
    `${t ?? 'Yesterday'} didn't happen. No drama. Today's yours.`,
  ])
}

function mockReply(ctx: FriendContext): string {
  const p = ctx.profile
  const a = ctx.answers
  const now = ctx.now ?? new Date()
  const best = p?.best ?? a.best ?? ''
  const want = p?.want ?? a.want ?? ''
  const why = p?.why ?? a.why ?? ''
  const oneThing = a.oneThing ?? ctx.today?.oneThing

  switch (ctx.intent) {
    case 'onboard_best':
      return pick('ob', [
        "Hey. I'm your mirror. No pep talks. I just remember who you are, so you don't have to. Three questions. First one. Who are you at your best?",
        "Hi. I'm the friend who remembers. Twice a day, I'll remind you who you are. In your words. Three questions. Who are you at your best?",
      ])
    case 'onboard_want':
      return pick('ow', [
        `${raw(a.best)}. I like that person. Next. What do you want most?`,
        `${raw(a.best)}. Got it. That's who we build on. What do you want most?`,
      ])
    case 'onboard_why':
      return pick('oy', [
        `${raw(a.want)}. Okay. Last one. The big one. Why does it matter?`,
        `${raw(a.want)}. I want that for you too. Why does it matter?`,
      ])
    case 'onboard_close':
      return [
        "Here's what I heard.",
        bestLine(best),
        `You want ${wantPart(want)}.`,
        `Because ${whyPart(why)}.`,
        pick('oc', ["I'll hold onto this. See you every morning and night.", "That's you. I won't let you forget it."]),
      ].join(' ')

    case 'morning_open':
      return `${greeting(now, 'morning')} ${pick('mo', [
        `Before the noise starts. ${bestLine(best)} That's still you.`,
        `Quick reminder. ${bestLine(best)} Let's be that today.`,
        `You want ${wantPart(want)}. Because ${whyPart(why)}. Hold that.`,
      ])}`
    case 'morning_ask':
      return `${yesterdayLine(ctx.yesterday)} ${pick('ma', ["So. What's the one thing today?", "What's the one thing today?", "Just one. What's the one thing today?"])}`
    case 'morning_close':
      return pick('mc', [
        `${raw(oneThing)}. Good. That moves you toward ${wantPart(want)}. Go do it. I'll ask tonight.`,
        `${raw(oneThing)}. Do that, and today's a win. Remember, ${whyPart(why)}.`,
        `${raw(oneThing)}. Locked in. The people who count on you will feel it. Go.`,
      ])

    case 'evening_how':
      return oneThing
        ? `${greeting(now, 'evening')} ${pick('eh', [
            `This morning you said ${raw(oneThing)}. How did it go?`,
            `Today was about ${raw(oneThing)}. How did it go?`,
          ])}`
        : `${greeting(now, 'evening')} We didn't pick a one thing today. That's okay. What did you actually get done?`
    case 'evening_acted': {
      const t = tone(a.how)
      const ack =
        t === 'yes'
          ? pick('ea1', [`${raw(a.how)}. That's a win. Let it land.`, `${raw(a.how)}. You did it. I'm proud of you.`])
          : t === 'no'
            ? pick('ea2', [`${raw(a.how)}. Thanks for being straight with me.`, `${raw(a.how)}. Okay. Honest is good. That's how we fix it.`])
            : pick('ea3', [`${raw(a.how)}. Some progress is still progress.`, `${raw(a.how)}. Got it. Partway counts.`])
      return `${ack} One more. ${bestLine(best)} Did you act like that person today?`
    }
    case 'evening_close': {
      const { summary, result } = summarizeDay({ ...a, oneThing })
      const end =
        result === 'win'
          ? pick('ec1', ["That's the whole thing. Rest. You earned it.", 'You were you today. The people around you felt it.'])
          : result === 'partial'
            ? pick('ec2', ['Some of you showed up. Tomorrow, a little more.', 'Not perfect. Real, though. Sleep on it.'])
            : pick('ec3', [`You dodged it today. Say it plain, then let it go. ${WhyPart(why)}. That's still true.`, "Rough one. Tomorrow you start clean. I'll be here."])
      return `Today in one line. ${q(summary)} Saved. ${end}`
    }

    case 'fog':
      return oneThing
        ? pick('f1', [
            `Hey. Breathe. ${bestLine(best)} Today's one thing: ${raw(oneThing)}. That's it. The rest can wait.`,
            `Fog happens. Here's what's true. You want ${wantPart(want)}. Right now, just ${raw(oneThing)}.`,
            `Stop. ${bestLine(best)} Because ${whyPart(why)}. Next move: ${raw(oneThing)}.`,
          ])
        : pick('f2', [
            `Hey. Breathe. ${bestLine(best)} You want ${wantPart(want)}. Pick one small thing and start.`,
            `Fog happens. Here's what's true. ${WhyPart(why)}. One small step. Now.`,
          ])
  }
}
