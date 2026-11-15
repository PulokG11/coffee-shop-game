import { useEffect, useRef } from 'react'
import { SCENARIO } from '../engine/scenario'
import { ShopSim, type Outcome } from '../engine/sim'
import type { Decision, Drink, RoundSpec } from '../engine/types'
import { useGame } from '../store/game'
import { SECONDS_PER_HOUR, useLive } from '../store/live'

const W = 760
const H = 340
const LANE_Y = 268
const SERVE = { x: 528, y: LANE_Y }
const EXIT = { x: -40 }
const DOOR_X = 26

export const COLORS = {
  hot: '#eb6834',
  cold: '#2a78d6',
  ink: '#2e1808',
  muted: '#898781',
  good: '#0ca30c',
  critical: '#d03b3b',
  warning: '#fab219',
}

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673d']
const SHIRT = ['#6c8ebf', '#b85450', '#82b366', '#9673a6', '#d6b656', '#5f6b7a', '#d79b00', '#3f8f8f']

/**
 * 'line': mirrors the simulated queue. 'toCounter': already served in the simulation but still
 * walking up (service can be quicker than the walk). 'exit': leaving with the outcome shown.
 */
interface Sprite {
  id: number
  x: number
  y: number
  tx: number
  ty: number
  drink: Drink
  cups: number
  phase: 'line' | 'toCounter' | 'exit'
  outcome?: Outcome
  bornAt: number
}

