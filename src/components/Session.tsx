import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { getFriendReply, type Answers, type Intent } from '../lib/friend'
import type { Day, Profile, Settings } from '../lib/store'
import * as voice from '../lib/voice'
import { OrbSlot } from './Orb'
import { Btn, Captions, Dots, Icon } from './ui'

export type Kind = 'onboarding' | 'morning' | 'evening' | 'fog'
type Key = keyof Answers
interface Step {
  intent: Intent
  listen?: Key
}

const SCRIPTS: Record<Kind, Step[]> = {
  onboarding: [
    { intent: 'onboard_best', listen: 'best' },
    { intent: 'onboard_want', listen: 'want' },
    { intent: 'onboard_why', listen: 'why' },
    { intent: 'onboard_close' },
  ],
  morning: [{ intent: 'morning_open' }, { intent: 'morning_ask', listen: 'oneThing' }, { intent: 'morning_close' }],
  evening: [{ intent: 'evening_how', listen: 'how' }, { intent: 'evening_acted', listen: 'acted' }, { intent: 'evening_close' }],
  fog: [{ intent: 'fog' }],
}

const READY: Record<Kind, string> = {
  onboarding: 'Hi. Let’s meet.',
  morning: 'Good morning.',
  evening: 'Evening.',
  fog: '',
}

interface Props {
  kind: Kind
  profile: Profile | null
  today?: Day
  yesterday?: Day
  settings: Settings
  paused?: boolean
  autoStart?: boolean
  onDone: (a: Answers) => void
  onExit?: () => void
}

type Mode = 'ready' | 'thinking' | 'speaking' | 'voice' | 'typing' | 'heard'

