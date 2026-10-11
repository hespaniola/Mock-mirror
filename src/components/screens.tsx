import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { counts, dayKey, shiftKey, streak, type Data, type Day, type Phase, type Settings } from '../lib/store'
import * as voice from '../lib/voice'
import { OrbSlot } from './Orb'
import { Btn, Icon } from './ui'

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.35 } }

function Header({ left, title }: { left?: React.ReactNode; title?: string }) {
  return (
    <div className="safe-top px-5">
      <div className="flex h-11 items-center gap-3">
        {left}
        {title && <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>}
      </div>
    </div>
  )
}

const Back = ({ onClick }: { onClick: () => void }) => (
  <Btn aria-label="Back" onClick={onClick} className="glass grid h-10 w-10 place-items-center rounded-full">
    <Icon.back />
  </Btn>
)

// ---------------- rest: today's thing + streak ----------------
export function Rest({ data, phase, onHistory, onSettings }: { data: Data; phase: Phase; onHistory: () => void; onSettings: () => void }) {
  const today = data.days[dayKey()]
  const n = streak(data.days)
  const line = today?.eveningAt ? 'Rest well. See you tomorrow.' : phase === 'morning' ? 'See you tonight.' : 'See you tomorrow.'
  const week = Array.from({ length: 7 }, (_, i) => data.days[shiftKey(dayKey(), i - 6)])
  return (
    <motion.div {...fade} className="fixed inset-0 z-10 flex flex-col">
      <Header />
      <OrbSlot />
      <div className="flex flex-1 flex-col items-center px-8 pt-8 text-center">
        {today?.oneThing && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-50">Today</p>
            <p className="quote font-display mt-3 text-[34px] font-bold leading-[1.1] tracking-[-0.02em]">{today.oneThing}</p>
          </>
        )}
        <p className="mt-5 text-[15px] opacity-70">{line}</p>
      </div>
      <div className="safe-bottom flex items-center justify-between px-6">
        <Btn aria-label="History" onClick={onHistory} className="glass flex h-12 items-center gap-3 rounded-full pl-4 pr-5">
          <div className="flex gap-1">
            {week.map((d, i) => (
              <span key={i} className="h-2 w-2 rounded-full" style={{ background: counts(d) ? 'var(--glow)' : 'rgba(255,255,255,.18)', boxShadow: counts(d) ? '0 0 8px var(--glow)' : undefined }} />
            ))}
          </div>
          <span className="font-display text-base font-semibold">{n}</span>
        </Btn>
        <Btn aria-label="Settings" onClick={onSettings} className="glass grid h-12 w-12 place-items-center rounded-full">
          <Icon.gear />
        </Btn>
      </div>
    </motion.div>
  )
}

// ---------------- history: a field of little orbs ----------------
const WEEKS = 5

function dot(d?: Day): React.CSSProperties {
  if (!counts(d)) return { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)' }
  const full = 'radial-gradient(circle at 35% 30%, #fff 0%, var(--glow) 35%, color-mix(in srgb, var(--glow) 40%, #ff5f8a) 100%)'
  if (!d!.eveningAt || !d!.result) return { background: `linear-gradient(90deg, var(--glow) 50%, rgba(255,255,255,.08) 50%)`, opacity: 0.85 }
  if (d!.result === 'win') return { background: full, boxShadow: '0 0 14px color-mix(in srgb, var(--glow) 80%, transparent)' }
  if (d!.result === 'partial') return { background: full, opacity: 0.6, transform: 'scale(.8)' }
  return { background: 'rgba(255,255,255,.25)', transform: 'scale(.55)' }
}

