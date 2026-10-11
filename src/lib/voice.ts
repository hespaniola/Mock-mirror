// Voice in and out (Web Speech API) + the shared signal the orb reads every frame.

export type OrbMode = 'idle' | 'speaking' | 'listening' | 'thinking'

// Mutable on purpose: the orb reads this in requestAnimationFrame, no React renders.
export const orb = { mode: 'idle' as OrbMode, energy: 0 }
export const pulse = (amount = 1) => {
  orb.energy = Math.min(1.4, orb.energy + amount)
}

// ---------------- captions ----------------

export interface Word {
  w: string
  quoted: boolean
}
export interface Chunk {
  words: Word[]
  say: string
}

// "[[...]]" marks the user's own words. Split into sentence-sized chunks for big captions.
export function parseCaption(text: string): Chunk[] {
  const words: Word[] = []
  text.split(/(\[\[.*?\]\])/).forEach((part) => {
    const quoted = part.startsWith('[[')
    const clean = quoted ? part.slice(2, -2) : part
    clean.split(/\s+/).filter(Boolean).forEach((w) => {
      // punctuation glued right after a quote belongs to the previous word
      if (!quoted && /^[.,!?;:]+$/.test(w) && words.length) words[words.length - 1].w += w
      else words.push({ w, quoted })
    })
  })
  const chunks: Word[][] = [[]]
  words.forEach((wd, i) => {
    chunks[chunks.length - 1].push(wd)
    const end = /[.?!…]$/.test(wd.w) && !(wd.quoted && words[i + 1]?.quoted)
    if (end && i < words.length - 1) chunks.push([])
  })
  // merge tiny fragments ("Okay.") into the next sentence so speech flows
  const merged: Word[][] = []
  chunks.forEach((c) => {
    const prev = merged[merged.length - 1]
    if (prev && prev.length < 3 && prev.length + c.length <= 14) prev.push(...c)
    else merged.push([...c])
  })
  return merged.filter((c) => c.length).map((ws) => ({ words: ws, say: ws.map((x) => x.w).join(' ') }))
}

// ---------------- speaking ----------------

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
export const canSpeak = !!synth && typeof SpeechSynthesisUtterance !== 'undefined'

export function getVoices(): SpeechSynthesisVoice[] {
  return canSpeak ? synth!.getVoices() : []
}

export function onVoicesChanged(cb: () => void) {
  if (!canSpeak) return () => {}
  synth!.addEventListener('voiceschanged', cb)
  return () => synth!.removeEventListener('voiceschanged', cb)
}

function defaultVoice() {
  const vs = getVoices()
  const lang = navigator.language?.slice(0, 2) || 'en'
  const local = vs.filter((v) => v.lang.startsWith(lang))
  const pool = local.length ? local : vs
  // prefer the nicer-sounding built-ins when present
  return pool.find((v) => /samantha|ava|serena|google us english|natural|premium|enhanced/i.test(v.name)) || pool.find((v) => v.default) || pool[0]
}

// iOS only allows speech that starts inside a tap. Call this from tap handlers.
export function unlockSpeech() {
  if (!canSpeak) return
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth!.speak(u)
  } catch {
    /* ignore */
  }
}

let skipCurrent: (() => void) | null = null
export const skip = () => skipCurrent?.()

export function stopSpeaking() {
  skipCurrent = null
  if (canSpeak) synth!.cancel()
}

interface SpeakOpts {
  voiceURI: string | null
  muted: boolean
  signal: AbortSignal
  onProgress: (chunk: number, shown: number) => void
}

const wordMs = (w: string) => 200 + w.length * 42 + (/[,;:]$/.test(w) ? 160 : 0) + (/[.?!…]$/.test(w) ? 260 : 0)
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res) => {
    const t = setTimeout(res, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), res()), { once: true })
  })