export default function Session(p: Props) {
  const steps = SCRIPTS[p.kind]
  const [started, setStarted] = useState(!!p.autoStart)
  const [i, setI] = useState(0)
  const [mode, setMode] = useState<Mode>(p.autoStart ? 'thinking' : 'ready')
  const [chunks, setChunks] = useState<voice.Chunk[]>([])
  const [ci, setCi] = useState(0)
  const [shown, setShown] = useState(0)
  const [interim, setInterim] = useState('')
  const [hint, setHint] = useState('')
  const [tries, setTries] = useState(0)
  const [typed, setTyped] = useState('')
  const [micOk, setMicOk] = useState(voice.canListen)
  const answers = useRef<Answers>({})
  const props = useRef(p)
  props.current = p

  // run one step: get the line, say it, then listen or move on
  useEffect(() => {
    if (!started || p.paused) return
    const ctl = new AbortController()
    const step = steps[i]
    setMode('thinking')
    voice.orb.mode = 'thinking'
    setChunks([])
    ;(async () => {
      const { profile, today, yesterday, settings } = props.current
      const text = await getFriendReply({ intent: step.intent, profile, today, yesterday, answers: answers.current })
      if (ctl.signal.aborted) return
      setChunks(voice.parseCaption(text))
      setCi(0)
      setShown(0)
      setMode('speaking')
      await voice.speak(text, {
        voiceURI: settings.voiceURI,
        muted: settings.muted,
        signal: ctl.signal,
        onProgress: (c, n) => {
          setCi(c)
          setShown(n)
        },
      })
      if (ctl.signal.aborted) return
      if (step.listen) {
        setInterim('')
        setTyped('')
        setHint('')
        setMode(micOk ? 'voice' : 'typing')
      } else if (i < steps.length - 1) setI(i + 1)
      else {
        voice.orb.mode = 'idle'
        await new Promise((r) => setTimeout(r, 500))
        if (!ctl.signal.aborted) props.current.onDone(answers.current)
      }
    })()
    return () => {
      ctl.abort()
      voice.stopSpeaking()
      voice.abortListening()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, p.paused, i])

  // voice capture
  useEffect(() => {
    if (mode !== 'voice' || p.paused) return
    let live = true
    voice
      .listen((t) => live && setInterim(t))
      .then((text) => {
        if (!live) return
        voice.orb.mode = 'idle'
        if (text.trim()) submit(text)
        else setHint('Didn’t catch that. Tap to talk.')
      })
      .catch((e: Error) => {
        if (!live) return
        voice.orb.mode = 'idle'
        if (e.message === 'denied' || e.message === 'unsupported') setMicOk(false)
        setMode('typing')
      })
    return () => {
      live = false
      voice.abortListening()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, p.paused, tries])

  function submit(text: string) {
    const key = steps[i].listen
    if (!key || !text.trim()) return
    answers.current = { ...answers.current, [key]: text.trim() }
    setInterim(text.trim())
    setMode('heard')
    voice.pulse(1)
    setTimeout(() => setI((n) => n + 1), 650)
  }

  const begin = () => {
    voice.unlockSpeech()
    setStarted(true)
  }

  const chunk = chunks[ci]
  const listening = mode === 'voice' || mode === 'typing' || mode === 'heard'

  return (
    <div className="fixed inset-0 z-10 flex flex-col" style={{ opacity: p.paused ? 0 : 1, pointerEvents: p.paused ? 'none' : 'auto' }}>
      {/* header */}
      <div className="safe-top px-5">
        <div className="flex h-11 items-center justify-between">
          {started && p.onExit ? (
            <Btn aria-label="Close" onClick={p.onExit} className="glass grid h-10 w-10 place-items-center rounded-full">
              <Icon.close />
            </Btn>
          ) : (
            <span className="w-10" />
          )}
          {started && steps.length > 1 && <Dots total={steps.length} at={i} />}
          <span className="w-10" />
        </div>
      </div>

      {/* the orb lives behind this slot; tap it to begin, or tap while speaking to skip */}
      <OrbSlot label={started ? 'Skip' : 'Begin'} onClick={() => (started ? mode === 'speaking' && voice.skip() : begin())} />

      {/* captions */}
      <div className="flex flex-1 flex-col items-center justify-start px-7 pt-6" onClick={() => mode === 'speaking' && voice.skip()}>
        {!started ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="font-display text-5xl font-bold tracking-[-0.03em]">{READY[p.kind]}</h1>
            <motion.p
              className="mt-4 text-[15px] tracking-wide opacity-70"
              animate={{ opacity: [0.4, 0.85, 0.4] }}
              transition={{ duration: 2.6, repeat: Infinity }}
            >
              Tap the orb. Two minutes.
            </motion.p>
          </motion.div>
        ) : (
          <>
            <Captions chunk={chunk} shown={shown} k={`${i}-${ci}`} dim={listening} />
            <AnimatePresence>
              {listening && interim && (
                <motion.p
                  key="you"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, scale: mode === 'heard' ? 1.04 : 1 }}
                  exit={{ opacity: 0 }}
                  className="quote font-display mt-6 text-center text-2xl font-medium italic leading-snug"
                >
                  “{interim}”
                </motion.p>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* answer controls */}
      <div className="safe-bottom flex min-h-[132px] items-end justify-center px-5">
        <AnimatePresence mode="wait">
          {mode === 'voice' && (
            <motion.div key="voice" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col items-center gap-3">
              <p className="h-5 text-sm opacity-70">{hint || (interim ? 'Tap when done.' : 'Listening…')}</p>
              <div className="flex items-center gap-5">
                <span className="w-11" />
                <Btn
                  aria-label="Microphone"
                  onClick={() => (hint ? (setHint(''), setInterim(''), setTries((n) => n + 1)) : voice.stopListening())}
                  className="glass relative grid h-20 w-20 place-items-center rounded-full"
                >
                  {!hint && (
                    <motion.span
                      className="absolute inset-0 rounded-full border"
                      style={{ borderColor: 'var(--glow)' }}
                      animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                  )}
                  {interim && !hint ? <Icon.check /> : <Icon.mic />}
                </Btn>
                <Btn aria-label="Type instead" onClick={() => setMode('typing')} className="glass grid h-11 w-11 place-items-center rounded-full">
                  <Icon.keys />
                </Btn>
              </div>
            </motion.div>
          )}
          {mode === 'typing' && (
            <motion.form
              key="type"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="glass flex w-full max-w-md items-center gap-2 rounded-[22px] p-2"
              onSubmit={(e) => {
                e.preventDefault()
                submit(typed)
              }}
            >
              {micOk && (
                <Btn type="button" aria-label="Speak instead" onClick={() => (setHint(''), setMode('voice'))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full opacity-80">
                  <Icon.mic />
                </Btn>
              )}
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Say it in your words"
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[16px] outline-none placeholder:text-white/40"
              />
              <Btn type="submit" aria-label="Send" disabled={!typed.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/90 text-black disabled:opacity-30">
                <Icon.send />
              </Btn>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