export function History({ data, onBack }: { data: Data; onBack: () => void }) {
  const today = dayKey()
  const n = streak(data.days)
  // align columns to weekdays, today in the last row
  const [y, m, dd] = today.split('-').map(Number)
  const dow = (new Date(y, m - 1, dd).getDay() + 6) % 7 // Mon=0
  const start = shiftKey(today, -(WEEKS - 1) * 7 - dow)
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => shiftKey(start, i))
  const [sel, setSel] = useState<string>(today)
  const d = data.days[sel]
  const label = new Date(sel + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <motion.div {...fade} className="fixed inset-0 z-10 flex flex-col">
      <Header left={<Back onClick={onBack} />} />
      <div className="flex items-center justify-center gap-4 px-6">
        <OrbSlot size="min(26vw, 13vh)" />
        <div>
          <motion.p
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.15 }}
            className="font-display text-[84px] font-extrabold leading-none tracking-[-0.05em]"
          >
            {n}
          </motion.p>
          <p className="text-sm uppercase tracking-[0.2em] opacity-60">day streak</p>
        </div>
      </div>

      <div className="mx-auto mt-7 grid w-full max-w-sm grid-cols-7 gap-3 px-7">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => (
          <span key={i} className="text-center text-[11px] opacity-40">
            {x}
          </span>
        ))}
        {cells.map((k, i) => {
          const future = k > today
          return (
            <motion.button
              key={k}
              aria-label={k}
              disabled={future}
              onClick={() => (voice.tap(), setSel(k))}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: future ? 0.15 : 1 }}
              whileTap={{ scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.1 + i * 0.012 }}
              className="relative grid aspect-square place-items-center"
            >
              <span className="h-full w-full rounded-full" style={dot(data.days[k])} />
              {k === sel && <motion.span layoutId="sel" className="absolute -inset-1 rounded-full border-2" style={{ borderColor: 'var(--glow)' }} />}
              {k === today && k !== sel && <span className="absolute -inset-1 rounded-full border border-white/30" />}
            </motion.button>
          )
        })}
      </div>

      <div className="safe-bottom mt-auto px-5">
        <motion.div key={sel} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass mx-auto max-w-sm rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] opacity-50">{label}</p>
          {d?.oneThing ? (
            <>
              <p className="quote font-display mt-2 text-2xl font-bold leading-tight">{d.oneThing}</p>
              <p className="mt-2 text-[15px] opacity-75">{d.summary ?? 'Morning done. Evening skipped.'}</p>
            </>
          ) : (
            <p className="mt-2 text-[15px] opacity-60">{counts(d) ? 'Checked in.' : 'Nothing logged.'}</p>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}

// ---------------- settings ----------------
export function SettingsScreen({
  data,
  onBack,
  onChange,
  onDemo,
  onReset,
}: {
  data: Data
  onBack: () => void
  onChange: (fn: (d: Data) => Data) => void
  onDemo: () => void
  onReset: () => void
}) {
  const [voices, setVoices] = useState(voice.getVoices())
  const [confirm, setConfirm] = useState(false)
  useEffect(() => voice.onVoicesChanged(() => setVoices(voice.getVoices())), [])
  const lang = navigator.language?.slice(0, 2) || 'en'
  const list = [...voices].sort((a, b) => Number(b.lang.startsWith(lang)) - Number(a.lang.startsWith(lang)) || a.name.localeCompare(b.name))
  const s = data.settings
  const setS = (patch: Partial<Settings>) => onChange((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  const p = data.profile

  const test = () => {
    voice.unlockSpeech()
    voice.stopSpeaking()
    const ctl = new AbortController()
    voice.speak(p ? `Hey. You're [[${p.best}]].` : "Hey. It's me.", { voiceURI: s.voiceURI, muted: s.muted, signal: ctl.signal, onProgress: () => {} })
  }

  return (
    <motion.div {...fade} className="fixed inset-0 z-10 flex flex-col">
      <Header left={<Back onClick={onBack} />} title="Settings" />
      <div className="safe-bottom flex-1 space-y-4 overflow-y-auto px-5 pt-3">
        {p && (
          <Card title="Who you are">
            {(
              [
                ['best', 'At my best'],
                ['want', 'What I want most'],
                ['why', 'Why it matters'],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] opacity-50">{l}</span>
                <textarea
                  rows={2}
                  className="field"
                  value={p[k]}
                  onChange={(e) => onChange((d) => ({ ...d, profile: { ...d.profile!, [k]: e.target.value } }))}
                />
              </label>
            ))}
          </Card>
        )}

        <Card title="Voice">
          <select
            className="field appearance-none"
            value={s.muted ? '__silent' : (s.voiceURI ?? '')}
            onChange={(e) => (e.target.value === '__silent' ? setS({ muted: true }) : setS({ muted: false, voiceURI: e.target.value || null }))}
          >
            <option value="">Default voice</option>
            <option value="__silent">Silent (captions only)</option>
            {list.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} · {v.lang}
              </option>
            ))}
          </select>
          <Btn onClick={test} className="glass w-full rounded-2xl py-3 font-semibold">
            Test voice
          </Btn>
        </Card>

        <Card title="Time of day">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/25 p-1">
            {(['auto', 'morning', 'evening'] as const).map((v) => (
              <Btn key={v} onClick={() => setS({ phase: v })} className="relative rounded-xl py-2.5 text-sm font-semibold capitalize">
                {s.phase === v && <motion.span layoutId="seg" className="absolute inset-0 rounded-xl bg-white/15" />}
                <span className="relative">{v}</span>
              </Btn>
            ))}
          </div>
        </Card>

        <Card title="Data">
          <Btn onClick={onDemo} className="glass w-full rounded-2xl py-3 font-semibold">
            Add demo history
          </Btn>
          <Btn
            onClick={() => (confirm ? onReset() : setConfirm(true))}
            className="w-full rounded-2xl border border-red-400/40 py-3 font-semibold text-red-300"
          >
            {confirm ? 'Tap again to erase everything' : 'Reset all data'}
          </Btn>
        </Card>
        <p className="pb-4 text-center text-xs opacity-40">Everything stays on this phone.</p>
      </div>
    </motion.div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass space-y-3 rounded-3xl p-4">
      <h3 className="font-display text-[15px] font-semibold opacity-80">{title}</h3>
      {children}
    </section>
  )
}
