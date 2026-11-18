import { useEffect, useRef } from 'react'
import { priceOf } from '../engine/model'
import { SCENARIO } from '../engine/scenario'
import { ShopSim, type Outcome } from '../engine/sim'
import type { Decision, Drink, RoundSpec } from '../engine/types'
import { useGame } from '../store/game'
import { SECONDS_PER_HOUR, useLive } from '../store/live'

const W = 900
const H = 420
const LANE_Y = 362
const EXIT_LANE_Y = 408
const SERVE_X = 598
const SCALE = 1.12

export const COLORS = {
  hot: '#eb6834',
  cold: '#2a78d6',
  ink: '#2a1d17',
  chalk: '#eceee4',
  board: '#22302a',
  cherry: '#c8283b',
  marigold: '#f2b134',
  good: '#0ca30c',
  critical: '#d03b3b',
  warning: '#fab219',
  muted: '#898781',
}

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673d']
const SHIRT = ['#5b7bb5', '#c8283b', '#6f9c62', '#8a68a8', '#e0a526', '#4d5a68', '#2f8f8a', '#e07a5f']
const PANTS = ['#2f3e5c', '#2b2b2b', '#6b5a45', '#40514a']
const HAIR = ['#2a1a12', '#5a3820', '#c99a5b', '#1b1b1b', '#8a4b2a']

interface Sprite {
  id: number
  x: number
  y: number
  tx: number
  ty: number
  drink: Drink
  cups: number
  /** 'line' mirrors the queue; 'toCounter' is already served but still walking up; 'exit' is leaving. */
  phase: 'line' | 'toCounter' | 'exit'
  outcome?: Outcome
  bornAt: number
  walk: number
}

