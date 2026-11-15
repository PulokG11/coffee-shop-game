import { describe, expect, it } from 'vitest'
import { expectedPerHour, isFeasible, queueStats } from './model'
import { solveRound } from './optimizer'
import { SCENARIO, choices, normalize } from './scenario'
import { runScored } from './sim'
import type { Decision } from './types'

const H = SCENARIO.hours

describe('scenario', () => {
  it('has eight rounds with feasible defaults', () => {
    expect(SCENARIO.rounds).toHaveLength(8)
    for (const r of SCENARIO.rounds) expect(isFeasible(r, normalize(r, r.defaults))).toBe(true)
  })
})

describe('simulation', () => {
  const r = SCENARIO.rounds[6]
  const x = normalize(r, r.defaults)

  it('is exactly reproducible from its seed', () => {
    expect(runScored(r, x, 42, H)).toEqual(runScored(r, x, 42, H))
  })

  it('shows the same customers to different brewing decisions (common random numbers)', () => {
    const a = runScored(r, x, 7, H)
    const b = runScored(r, { ...x, hot: x.hot + 10, cold: 0 }, 7, H)
    expect(b.arrivals).toBe(a.arrivals)
    expect(b.balked).toBe(a.balked)
  })

  it('keeps the books balanced', () => {
    const m = runScored(r, x, 3, H)
    for (const d of ['hot', 'cold'] as const) {
      expect(m.cupsBrewed[d]).toBe(m.cupsSold[d] + m.cupsWasted[d])
    }
    expect(m.served + m.partial + m.stockouts + m.balked).toBeLessThanOrEqual(m.arrivals)
  })
})

describe('queue model', () => {
  it('matches M/M/1 when nobody balks', () => {
    const q = queueStats(30, 40, null)
    expect(q.inShop).toBeCloseTo(3, 6)
    expect(q.timeInShop).toBeCloseTo(0.1, 6)
  })
})

describe('optimizer', () => {
  it('matches brute-force enumeration in every round (sampled for 3-D and 4-D rounds)', () => {
    for (const r of SCENARIO.rounds) {
      const opt = solveRound(SCENARIO, r)
      expect(isFeasible(r, opt.decision)).toBe(true)
      const target = opt.expected.profit
      const hot = choices(SCENARIO, r, 'hot')
      const cold = choices(SCENARIO, r, 'cold')
      const markups = choices(SCENARIO, r, 'markup')
      const services = r.decisions.includes('service') ? choices(SCENARIO, r, 'service') : [r.service.mu]
      const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
      const tries = r.decisions.length <= 2 ? hot.length * cold.length : 20000
      for (let i = 0; i < tries; i++) {
        const x: Decision =
          r.decisions.length <= 2
            ? { hot: hot[Math.floor(i / cold.length)], cold: cold[i % cold.length], markup: markups[0], service: services[0] }
            : { hot: pick(hot), cold: pick(cold), markup: pick(markups), service: pick(services) }
        if (!isFeasible(r, x)) continue
        expect(expectedPerHour(r, x).profit).toBeLessThanOrEqual(target + 1e-6)
      }
    }
  })
})

describe('analytic model vs Monte Carlo', () => {
  it('agrees within 4% at the optimum and at the defaults in every round', () => {
    const rows: string[] = []
    for (const r of SCENARIO.rounds) {
      const opt = solveRound(SCENARIO, r)
      for (const [label, x] of [
        ['opt', opt.decision],
        ['def', normalize(r, r.defaults)],
      ] as const) {
        const expected = expectedPerHour(r, x).profit * H
        let sum = 0
        const n = 60
        for (let s = 0; s < n; s++) sum += runScored(r, x, 1000 + s, H).profit
        const mc = sum / n
        rows.push(
          `R${r.round} ${label} x=${JSON.stringify(x)} E=${expected.toFixed(0)} MC=${mc.toFixed(0)} gap=${(((mc - expected) / expected) * 100).toFixed(1)}%` +
            (label === 'opt' ? ` solve=${opt.solveMs.toFixed(1)}ms` : ''),
        )
        expect(Math.abs(mc - expected) / Math.abs(expected)).toBeLessThan(0.04)
      }
    }
    console.log(rows.join('\n'))
  })
})