// Speaks chunk by chunk. Captions follow real word boundaries when the browser
// reports them, and a timing estimate when it doesn't (or when muted).
export async function speak(text: string, o: SpeakOpts) {
  const chunks = parseCaption(text)
  let skipped = false
  skipCurrent = () => {
    skipped = true
    if (canSpeak) synth!.cancel()
  }
  orb.mode = 'speaking'
  for (let c = 0; c < chunks.length; c++) {
    if (o.signal.aborted) return
    if (skipped) break
    await speakChunk(chunks[c], c, o, () => skipped)
    o.onProgress(c, chunks[c].words.length)
    if (!skipped) await wait(220, o.signal)
  }
  if (skipped && !o.signal.aborted) {
    const lastC = chunks.length - 1
    o.onProgress(lastC, chunks[lastC].words.length)
  }
  skipCurrent = null
  if (!o.signal.aborted) orb.mode = 'idle'
}

function speakChunk(chunk: Chunk, index: number, o: SpeakOpts, isSkipped: () => boolean) {
  return new Promise<void>((resolve) => {
    const { words } = chunk
    let shown = 0
    let boundaries = false
    let done = false
    const timers: number[] = []
    const show = (n: number) => {
      if (n <= shown || done) return
      shown = Math.min(n, words.length)
      pulse(0.45)
      o.onProgress(index, shown)
    }
    const finish = () => {
      if (done) return
      done = true
      timers.forEach(clearTimeout)
      resolve()
    }
    o.signal.addEventListener('abort', finish, { once: true })

    // timed reveal (fallback, and the only source when muted)
    let t = 0
    const total = words.reduce((s, w) => s + wordMs(w.w), 0)
    words.forEach((w, i) => {
      timers.push(window.setTimeout(() => !boundaries && show(i + 1), t))
      t += wordMs(w.w)
    })

    if (o.muted || !canSpeak) {
      timers.push(window.setTimeout(finish, total))
      const iv = window.setInterval(() => isSkipped() && (clearInterval(iv), finish()), 50)
      timers.push(iv)
      return
    }

    const u = new SpeechSynthesisUtterance(chunk.say)
    const v = getVoices().find((x) => x.voiceURI === o.voiceURI) || defaultVoice()
    if (v) {
      u.voice = v
      u.lang = v.lang
    }
    u.rate = 1
    u.pitch = 1
    // char offset -> word index
    const starts: number[] = []
    let off = 0
    words.forEach((w) => (starts.push(off), (off += w.w.length + 1)))
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return
      boundaries = true
      let i = 0
      while (i < starts.length && starts[i] <= e.charIndex) i++
      show(i)
    }
    u.onend = () => finish()
    u.onerror = () => finish()
    // Some engines never fire onend. Don't hang.
    timers.push(window.setTimeout(finish, total * 2.5 + 4000))
    synth!.speak(u)
  })
}

// ---------------- listening ----------------

type Rec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
const RecCtor: (new () => Rec) | undefined =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined
export const canListen = !!RecCtor

let active: Rec | null = null
export const stopListening = () => active?.stop()
export const abortListening = () => {
  active?.abort()
  active = null
}

// Resolves with what was heard ('' if nothing). Rejects with 'denied' | 'unsupported' | other error codes.
export function listen(onInterim: (text: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!RecCtor) return reject(new Error('unsupported'))
    abortListening()
    stopSpeaking()
    const r = new RecCtor()
    active = r
    r.lang = navigator.language || 'en-US'
    r.interimResults = true
    r.continuous = false
    let text = ''
    let failed = false
    r.onresult = (e) => {
      text = Array.from(e.results)
        .map((res) => res[0].transcript)
        .join(' ')
        .trim()
      pulse(0.5)
      onInterim(text)
    }
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      failed = true
      reject(new Error(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error))
    }
    r.onend = () => {
      if (active === r) active = null
      if (!failed) resolve(text)
    }
    orb.mode = 'listening'
    try {
      r.start()
    } catch (err) {
      failed = true
      reject(err instanceof Error ? err : new Error('start-failed'))
    }
  })
}

export const tap = () => navigator.vibrate?.(8)
