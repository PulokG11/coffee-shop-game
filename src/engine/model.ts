import { DRINKS, type Decision, type DecisionKey, type Drink, type RoundSpec, type ResourceUse } from './types'

const SQRT_2PI = Math.sqrt(2 * Math.PI)

export const phi = (z: number) => Math.exp(-0.5 * z * z) / SQRT_2PI

/** Standard normal CDF (Abramowitz & Stegun 26.2.17, |error| < 7.5e-8). */
export function Phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly =
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const upper = phi(z) * poly
  return z >= 0 ? 1 - upper : upper
}

/** E[(Q − D)⁺] for D ~ Normal(mean, variance). */
export function expectedUnsold(q: number, mean: number, variance: number): number {
  if (variance <= 0) return Math.max(0, q - mean)
  const s = Math.sqrt(variance)
  const z = (q - mean) / s
  return Math.max(0, s * (z * Phi(z) + phi(z)))
}

export const has = (r: RoundSpec, key: DecisionKey) => r.decisions.includes(key)

export function priceOf(r: RoundSpec, d: Drink, markup: number): number {
  return has(r, 'markup') ? r.drinks[d].cost + markup : r.drinks[d].price
}

export function arrivalRate(r: RoundSpec, markup: number): number {
  return has(r, 'markup') ? r.arrivals.lambda0 * Math.exp(-r.arrivals.k * markup) : r.arrivals.lambda0
}

export function serviceRate(r: RoundSpec, x: Decision): number {
  return has(r, 'service') ? x.service : r.service.mu
}

export function baristaCost(r: RoundSpec, mu: number): number {
  return r.service.costPerUnit * mu
}

export function orderMoments(r: RoundSpec): { m1: number; m2: number } {
  if (!r.orders) return { m1: 1, m2: 1 }
  let m1 = 0
  let m2 = 0
  r.orders.p.forEach((p, i) => {
    const k = i + 1
    m1 += p * k
    m2 += p * k * k
  })
  return { m1, m2 }
}

export interface QueueStats {
  /** Arrival rate before balking (customers / hour). */
  lambda: number
  /** Customers per hour who join the line (= throughput in steady state). */
  joinRate: number
  balkRate: number
  /** Mean number of customers in the shop. */
  inShop: number
  /** Mean time from arrival to leaving the counter, in hours. */
  timeInShop: number
  /** Mean wait before service starts, in hours. */
  wait: number
  utilization: number
}

/** Steady-state single-barista queue with exponential service and optional balking. */
export function queueStats(lambda: number, mu: number, balk: RoundSpec['balk']): QueueStats {
  if (!balk) {
    const rho = lambda / mu
    if (rho >= 1) {
      return { lambda, joinRate: mu, balkRate: 0, inShop: Infinity, timeInShop: Infinity, wait: Infinity, utilization: 1 }
    }
    return {
      lambda,
      joinRate: lambda,
      balkRate: 0,
      inShop: rho / (1 - rho),
      timeInShop: 1 / (mu - lambda),
      wait: rho / (mu - lambda),
      utilization: rho,
    }
  }
  // Birth–death chain: from n customers, arrivals join at rate λ·exp(−n/β), service at rate μ.
  let p = 1
  let total = 0
  let sumN = 0
  let sumJoin = 0
  for (let n = 0; n < 500; n++) {
    const join = Math.exp(-n / balk.beta)
    total += p
    sumN += n * p
    sumJoin += p * lambda * join
    p *= (lambda * join) / mu
    if (n > 5 && p < 1e-14 * total) break
  }
  const joinRate = sumJoin / total
  const inShop = sumN / total
  const timeInShop = joinRate > 0 ? inShop / joinRate : 0
  return {
    lambda,
    joinRate,
    balkRate: lambda - joinRate,
    inShop,
    timeInShop,
    wait: Math.max(0, timeInShop - 1 / mu),
    utilization: joinRate / mu,
  }
}

export interface DemandMoments {
  hot: { mean: number; variance: number }
  cold: { mean: number; variance: number }
  queue: QueueStats
}

/** Hourly cup demand per drink: compound Poisson moments fed into the Normal approximation. */
export function demandMoments(r: RoundSpec, markup: number, mu: number): DemandMoments {
  const queue = queueStats(arrivalRate(r, markup), mu, r.balk)
  const { m1, m2 } = orderMoments(r)
  const of = (d: Drink) => {
    const rate = queue.joinRate * r.drinks[d].psi
    return { mean: rate * m1, variance: rate * m2 }
  }
  return { hot: of('hot'), cold: of('cold'), queue }
}

export interface Expected {
  profit: number
  revenue: number
  brewCost: number
  baristaCost: number
  demand: Record<Drink, number>
  sold: Record<Drink, number>
  wasted: Record<Drink, number>
  short: Record<Drink, number>
  queue: QueueStats
}

/** Expected profit and operating metrics per hour. Multiply by the run length for a run. */
export function expectedPerHour(r: RoundSpec, x: Decision): Expected {
  const mu = serviceRate(r, x)
  const dm = demandMoments(r, x.markup, mu)
  const out: Expected = {
    profit: 0,
    revenue: 0,
    brewCost: 0,
    baristaCost: baristaCost(r, mu),
    demand: { hot: 0, cold: 0 },
    sold: { hot: 0, cold: 0 },
    wasted: { hot: 0, cold: 0 },
    short: { hot: 0, cold: 0 },
    queue: dm.queue,
  }
  for (const d of DRINKS) {
    const q = x[d]
    const { mean, variance } = dm[d]
    const wasted = expectedUnsold(q, mean, variance)
    const sold = Math.max(0, q - wasted)
    out.demand[d] = mean
    out.sold[d] = sold
    out.wasted[d] = wasted
    out.short[d] = Math.max(0, mean - sold)
    out.revenue += priceOf(r, d, x.markup) * sold
    out.brewCost += r.drinks[d].cost * q
  }
  out.profit = out.revenue - out.brewCost - out.baristaCost
  return out
}

export function resourceUse(r: RoundSpec, x: Decision): ResourceUse {
  return {
    beans: r.drinks.hot.use.beans * x.hot + r.drinks.cold.use.beans * x.cold,
    water: r.drinks.hot.use.water * x.hot + r.drinks.cold.use.water * x.cold,
  }
}

const EPS = 1e-9

export function isFeasible(r: RoundSpec, x: Decision): boolean {
  const use = resourceUse(r, x)
  return use.beans <= r.resources.beans + EPS && use.water <= r.resources.water + EPS
}
