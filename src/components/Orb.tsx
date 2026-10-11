import { motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { orb } from '../lib/voice'
import type { Phase } from '../lib/store'

// Palettes: [deep, mid, highlight]
export const PALETTES: Record<Phase, [string, string, string]> = {
  morning: ['#ff7a3d', '#ff5f8a', '#ffc46b'],
  evening: ['#3b2bd9', '#9b5cff', '#5ec8ff'],
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`

const FRAG = `
precision mediump float;
uniform vec2 uRes; uniform float uT, uE, uL;
uniform vec3 uA, uB, uC;

vec3 perm(vec3 x){ return mod(((x*34.)+1.)*x, 289.); }
float snoise(vec2 v){
  const vec4 C = vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.,0.) : vec2(0.,1.);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.);
  vec3 p = perm(perm(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
  vec3 m = max(.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.); m = m*m; m = m*m;
  vec3 x = 2.*fract(p*C.www) - 1.; vec3 h = abs(x) - .5; vec3 a0 = x - floor(x + .5);
  m *= 1.79284291400159 - .85373472095314*(a0*a0 + h*h);
  vec3 g; g.x = a0.x*x0.x + h.x*x0.y; g.yz = a0.yz*x12.xz + h.yz*x12.yw;
  return 130.*dot(m, g);
}
float fbm(vec2 p){ return .55*snoise(p) + .3*snoise(p*2.1+7.3) + .15*snoise(p*4.3-3.1); }

void main(){
  vec2 p = (gl_FragCoord.xy - .5*uRes) / (.5*min(uRes.x, uRes.y));
  float r = length(p); float ang = atan(p.y, p.x); float t = uT;

  // living edge: breathes at rest, swells with each spoken word
  float R = .5 + .012*sin(t*.9) + .06*uE;
  R += snoise(vec2(cos(ang)*.7 + t*.16, sin(ang)*.7 - t*.12)) * (.022 + .03*uE + .015*uL);
  float d = r - R;

  // interior: domain-warped flow
  float z = sqrt(max(R*R - r*r, 0.));
  vec2 q = p*1.05 / (.65 + z);
  vec2 w = vec2(fbm(q + vec2(t*.07, -t*.05)), fbm(q + vec2(5.2 - t*.06, 1.3 + t*.04)));
  float n = fbm(q + 1.7*w + t*.03);
  vec3 col = mix(uA, uB, smoothstep(-.5, .55, n));
  col = mix(col, uC, smoothstep(.15, .85, w.x + .25*n) * .85);
  vec3 nrm = normalize(vec3(p, z + .001));
  col *= .62 + .5*max(dot(nrm, normalize(vec3(-.45, .55, .75))), 0.);
  col += pow(max(dot(nrm, normalize(vec3(-.35, .5, .8))), 0.), 24.) * .35;
  float rim = pow(1. - clamp(z / max(R, .001), 0., 1.), 2.5);
  col += rim * mix(uC, vec3(1.), .25) * (.55 + .4*uE);
  col *= 1. + .25*uE;
  float inside = smoothstep(.008, -.008, d);

  // halo
  float halo = exp(-max(d, 0.)*5.5) * (.32 + .45*uE + .15*uL);
  vec3 haloCol = mix(uB, uC, .4) * halo;
  float haloA = halo * .75;

  // listening ripples
  float ring = 0.;
  for (int i = 0; i < 3; i++) {
    float ph = fract(t*.42 + float(i)/3.);
    float rr = R + .02 + ph*.42;
    ring += smoothstep(.022, 0., abs(r - rr)) * (1. - ph) * (1. - ph);
  }
  ring *= uL;
  haloCol += uC * ring * .9; haloA = clamp(haloA + ring*.8, 0., 1.);

  vec3 c = mix(haloCol, col, inside);
  float a = mix(haloA, 1., inside);
  gl_FragColor = vec4(c, a);
}`

function Orb({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const target = useRef(phase)
  target.current = phase
  const fallback = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
    if (!gl) {
      canvas.style.display = 'none'
      if (fallback.current) fallback.current.style.display = 'block'
      return
    }
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const U = (n: string) => gl.getUniformLocation(prog, n)
    const [uRes, uT, uE, uL, uA, uB, uC] = ['uRes', 'uT', 'uE', 'uL', 'uA', 'uB', 'uC'].map(U)

    const cols = PALETTES[target.current].map(hex)
    let raf = 0
    let t = Math.random() * 100
    let last = performance.now()
    let listenAmt = 0
    let energy = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const speed = reduced ? 0.25 : orb.mode === 'thinking' ? 1.8 : 1
      t += dt * speed
      // energy: spikes per word, decays smoothly
      orb.energy = Math.max(0, orb.energy - dt * 2.4)
      energy += ((reduced ? orb.energy * 0.3 : orb.energy) - energy) * Math.min(1, dt * 14)
      listenAmt += ((orb.mode === 'listening' && !reduced ? 1 : 0) - listenAmt) * Math.min(1, dt * 3)
      const goal = PALETTES[target.current].map(hex)
      cols.forEach((c, i) => c.forEach((v, j) => (c[j] = v + (goal[i][j] - v) * Math.min(1, dt * 1.2))))
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uT, t)
      gl.uniform1f(uE, Math.min(energy, 1))
      gl.uniform1f(uL, listenAmt)
      gl.uniform3fv(uA, cols[0])
      gl.uniform3fv(uB, cols[1])
      gl.uniform3fv(uC, cols[2])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }
    const vis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', vis)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', vis)
    }
  }, [reduced])

  const [a, b, c] = PALETTES[phase]
  return (
    <div className="relative h-full w-full">
      <canvas ref={ref} className="h-full w-full" />
      <div
        ref={fallback}
        className="absolute inset-[22%] hidden rounded-full"
        style={{ background: `radial-gradient(circle at 35% 30%, ${c}, ${b} 55%, ${a})`, boxShadow: `0 0 80px ${b}` }}
      />
    </div>
  )
}

// ---------- one persistent orb, flying to whichever screen's slot is on top ----------
// Screens drop an <OrbSlot/> where the orb should sit. The newest mounted slot wins.

const SLOT = 'min(66vw, 34vh)'
const HALO = 1.7 // canvas is bigger than the slot so the glow has room
type Rect = { x: number; y: number; size: number }
const slots: HTMLElement[] = []
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())

function slotRect(): Rect | null {
  const el = slots[slots.length - 1]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width }
}

export function OrbSlot({ label, onClick, size = SLOT }: { label?: string; onClick?: () => void; size?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    slots.push(el)
    notify()
    const ro = new ResizeObserver(notify)
    ro.observe(el)
    return () => {
      slots.splice(slots.indexOf(el), 1)
      ro.disconnect()
      notify()
    }
  }, [])
  return (
    <button
      ref={ref}
      aria-label={label}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
      className="mx-auto block shrink-0 rounded-full outline-none"
      style={{ width: size, height: size, marginTop: 'max(2vh, 8px)', cursor: onClick ? 'pointer' : 'default' }}
    />
  )
}

export function OrbStage({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const [rect, setRect] = useState<Rect | null>(null)
  const [base, setBase] = useState(0)
  useEffect(() => {
    const f = () => {
      setBase(Math.min(innerWidth * 0.66, innerHeight * 0.34) * HALO)
      setRect(slotRect())
    }
    subs.add(f)
    addEventListener('resize', f)
    f()
    return () => {
      subs.delete(f)
      removeEventListener('resize', f)
    }
  }, [])
  if (!base) return null
  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-0"
      style={{ width: base, height: base }}
      initial={false}
      animate={rect ? { x: rect.x - base / 2, y: rect.y - base / 2, scale: (rect.size * HALO) / base, opacity: 1 } : { opacity: 0 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 18, opacity: { duration: 0.35 } }}
    >
      <Orb phase={phase} reduced={reduced} />
    </motion.div>
  )
}