export function ShopScene({ r, decision, seed }: { r: RoundSpec; decision: Decision; seed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    let scale = 1
    let lastW = -1

    const resize = () => {
      const cssW = wrap.clientWidth
      if (cssW === lastW) return
      lastW = cssW
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(((cssW * H) / W) * dpr)
      scale = (cssW * dpr) / W
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const sim = new ShopSim(r, decision, seed, SCENARIO.hours)
    const sprites = new Map<number, Sprite>()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let last = performance.now()
    let lastPublish = 0
    let raf = 0

    const publish = () =>
      useLive.getState().publish({
        metrics: sim.metrics(),
        stock: { ...sim.stock },
        inShop: sim.inShop,
        profitByHour: [...sim.profitByHour],
      })

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const { speed } = useLive.getState()
      const paused = useLive.getState().paused || useGame.getState().introOpen
      const fast = speed >= 20 || reduce

      if (!paused && !sim.done) {
        const departures = sim.advance(sim.t + (dt * speed) / SECONDS_PER_HOUR)
        for (const d of departures) {
          const s = sprites.get(d.customer.id)
          if (fast) {
            sprites.delete(d.customer.id)
            continue
          }
          if (s) {
            s.outcome = d.outcome
            s.phase = 'toCounter'
            s.tx = SERVE_X
            s.ty = LANE_Y
          } else if (d.outcome === 'balked') {
            sprites.set(d.customer.id, {
              id: d.customer.id,
              x: 70,
              y: LANE_Y,
              tx: 40,
              ty: EXIT_LANE_Y,
              drink: d.customer.drink,
              cups: d.customer.cups,
              phase: 'exit',
              outcome: 'balked',
              bornAt: now,
              walk: 0,
            })
          }
        }
      }

      const line = sim.inService ? [sim.inService, ...sim.queue] : sim.queue
      const spacing = Math.min(34, (SERVE_X - 40 - 110) / Math.max(1, line.length - 1))
      line.forEach((c, i) => {
        let s = sprites.get(c.id)
        if (!s) {
          s = { id: c.id, x: fast ? 0 : -24, y: LANE_Y, tx: 0, ty: 0, drink: c.drink, cups: c.cups, phase: 'line', bornAt: now, walk: 0 }
          sprites.set(c.id, s)
        }
        s.tx = c === sim.inService ? SERVE_X : SERVE_X - 40 - (sim.inService ? i - 1 : i) * spacing
        s.ty = LANE_Y
      })

      const step = 250 * Math.min(speed, 4) * dt
      for (const s of sprites.values()) {
        if (fast) {
          s.x = s.tx
          s.y = s.ty
        } else {
          const dx = s.tx - s.x
          const dy = s.ty - s.y
          const dist = Math.hypot(dx, dy)
          if (dist <= step) {
            s.x = s.tx
            s.y = s.ty
          } else {
            s.x += (dx / dist) * step
            s.y += (dy / dist) * step
            s.walk += step
          }
        }
        const arrived = s.x === s.tx && s.y === s.ty
        if (s.phase === 'toCounter' && arrived) {
          s.phase = 'exit'
          s.tx = SERVE_X - 12
          s.ty = EXIT_LANE_Y
        } else if (s.phase === 'exit' && arrived && s.tx !== -40) {
          s.tx = -40
          s.ty = EXIT_LANE_Y
        }
        if ((s.phase === 'exit' && s.x <= -39) || now - s.bornAt > 60000) sprites.delete(s.id)
      }

      draw(ctx, scale, r, decision, sim, [...sprites.values()])
      if (now - lastPublish > 200 || sim.done) {
        publish()
        lastPublish = now
      }
      raf = requestAnimationFrame(frame)
    }
    publish()
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // decision fields are listed individually so a new object with equal values does not restart the shop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, decision.hot, decision.cold, decision.markup, decision.service, seed])

  return (
    <div ref={wrapRef} className="w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Animated coffee shop: customers come in the door, queue at the counter and leave with or without their drink. The window shows the time of day. Live numbers are on the till below."
        className="block w-full"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
    </div>
  )
}

// ── Time of day ───────────────────────────────────────────────────────────────

type RGB = [number, number, number]
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a: RGB, b: RGB, t: number): string =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`

const SKY: [number, string, string][] = [
  [0, '#0b1433', '#1d2a55'],
  [5, '#141c45', '#353a6e'],
  [6.5, '#3f4a8a', '#f2b48c'],
  [8.5, '#7fb6e6', '#cfe6f5'],
  [16, '#6fb0e6', '#cfe8f7'],
  [18.5, '#4a5fa8', '#f0a072'],
  [20.5, '#1e2458', '#3f3766'],
  [24, '#0b1433', '#1d2a55'],
]

function skyAt(h: number): { top: string; bottom: string; night: number } {
  let i = 0
  while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++
  const [h0, t0, b0] = SKY[i]
  const [h1, t1, b1] = SKY[i + 1]
  const t = (h - h0) / (h1 - h0)
  const night = h < 5 || h > 20.5 ? 1 : h < 8 ? 1 - (h - 5) / 3 : h > 17.5 ? (h - 17.5) / 3 : 0
  return { top: mix(hex(t0), hex(t1), t), bottom: mix(hex(b0), hex(b1), t), night: Math.max(0, Math.min(1, night)) }
}

const STARS = Array.from({ length: 26 }, (_, i) => [(i * 97) % 330, (i * 53) % 90, (i % 3) + 1] as const)
const BUILDINGS = [
  [0, 70, 46],
  [48, 110, 38],
  [88, 60, 52],
  [142, 128, 40],
  [184, 84, 58],
  [244, 104, 36],
  [282, 72, 48],
] as const

// ── Drawing ───────────────────────────────────────────────────────────────────

function draw(ctx: CanvasRenderingContext2D, scale: number, r: RoundSpec, x: Decision, sim: ShopSim, sprites: Sprite[]) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, W, H)
  const hour = sim.t % 24
  const sky = skyAt(hour)

  // Wall, tiles and floor
  ctx.fillStyle = '#eef1ea'
  ctx.fillRect(0, 0, W, 214)
  ctx.fillStyle = '#a8cf9b'
  ctx.fillRect(0, 214, W, 58)
  ctx.strokeStyle = '#93bd86'
  ctx.lineWidth = 1
  for (let ty = 214; ty < 272; ty += 14.5) line(ctx, 0, ty, W, ty)
  for (let tx = 0; tx < W; tx += 29) for (let row = 0; row < 4; row++) line(ctx, tx + (row % 2) * 14.5, 214 + row * 14.5, tx + (row % 2) * 14.5, 228.5 + row * 14.5)
  ctx.fillStyle = '#2a1d17'
  ctx.fillRect(0, 270, W, 5)
  ctx.fillStyle = '#c79a6c'
  ctx.fillRect(0, 275, W, H - 275)
  ctx.strokeStyle = '#b6895c'
  for (let fy = 275; fy < H; fy += 18) line(ctx, 0, fy, W, fy)
  for (let fy = 275, k = 0; fy < H; fy += 18, k++) for (let fx = (k % 2) * 60; fx < W; fx += 120) line(ctx, fx, fy, fx, fy + 18)

  // Window onto the street: the sky follows the simulated clock
  const wx = 262
  const wy = 24
  const ww = 340
  const wh = 172
  ctx.save()
  ctx.beginPath()
  ctx.rect(wx, wy, ww, wh)
  ctx.clip()
  const g = ctx.createLinearGradient(0, wy, 0, wy + wh)
  g.addColorStop(0, sky.top)
  g.addColorStop(1, sky.bottom)
  ctx.fillStyle = g
  ctx.fillRect(wx, wy, ww, wh)
  ctx.fillStyle = `rgba(255,255,240,${0.85 * sky.night})`
  for (const [sx, sy, sr] of STARS) ctx.fillRect(wx + 6 + sx, wy + 6 + sy, sr, sr)
  if (hour >= 6 && hour <= 19) {
    const p = (hour - 6) / 13
    ctx.fillStyle = '#ffd25e'
    disc(ctx, wx + 20 + p * (ww - 40), wy + wh - 30 - Math.sin(Math.PI * p) * 118, 14)
  } else {
    const p = ((hour + 24 - 19) % 24) / 11
    ctx.fillStyle = '#f3f1dd'
    disc(ctx, wx + 20 + p * (ww - 40), wy + wh - 30 - Math.sin(Math.PI * p) * 110, 11)
    ctx.fillStyle = sky.top
    disc(ctx, wx + 25 + p * (ww - 40), wy + wh - 33 - Math.sin(Math.PI * p) * 110, 9)
  }
  const bldg = mix(hex('#7d8fa8'), hex('#1a2038'), sky.night)
  for (const [bx, bh, bw] of BUILDINGS) {
    ctx.fillStyle = bldg
    ctx.fillRect(wx + bx, wy + wh - bh * 0.7, bw, bh)
    ctx.fillStyle = `rgba(255,214,110,${0.9 * sky.night})`
    for (let lx = 6; lx < bw - 6; lx += 10) for (let ly = 10; ly < bh * 0.7 - 6; ly += 12) if ((bx + lx + ly) % 3) ctx.fillRect(wx + bx + lx, wy + wh - bh * 0.7 + ly, 4, 5)
  }
  ctx.restore()
  ctx.strokeStyle = '#2a1d17'
  ctx.lineWidth = 7
  ctx.strokeRect(wx, wy, ww, wh)
  ctx.lineWidth = 5
  line(ctx, wx + ww / 3, wy, wx + ww / 3, wy + wh)
  line(ctx, wx + (2 * ww) / 3, wy, wx + (2 * ww) / 3, wy + wh)
  ctx.fillStyle = '#c79a6c'
  ctx.fillRect(wx - 10, wy + wh, ww + 20, 9)

  // Neon sign, brighter after dark
  ctx.save()
  ctx.font = '22px "Lilita One", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.shadowColor = COLORS.marigold
  ctx.shadowBlur = 4 + 18 * sky.night
  ctx.fillStyle = sky.night > 0.3 ? '#ffd56b' : '#d9a23a'
  ctx.fillText('Open 24h', wx + ww - 70, wy + wh - 14)
  ctx.restore()

  // Pendant lamps
  for (const lx of [210, 650]) {
    ctx.strokeStyle = '#2a1d17'
    ctx.lineWidth = 2
    line(ctx, lx, 0, lx, 34)
    ctx.fillStyle = '#c8283b'
    ctx.beginPath()
    ctx.moveTo(lx - 18, 50)
    ctx.lineTo(lx + 18, 50)
    ctx.lineTo(lx + 8, 34)
    ctx.lineTo(lx - 8, 34)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,214,110,0.9)'
    disc(ctx, lx, 52, 5)
    const glow = ctx.createRadialGradient(lx, 60, 2, lx, 60, 70)
    glow.addColorStop(0, `rgba(255,214,110,${0.18 + 0.2 * sky.night})`)
    glow.addColorStop(1, 'rgba(255,214,110,0)')
    ctx.fillStyle = glow
    ctx.fillRect(lx - 70, 40, 140, 100)
  }

  // Chalk menu with this round's real prices
  roundRect(ctx, 54, 58, 160, 132, 6, '#8a5a35')
  roundRect(ctx, 61, 65, 146, 118, 4, COLORS.board)
  ctx.fillStyle = COLORS.chalk
  ctx.textAlign = 'center'
  ctx.font = '20px "Lilita One", system-ui, sans-serif'
  ctx.fillText('Menu', 134, 90)
  ctx.textAlign = 'left'
  ctx.font = '700 14px Lexend, system-ui, sans-serif'
  const items: [string, string][] = [['Hot coffee', `$${priceOf(r, 'hot', x.markup).toFixed(2)}`]]
  if (r.drinks.cold.psi > 0) items.push(['Cold coffee', `$${priceOf(r, 'cold', x.markup).toFixed(2)}`])
  items.forEach(([name, price], i) => {
    ctx.fillStyle = COLORS.chalk
    ctx.fillText(name, 72, 116 + i * 24)
    ctx.textAlign = 'right'
    ctx.fillText(price, 197, 116 + i * 24)
    ctx.textAlign = 'left'
  })
  if (r.orders) {
    ctx.font = '12px Lexend, system-ui, sans-serif'
    ctx.fillStyle = '#b4bfb6'
    ctx.fillText('Groups welcome', 72, 172)
  }

  // Door with the same sky through its glass
  roundRect(ctx, 0, 118, 52, 154, 3, '#8a5a35')
  const dg = ctx.createLinearGradient(0, 128, 0, 200)
  dg.addColorStop(0, sky.top)
  dg.addColorStop(1, sky.bottom)
  ctx.fillStyle = dg
  ctx.fillRect(7, 128, 38, 70)
  ctx.fillStyle = '#f2b134'
  disc(ctx, 40, 230, 3.5)

  // BrewBot station with live stock
  roundRect(ctx, 692, 54, 190, 200, 14, '#3b2a22')
  roundRect(ctx, 700, 62, 174, 26, 8, '#2a1d17')
  ctx.fillStyle = COLORS.marigold
  ctx.font = '18px "Lilita One", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('BrewBot', 787, 81)
  tank(ctx, 712, 'hot', sim.stock.hot, x.hot, r.drinks.hot.psi > 0)
  tank(ctx, 800, 'cold', sim.stock.cold, x.cold, r.drinks.cold.psi > 0)

  // Barista behind the counter
  const busy = sim.inService !== null
  const by = 318
  person(ctx, 652, by, { skin: '#e0ac69', shirt: '#ffffff', pants: '#2a1d17', hair: '#2a1a12', style: 1 }, 1.2, 0)
  ctx.fillStyle = COLORS.cherry
  ctx.beginPath()
  ctx.roundRect(641, by - 70, 22, 40, 4)
  ctx.fill()
  if (busy) {
    ctx.strokeStyle = '#2a1d17'
    ctx.lineWidth = 2
    for (const dx of [-26, 26]) line(ctx, 652 + dx, by - 104, 652 + dx * 1.3, by - 111)
  }

  // Counter
  roundRect(ctx, 630, 282, 270, 90, 4, COLORS.cherry)
  ctx.fillStyle = '#e04a5b'
  ctx.fillRect(630, 300, 270, 6)
  roundRect(ctx, 622, 270, 282, 16, 4, '#c79a6c')
  ctx.fillStyle = '#a97a4d'
  ctx.fillRect(622, 282, 282, 4)

  // Customers, back of the line first
  sprites.sort((a, b) => a.y - b.y || b.x - a.x)
  for (const s of sprites) {
    const look = {
      skin: SKIN[s.id % SKIN.length],
      shirt: SHIRT[(s.id * 7) % SHIRT.length],
      pants: PANTS[(s.id * 3) % PANTS.length],
      hair: HAIR[(s.id * 5) % HAIR.length],
      style: s.id % 3,
    }
    ctx.globalAlpha = s.outcome === 'balked' ? 0.75 : 1
    person(ctx, s.x, s.y, look, SCALE, s.walk)
    ctx.globalAlpha = 1
    const top = s.y - 104 * SCALE
    if (s.phase !== 'exit') bubble(ctx, s.x + 12, top, () => cup(ctx, s.x + 12, top, s.drink, s.cups))
    else if (s.outcome === 'served') {
      cup(ctx, s.x + 17, s.y - 46 * SCALE, s.drink, 1, 0.7)
      badge(ctx, s.x, top + 8, COLORS.good, '✓')
    } else if (s.outcome === 'partial') badge(ctx, s.x, top + 8, COLORS.warning, '½', '#2a1d17')
    else if (s.outcome === 'stockout') badge(ctx, s.x, top + 8, COLORS.critical, '✗')
    else badge(ctx, s.x, top + 8, COLORS.muted, '…')
  }

  if (sim.done) {
    ctx.fillStyle = 'rgba(34,48,42,0.82)'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = COLORS.chalk
    ctx.textAlign = 'center'
    ctx.font = '34px "Lilita One", system-ui, sans-serif'
    ctx.fillText('That’s the week', W / 2, H / 2 - 8)
    ctx.font = '17px Lexend, system-ui, sans-serif'
    ctx.fillText('Try another plan, or submit this one to be scored on a fresh week', W / 2, H / 2 + 24)
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number) {
  ctx.beginPath()
  ctx.arc(x, y, rad, 0, Math.PI * 2)
  ctx.fill()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, rad)
  ctx.fill()
}

function tank(ctx: CanvasRenderingContext2D, x: number, d: Drink, stock: number, brewed: number, active: boolean) {
  const top = 98
  const h = 112
  roundRect(ctx, x, top, 70, h, 10, '#1a120e')
  roundRect(ctx, x + 4, top + 4, 62, h - 8, 8, 'rgba(255,255,255,0.08)')
  if (active && brewed > 0) {
    const frac = Math.max(0, Math.min(1, stock / brewed))
    const fh = (h - 12) * frac
    roundRect(ctx, x + 6, top + h - 6 - fh, 58, fh, 6, COLORS[d])
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(x + 12, top + 10, 5, h - 24)
  ctx.textAlign = 'center'
  ctx.font = '15px "Lilita One", system-ui, sans-serif'
  ctx.fillStyle = COLORS.chalk
  ctx.fillText(d === 'hot' ? 'Hot' : 'Cold', x + 35, top + h + 18)
  ctx.font = '700 17px Lexend, system-ui, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(active ? `${stock} left` : 'off', x + 35, top + h + 37)
}

interface Look {
  skin: string
  shirt: string
  pants: string
  hair: string
  style: number
}

/** A person standing with feet at (x, y). `walk` drives the leg swing. */
function person(ctx: CanvasRenderingContext2D, x: number, y: number, k: Look, s: number, walk: number) {
  const swing = Math.sin(walk / 7) * 4 * s
  ctx.fillStyle = 'rgba(42,29,23,0.18)'
  ctx.beginPath()
  ctx.ellipse(x, y + 2, 15 * s, 4 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = k.pants
  ctx.beginPath()
  ctx.roundRect(x - 9 * s + swing * 0.3, y - 30 * s, 8 * s, 30 * s, 3 * s)
  ctx.roundRect(x + 1 * s - swing * 0.3, y - 30 * s, 8 * s, 30 * s, 3 * s)
  ctx.fill()
  ctx.fillStyle = k.shirt
  ctx.beginPath()
  ctx.roundRect(x - 13 * s, y - 66 * s, 26 * s, 40 * s, [10 * s, 10 * s, 4 * s, 4 * s])
  ctx.fill()
  ctx.fillStyle = k.skin
  ctx.beginPath()
  ctx.roundRect(x - 17 * s, y - 60 * s + swing * 0.2, 6 * s, 26 * s, 3 * s)
  ctx.roundRect(x + 11 * s, y - 60 * s - swing * 0.2, 6 * s, 26 * s, 3 * s)
  ctx.fill()
  disc(ctx, x, y - 78 * s, 12 * s)
  ctx.fillStyle = k.hair
  ctx.beginPath()
  if (k.style === 0) ctx.arc(x, y - 81 * s, 12.5 * s, Math.PI, 0)
  else if (k.style === 1) {
    ctx.arc(x, y - 80 * s, 13 * s, Math.PI * 0.95, Math.PI * 0.05)
    ctx.rect(x - 13 * s, y - 80 * s, 5 * s, 14 * s)
  } else {
    ctx.arc(x, y - 81 * s, 12.5 * s, Math.PI, 0)
    ctx.arc(x + 2 * s, y - 94 * s, 6 * s, 0, Math.PI * 2)
  }
  ctx.fill()
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, inner: () => void) {
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(42,29,23,0.3)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(x, y, 19, 15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x - 10, y + 19, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  inner()
}

function cup(ctx: CanvasRenderingContext2D, x: number, y: number, d: Drink, cups: number, s = 1) {
  ctx.fillStyle = COLORS[d]
  ctx.beginPath()
  if (d === 'hot') {
    ctx.moveTo(x - 7 * s, y - 4 * s)
    ctx.lineTo(x + 7 * s, y - 4 * s)
    ctx.lineTo(x + 5 * s, y + 8 * s)
    ctx.lineTo(x - 5 * s, y + 8 * s)
  } else {
    ctx.moveTo(x - 5.5 * s, y - 7 * s)
    ctx.lineTo(x + 5.5 * s, y - 7 * s)
    ctx.lineTo(x + 4 * s, y + 9 * s)
    ctx.lineTo(x - 4 * s, y + 9 * s)
  }
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 1.4
  if (d === 'hot') {
    ctx.strokeStyle = COLORS.muted
    ctx.beginPath()
    ctx.moveTo(x - 2 * s, y - 7 * s)
    ctx.quadraticCurveTo(x, y - 10 * s, x - 1 * s, y - 13 * s)
    ctx.moveTo(x + 3 * s, y - 7 * s)
    ctx.quadraticCurveTo(x + 5 * s, y - 10 * s, x + 4 * s, y - 13 * s)
    ctx.stroke()
  } else {
    ctx.strokeStyle = COLORS.ink
    line(ctx, x + 1 * s, y - 7 * s, x + 4 * s, y - 14 * s)
  }
  if (cups > 1) {
    ctx.fillStyle = COLORS.ink
    ctx.font = '700 11px Lexend, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`×${cups}`, x + 8, y + 9)
  }
}

function badge(ctx: CanvasRenderingContext2D, x: number, y: number, fill: string, text: string, ink = '#ffffff') {
  ctx.fillStyle = fill
  disc(ctx, x, y, 11)
  ctx.fillStyle = ink
  ctx.font = '700 13px Lexend, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + 0.5)
  ctx.textBaseline = 'alphabetic'
}
