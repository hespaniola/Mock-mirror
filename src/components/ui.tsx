import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'
import type { Phase } from '../lib/store'
import { tap, type Chunk } from '../lib/voice'

// ---------- background: two palettes crossfading, slow drifting light ----------
const BG: Record<Phase, { base: string; blobs: [string, string, string] }> = {
  morning: { base: '#140a0d', blobs: ['rgba(255,140,60,.38)', 'rgba(255,90,120,.30)', 'rgba(255,196,120,.22)'] },
  evening: { base: '#07061a', blobs: ['rgba(70,50,220,.40)', 'rgba(150,80,255,.28)', 'rgba(60,150,255,.18)'] },
}
const POS = [
  { left: '-60vmax', top: '-70vmax' },
  { right: '-75vmax', top: '-20vmax' },
  { left: '-50vmax', bottom: '-85vmax' },
]

export function Background({ phase }: { phase: Phase }) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ background: '#0a0712' }}>
      {(Object.keys(BG) as Phase[]).map((p) => (
        <div key={p} className="bg-layer" style={{ opacity: p === phase ? 1 : 0, background: BG[p].base }}>
          {BG[p].blobs.map((c, i) => (
            <div key={i} className="blob" style={{ ...POS[i], background: `radial-gradient(circle, ${c} 0%, transparent 62%)` }} />
          ))}
        </div>
      ))}
      <div className="grain" />
    </div>
  )
}

// ---------- springy button ----------
export function Btn({ children, onClick, className = '', ...rest }: HTMLMotionProps<'button'> & { children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 600, damping: 20 }}
      onClick={(e) => {
        tap()
        onClick?.(e)
      }}
      className={`cursor-pointer select-none outline-none ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

// ---------- captions: current sentence, word by word, user's words glowing ----------
export function Captions({ chunk, shown, k, dim }: { chunk?: Chunk; shown: number; k: string; dim?: boolean }) {
  const len = chunk?.words.length ?? 0
  const size = len > 12 ? 'text-[28px]' : len > 7 ? 'text-[32px]' : 'text-[38px]'
  return (
    <AnimatePresence mode="wait">
      {chunk && (
        <motion.p
          key={k}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
          transition={{ duration: 0.3 }}
          animate={{ opacity: dim ? 0.55 : 1, scale: dim ? 0.92 : 1 }}
          className={`font-display ${size} text-center font-semibold leading-[1.12] tracking-[-0.02em]`}
        >
          {chunk.words.map((w, i) => [
            i > 0 && ' ',
            <motion.span
              key={i}
              className={`inline-block ${w.quoted ? 'quote' : ''}`}
              initial={false}
              animate={i < shown ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 10, filter: 'blur(8px)' }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {w.w}
            </motion.span>,
          ])}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

// ---------- progress dots ----------
export function Dots({ total, at }: { total: number; at: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          layout
          className="h-1.5 rounded-full"
          animate={{ width: i === at ? 22 : 6, opacity: i <= at ? 1 : 0.3, backgroundColor: i < at ? 'var(--glow)' : '#ffffff' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      ))}
    </div>
  )
}

// ---------- reward burst ----------
export function Burst({ big, label, reduced }: { big?: boolean; label?: string; reduced: boolean }) {
  const n = reduced ? 0 : big ? 34 : 20
  const colors = ['var(--glow)', '#ffffff', '#ff8fb1', '#9b8cff']
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      {!reduced && (
        <motion.div
          className="absolute rounded-full border-2"
          style={{ borderColor: 'var(--glow)', width: 120, height: 120 }}
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scale: big ? 6 : 4, opacity: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      )}
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3
        const dist = (big ? 190 : 140) + Math.random() * 90
        const s = 4 + Math.random() * (big ? 9 : 6)
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ width: s, height: s, background: colors[i % colors.length], boxShadow: `0 0 12px ${colors[i % colors.length]}` }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * dist, y: Math.sin(a) * dist + 40, opacity: 0, scale: 0.2 }}
            transition={{ duration: 1.1 + Math.random() * 0.5, ease: [0.1, 0.8, 0.3, 1] }}
          />
        )
      })}
      {label && (
        <motion.div
          className="font-display absolute text-center text-6xl font-extrabold quote"
          initial={{ scale: 0.4, opacity: 0, y: 20 }}
          animate={{ scale: [0.4, 1.15, 1], opacity: [0, 1, 1, 0], y: [20, 0, 0, -30] }}
          transition={{ duration: 2, times: [0, 0.25, 0.75, 1] }}
        >
          {label}
        </motion.div>
      )}
    </div>
  )
}

// ---------- icons ----------
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
export const Icon = {
  fog: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...P}>
      <path d="M3 9c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 15c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
    </svg>
  ),
  mic: () => (
    <svg width="26" height="26" viewBox="0 0 24 24" {...P}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  ),
  keys: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...P}>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
    </svg>
  ),
  send: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...P}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  check: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" {...P}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...P}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  back: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...P}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  days: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...P}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="6" cy="18" r="2" />
    </svg>
  ),
  gear: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...P}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
}
