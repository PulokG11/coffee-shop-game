import { choices } from './scenario'
import { baristaCost, demandMoments, expectedPerHour, expectedUnsold, priceOf, type Expected } from './model'
import type { Decision, Drink, RoundSpec, Scenario } from './types'

export interface Optimum {
  decision: Decision
  expected: Expected
  solveMs: number
  /** Number of (markup, service, hot) combinations whose best cold quantity was evaluated. */
  candidates: number
}

/**
 * Global optimum of the analytic expected-profit model over the slider grid.
 *
 * Markup and service rate are enumerated (they only move the demand distribution). For each
 * pair, profit separates by drink, so for every hot quantity the best feasible cold quantity
 * is read from a running arg-max table: exact on the grid, with no concavity assumption.
 */
export function solveRound(scn: Scenario, r: RoundSpec): Optimum {
  const t0 = performance.now()
  const hotQs = choices(scn, r, 'hot')
  const coldQs = choices(scn, r, 'cold')
  const markups = choices(scn, r, 'markup')
  const services = r.decisions.includes('service') ? choices(scn, r, 'service') : [r.service.mu]
  const { hot: uh, cold: uc } = { hot: r.drinks.hot.use, cold: r.drinks.cold.use }

  let best = -Infinity
  let bestX: Decision = { ...r.defaults }
  let candidates = 0

  for (const m of markups) {
    for (const mu of services) {
      const dm = demandMoments(r, m, mu)
      const value = (d: Drink, q: number) =>
        priceOf(r, d, m) * Math.max(0, q - expectedUnsold(q, dm[d].mean, dm[d].variance)) -
        r.drinks[d].cost * q

      const coldVal = coldQs.map((q) => value('cold', q))
      const bestColdUpTo: number[] = []
      coldVal.forEach((v, i) => {
        bestColdUpTo.push(i === 0 || v > coldVal[bestColdUpTo[i - 1]] ? i : bestColdUpTo[i - 1])
      })
      const fixedCost = baristaCost(r, mu)

      for (const qh of hotQs) {
        const beansLeft = r.resources.beans - uh.beans * qh
        const waterLeft = r.resources.water - uh.water * qh
        if (beansLeft < -1e-9 || waterLeft < -1e-9) break
        const cap = Math.min(
          uc.beans > 0 ? beansLeft / uc.beans : Infinity,
          uc.water > 0 ? waterLeft / uc.water : Infinity,
        )
        const idx = lastIndexAtMost(coldQs, cap)
        if (idx < 0) continue
        candidates++
        const ci = bestColdUpTo[idx]
        const total = value('hot', qh) + coldVal[ci] - fixedCost
        if (total > best + 1e-9) {
          best = total
          bestX = { hot: qh, cold: coldQs[ci], markup: m, service: mu }
        }
      }
    }
  }

  return {
    decision: bestX,
    expected: expectedPerHour(r, bestX),
    solveMs: performance.now() - t0,
    candidates,
  }
}

function lastIndexAtMost(sorted: number[], cap: number): number {
  let lo = 0
  let hi = sorted.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] <= cap + 1e-9) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}
