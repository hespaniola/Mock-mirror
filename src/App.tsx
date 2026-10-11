import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { OrbStage } from './components/Orb'
import { History, Rest, SettingsScreen } from './components/screens'
import Session, { type Kind } from './components/Session'
import { Background, Btn, Burst, Icon } from './components/ui'
import { summarizeDay, type Answers } from './lib/friend'
import { dayKey, load, phaseNow, reset, save, shiftKey, streak, withDemoDays, type Data } from './lib/store'
import { unlockSpeech } from './lib/voice'

type Screen = 'main' | 'history' | 'settings'

export default function App() {
  const [data, setData] = useState<Data>(load)
  const [screen, setScreen] = useState<Screen>('main')
  const [fog, setFog] = useState(0) // 0 = closed, otherwise a fresh key
  const [burst, setBurst] = useState<{ id: number; big?: boolean; label?: string } | null>(null)
  const [nonce, setNonce] = useState(0)
  const [, setTick] = useState(0)
  const reduced = !!useReducedMotion()

  // re-check time of day every minute
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(iv)
  }, [])

  const update = (fn: (d: Data) => Data) =>
    setData((d) => {
      const next = fn(d)
      save(next)
      return next
    })

  const phase = phaseNow(data.settings)
  const today = dayKey()
  const day = data.days[today]
  const yesterday = data.days[shiftKey(today, -1)]

  useEffect(() => {
    document.documentElement.dataset.phase = phase
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', phase === 'morning' ? '#140a0d' : '#07061a')
  }, [phase])

  const flow: Kind | 'rest' = !data.profile
    ? 'onboarding'
    : phase === 'morning' && !day?.morningAt
      ? 'morning'
      : phase === 'evening' && !day?.eveningAt
        ? 'evening'
        : 'rest'

  const celebrate = (before: number, after: number) => {
    const grew = after > before
    setBurst({ id: Date.now(), big: grew, label: grew ? `${after} day${after === 1 ? '' : 's'}` : undefined })
    setTimeout(() => setBurst(null), 2400)
  }

  const finish = (kind: Kind, a: Answers) => {
    if (kind === 'onboarding') {
      update((d) => ({ ...d, profile: { best: a.best ?? '', want: a.want ?? '', why: a.why ?? '', createdAt: Date.now() } }))
      celebrate(0, 0)
      return
    }
    const before = streak(data.days)
    const prev = data.days[today] ?? { date: today }
    const next =
      kind === 'morning'
        ? { ...prev, oneThing: a.oneThing, morningAt: Date.now() }
        : { ...prev, how: a.how, acted: a.acted, ...summarizeDay({ ...a, oneThing: prev.oneThing }), eveningAt: Date.now() }
    const days = { ...data.days, [today]: next }
    update((d) => ({ ...d, days }))
    celebrate(before, streak(days))
  }

  const showFog = !!data.profile && !fog && screen === 'main'

  return (
    <MotionConfig reducedMotion="user">
      <Background phase={phase} />
      <OrbStage phase={phase} reduced={reduced} />

      <motion.div animate={{ opacity: fog ? 0 : 1 }} style={{ pointerEvents: fog ? 'none' : 'auto' }}>
        <AnimatePresence mode="wait">
          {screen === 'main' && flow !== 'rest' && (
            <motion.div key={`${flow}-${today}-${nonce}`} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <Session
                kind={flow}
                profile={data.profile}
                today={day}
                yesterday={yesterday}
                settings={data.settings}
                paused={!!fog}
                onDone={(a) => finish(flow, a)}
                onExit={() => setNonce((n) => n + 1)}
              />
            </motion.div>
          )}
          {screen === 'main' && flow === 'rest' && (
            <Rest key="rest" data={data} phase={phase} onHistory={() => setScreen('history')} onSettings={() => setScreen('settings')} />
          )}
          {screen === 'history' && <History key="history" data={data} onBack={() => setScreen('main')} />}
          {screen === 'settings' && (
            <SettingsScreen
              key="settings"
              data={data}
              onBack={() => setScreen('main')}
              onChange={update}
              onDemo={() => {
                update(withDemoDays)
                setScreen('history')
              }}
              onReset={() => {
                setData(reset())
                setScreen('main')
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* fog: always one tap away */}
      <AnimatePresence>
        {showFog && (
          <motion.div
            key="fogbtn"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="safe-top fixed right-5 top-0 z-30"
          >
            <Btn
              onClick={() => {
                unlockSpeech()
                setFog(Date.now())
              }}
              className="glass flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              <Icon.fog /> Fog
            </Btn>
          </motion.div>
        )}
        {!!fog && (
          <motion.div key={fog} className="fixed inset-0 z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Session
              kind="fog"
              autoStart
              profile={data.profile}
              today={day}
              yesterday={yesterday}
              settings={data.settings}
              onDone={() => setTimeout(() => setFog(0), 900)}
              onExit={() => setFog(0)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{burst && <Burst key={burst.id} big={burst.big} label={burst.label} reduced={reduced} />}</AnimatePresence>
    </MotionConfig>
  )
}