const EXIT_LANE_Y = 316

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
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${(cssW * H) / W}px`
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
            s.tx = SERVE.x
            s.ty = LANE_Y
          } else if (d.outcome === 'balked') {
            sprites.set(d.customer.id, {
              id: d.customer.id,
              x: DOOR_X + 40,
              y: LANE_Y,
              tx: DOOR_X + 10,
              ty: EXIT_LANE_Y,
              drink: d.customer.drink,
              cups: d.customer.cups,
              phase: 'exit',
              outcome: 'balked',
              bornAt: now,
            })
          }
        }
      }

      const line = sim.inService ? [sim.inService, ...sim.queue] : sim.queue
      const spacing = Math.min(30, (SERVE.x - 34 - 80) / Math.max(1, line.length - 1))
      line.forEach((c, i) => {
        let s = sprites.get(c.id)
        if (!s) {
          s = { id: c.id, x: fast ? 0 : -20, y: LANE_Y, tx: 0, ty: 0, drink: c.drink, cups: c.cups, phase: 'line', bornAt: now }
          sprites.set(c.id, s)
        }
        const inService = c === sim.inService
        s.tx = inService ? SERVE.x : SERVE.x - 34 - (sim.inService ? i - 1 : i) * spacing
        s.ty = LANE_Y
      })

      const step = 240 * Math.min(speed, 4) * dt
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
          }
        }
        const arrived = s.x === s.tx && s.y === s.ty
        if (s.phase === 'toCounter' && arrived) {
          s.phase = 'exit'
          s.tx = SERVE.x - 10
          s.ty = EXIT_LANE_Y
        } else if (s.phase === 'exit' && arrived && s.tx !== EXIT.x) {
          s.tx = EXIT.x
          s.ty = EXIT_LANE_Y
        }
        if ((s.phase === 'exit' && s.x <= EXIT.x + 1) || now - s.bornAt > 60000) sprites.delete(s.id)
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
        aria-label="Animated coffee shop: customers arrive at the door, queue for the barista and leave with or without their drink. Live numbers are listed below the scene."
        className="block rounded-xl"
      />
    </div>
  )
}

function draw(ctx: CanvasRenderingContext2D, scale: number, r: RoundSpec, x: Decision, sim: ShopSim, sprites: Sprite[]) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, W, H)

  // Wall and floor
  ctx.fillStyle = '#f6e7cf'
  ctx.fillRect(0, 0, W, 190)
  ctx.fillStyle = '#e8d1ab'
  ctx.fillRect(0, 190, W, H - 190)
  ctx.fillStyle = '#e0c69c'
  for (let i = 0; i < W / 40; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) ctx.fillRect(i * 40, 190 + j * 40, 40, 40)
  ctx.fillStyle = '#c9a77a'
  ctx.fillRect(0, 186, W, 4)

  // Window
  roundRect(ctx, 130, 34, 200, 104, 8, '#cfe6f3')
  ctx.strokeStyle = '#8a5a35'
  ctx.lineWidth = 6
  ctx.strokeRect(130, 34, 200, 104)
  ctx.beginPath()
  ctx.moveTo(230, 34)
  ctx.lineTo(230, 138)
  ctx.stroke()

  // Opening-hours sign
  roundRect(ctx, 372, 52, 132, 58, 8, '#2e1808')
  ctx.fillStyle = '#fdf8f0'
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('OPEN 24 h', 438, 76)
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('5 days a week', 438, 96)

  // Door
  roundRect(ctx, 0, 150, 48, 140, 4, '#8a5a35')
  roundRect(ctx, 6, 158, 36, 124, 3, '#a8754b')
  ctx.fillStyle = '#f0d5a0'
  ctx.beginPath()
  ctx.arc(36, 222, 3, 0, Math.PI * 2)
  ctx.fill()

  // BrewBot station with live stock
  roundRect(ctx, 592, 20, 156, 158, 12, '#4f2a0f')
  ctx.fillStyle = '#f0d5a0'
  ctx.font = '700 13px system-ui, sans-serif'
  ctx.fillText('BREWBOT', 670, 40)
  tank(ctx, 606, 'hot', sim.stock.hot, x.hot, r.drinks.hot.psi > 0)
  tank(ctx, 678, 'cold', sim.stock.cold, x.cold, r.drinks.cold.psi > 0)

  // Barista behind the counter
  const busy = sim.inService !== null
  const bx = 572
  person(ctx, bx, 196, '#e0ac69', '#2e1808', 1.05)
  ctx.fillStyle = '#fdf8f0'
  ctx.fillRect(bx - 9, 186, 18, 18)
  if (busy) {
    ctx.strokeStyle = '#723c14'
    ctx.lineWidth = 2
    for (const dx of [-20, 20]) {
      ctx.beginPath()
      ctx.moveTo(bx + dx, 168)
      ctx.lineTo(bx + dx * 1.3, 162)
      ctx.stroke()
    }
  }

  // Counter
  roundRect(ctx, 556, 206, 204, 70, 6, '#8a5a35')
  roundRect(ctx, 550, 200, 210, 12, 4, '#a8754b')

  // Customers, back of the line first
  sprites.sort((a, b) => a.y - b.y || b.x - a.x)
  for (const s of sprites) {
    const skin = SKIN[s.id % SKIN.length]
    const shirt = SHIRT[(s.id * 7) % SHIRT.length]
    ctx.globalAlpha = s.outcome === 'balked' ? 0.75 : 1
    person(ctx, s.x, s.y, skin, shirt, 0.9)
    ctx.globalAlpha = 1
    if (s.phase !== 'exit') bubble(ctx, s.x + 10, s.y - 64, () => cup(ctx, s.x + 10, s.y - 64, s.drink, s.cups))
    else if (s.outcome === 'served') {
      cup(ctx, s.x + 14, s.y - 22, s.drink, 1, 0.6)
      badge(ctx, s.x, s.y - 60, COLORS.good, '✓')
    } else if (s.outcome === 'partial') badge(ctx, s.x, s.y - 60, COLORS.warning, '½', '#0b0b0b')
    else if (s.outcome === 'stockout') badge(ctx, s.x, s.y - 60, COLORS.critical, '✗')
    else badge(ctx, s.x, s.y - 60, COLORS.muted, '…')
  }

  if (sim.done) {
    ctx.fillStyle = 'rgba(46,24,8,0.55)'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fdf8f0'
    ctx.font = '700 22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('The week is over', W / 2, H / 2 - 6)
    ctx.font = '15px system-ui, sans-serif'
    ctx.fillText('Try another plan, or submit this one to be scored', W / 2, H / 2 + 20)
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, rad)
  ctx.fill()
}

function tank(ctx: CanvasRenderingContext2D, x: number, d: Drink, stock: number, brewed: number, active: boolean) {
  const top = 50
  const h = 96
  roundRect(ctx, x, top, 64, h, 8, '#2e1808')
  if (active && brewed > 0) {
    const frac = Math.max(0, Math.min(1, stock / brewed))
    const fh = (h - 8) * frac
    roundRect(ctx, x + 4, top + h - 4 - fh, 56, fh, 5, COLORS[d])
  }
  ctx.fillStyle = '#f0d5a0'
  ctx.font = '600 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(d === 'hot' ? 'HOT' : 'COLD', x + 32, top + h + 14)
  ctx.font = '700 15px system-ui, sans-serif'
  ctx.fillStyle = '#fdf8f0'
  ctx.fillText(active ? String(stock) : '—', x + 32, top + h + 30)
}

function person(ctx: CanvasRenderingContext2D, x: number, y: number, skin: string, shirt: string, s: number) {
  ctx.fillStyle = 'rgba(46,24,8,0.15)'
  ctx.beginPath()
  ctx.ellipse(x, y + 22 * s, 14 * s, 4 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = shirt
  ctx.beginPath()
  ctx.roundRect(x - 11 * s, y - 18 * s, 22 * s, 40 * s, 9 * s)
  ctx.fill()
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.arc(x, y - 28 * s, 10 * s, 0, Math.PI * 2)
  ctx.fill()
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, inner: () => void) {
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(46,24,8,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(x, y, 17, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x - 9, y + 17, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  inner()
}

function cup(ctx: CanvasRenderingContext2D, x: number, y: number, d: Drink, cups: number, s = 1) {
  ctx.fillStyle = COLORS[d]
  if (d === 'hot') {
    ctx.beginPath()
    ctx.moveTo(x - 6 * s, y - 4 * s)
    ctx.lineTo(x + 6 * s, y - 4 * s)
    ctx.lineTo(x + 4.5 * s, y + 7 * s)
    ctx.lineTo(x - 4.5 * s, y + 7 * s)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = COLORS.muted
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(x - 2 * s, y - 7 * s)
    ctx.quadraticCurveTo(x, y - 10 * s, x - 1 * s, y - 13 * s)
    ctx.moveTo(x + 2.5 * s, y - 7 * s)
    ctx.quadraticCurveTo(x + 4.5 * s, y - 10 * s, x + 3.5 * s, y - 13 * s)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(x - 5 * s, y - 6 * s)
    ctx.lineTo(x + 5 * s, y - 6 * s)
    ctx.lineTo(x + 3.5 * s, y + 8 * s)
    ctx.lineTo(x - 3.5 * s, y + 8 * s)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#2e1808'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x + 1 * s, y - 6 * s)
    ctx.lineTo(x + 4 * s, y - 13 * s)
    ctx.stroke()
  }
  if (cups > 1) {
    ctx.fillStyle = '#2e1808'
    ctx.font = '700 10px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`×${cups}`, x + 7, y + 8)
  }
}

function badge(ctx: CanvasRenderingContext2D, x: number, y: number, fill: string, text: string, ink = '#ffffff') {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ink
  ctx.font = '700 12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + 0.5)
  ctx.textBaseline = 'alphabetic'
}
