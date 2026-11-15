import { arrivalRate, baristaCost, priceOf, serviceRate } from './model'
import { Streams, expo } from './rng'
import type { Decision, Drink, RoundSpec } from './types'

export type Outcome = 'served' | 'partial' | 'stockout' | 'balked'

export interface Customer {
  id: number
  drink: Drink
  cups: number
  arriveT: number
  serviceTime: number
  startT?: number
}

export interface Departure {
  customer: Customer
  outcome: Outcome
  cupsServed: number
  t: number
}

export interface SimMetrics {
  hours: number
  arrivals: number
  balked: number
  served: number
  partial: number
  stockouts: number
  cupsSold: Record<Drink, number>
  cupsBrewed: Record<Drink, number>
  cupsWasted: Record<Drink, number>
  cupsShort: Record<Drink, number>
  revenue: number
  brewCost: number
  baristaCost: number
  profit: number
  /** Mean wait before service, in minutes, over customers who reached the counter. */
  avgWaitMin: number
  maxInShop: number
  /** Time-average number of customers in the shop. */
  avgInShop: number
}

/**
 * Event-driven simulation of the shop. Three events: hour boundary (leftovers are wasted,
 * a fresh batch is brewed and paid for), arrival, and service completion. Call advance()
 * repeatedly to animate it, or runScored() to play a whole run at once.
 */
export class ShopSim {
  readonly hours: number
  t = 0
  done = false
  queue: Customer[] = []
  inService: Customer | null = null
  stock: Record<Drink, number> = { hot: 0, cold: 0 }
  /** Cumulative profit at the end of each completed hour. */
  readonly profitByHour: number[] = []

  private readonly lambda: number
  private readonly mu: number
  private readonly price: Record<Drink, number>
  private readonly perHourBarista: number
  private readonly cumOrders: number[]
  private readonly streams: Streams
  private nextArrivalT: number
  private serviceEnd = Infinity
  private nextHourT = 0
  private nextId = 0
  private waitSum = 0
  private waitCount = 0
  private areaInShop = 0

  private m = {
    arrivals: 0,
    balked: 0,
    served: 0,
    partial: 0,
    stockouts: 0,
    cupsSold: { hot: 0, cold: 0 },
    cupsBrewed: { hot: 0, cold: 0 },
    cupsWasted: { hot: 0, cold: 0 },
    cupsShort: { hot: 0, cold: 0 },
    revenue: 0,
    brewCost: 0,
    baristaCost: 0,
    maxInShop: 0,
  }

  constructor(
    private readonly r: RoundSpec,
    private readonly x: Decision,
    seed: number,
    hours = 120,
  ) {
    this.hours = hours
    this.lambda = arrivalRate(r, x.markup)
    this.mu = serviceRate(r, x)
    this.price = { hot: priceOf(r, 'hot', x.markup), cold: priceOf(r, 'cold', x.markup) }
    this.perHourBarista = baristaCost(r, this.mu)
    let acc = 0
    this.cumOrders = (r.orders?.p ?? [1]).map((p) => (acc += p))
    this.streams = new Streams(seed)
    this.nextArrivalT = expo(this.streams.arrival()) / this.lambda
  }

  get inShop(): number {
    return this.queue.length + (this.inService ? 1 : 0)
  }

  /** Runs every event up to time `to` (hours) and returns who left the shop meanwhile. */
  advance(to: number): Departure[] {
    const out: Departure[] = []
    const end = Math.min(to, this.hours)
    while (!this.done) {
      const tNext = Math.min(this.nextHourT, this.nextArrivalT, this.serviceEnd)
      if (tNext > end) break
      this.tick(tNext)
      if (tNext === this.nextHourT) this.onHour()
      else if (tNext === this.serviceEnd) out.push(this.onServiceEnd())
      else {
        const d = this.onArrival()
        if (d) out.push(d)
      }
    }
    if (!this.done) this.tick(end)
    return out
  }

  metrics(): SimMetrics {
    const m = this.m
    return {
      hours: this.t,
      arrivals: m.arrivals,
      balked: m.balked,
      served: m.served,
      partial: m.partial,
      stockouts: m.stockouts,
      cupsSold: { ...m.cupsSold },
      cupsBrewed: { ...m.cupsBrewed },
      cupsWasted: { ...m.cupsWasted },
      cupsShort: { ...m.cupsShort },
      revenue: m.revenue,
      brewCost: m.brewCost,
      baristaCost: m.baristaCost,
      profit: m.revenue - m.brewCost - m.baristaCost,
      avgWaitMin: this.waitCount ? (this.waitSum / this.waitCount) * 60 : 0,
      maxInShop: m.maxInShop,
      avgInShop: this.t > 0 ? this.areaInShop / this.t : 0,
    }
  }

  private tick(t: number) {
    this.areaInShop += this.inShop * (t - this.t)
    this.t = t
  }

  private onHour() {
    const h = this.nextHourT
    if (h > 0) {
      this.m.cupsWasted.hot += this.stock.hot
      this.m.cupsWasted.cold += this.stock.cold
      this.profitByHour.push(this.m.revenue - this.m.brewCost - this.m.baristaCost)
    }
    if (h >= this.hours) {
      this.stock = { hot: 0, cold: 0 }
      this.done = true
      return
    }
    for (const d of ['hot', 'cold'] as const) {
      this.stock[d] = this.x[d]
      this.m.cupsBrewed[d] += this.x[d]
      this.m.brewCost += this.r.drinks[d].cost * this.x[d]
    }
    this.m.baristaCost += this.perHourBarista
    this.nextHourT = h + 1
  }

  private onArrival(): Departure | null {
    const s = this.streams
    const drinkU = s.drink()
    const orderU = s.order()
    const serviceE = expo(s.service())
    const balkU = s.balk()
    this.nextArrivalT = this.t + expo(s.arrival()) / this.lambda

    let cups = this.cumOrders.findIndex((c) => orderU < c) + 1
    if (cups === 0) cups = this.cumOrders.length
    const c: Customer = {
      id: this.nextId++,
      drink: drinkU < this.r.drinks.hot.psi ? 'hot' : 'cold',
      cups,
      arriveT: this.t,
      serviceTime: serviceE / this.mu,
    }
    this.m.arrivals++
    if (this.r.balk && balkU >= Math.exp(-this.inShop / this.r.balk.beta)) {
      this.m.balked++
      return { customer: c, outcome: 'balked', cupsServed: 0, t: this.t }
    }
    this.queue.push(c)
    this.m.maxInShop = Math.max(this.m.maxInShop, this.inShop)
    if (!this.inService) this.startService()
    return null
  }

  private startService() {
    const c = this.queue.shift()
    if (!c) {
      this.inService = null
      this.serviceEnd = Infinity
      return
    }
    c.startT = this.t
    this.waitSum += this.t - c.arriveT
    this.waitCount++
    this.inService = c
    this.serviceEnd = this.t + c.serviceTime
  }

  private onServiceEnd(): Departure {
    const c = this.inService!
    const got = Math.min(c.cups, this.stock[c.drink])
    this.stock[c.drink] -= got
    this.m.cupsSold[c.drink] += got
    this.m.cupsShort[c.drink] += c.cups - got
    this.m.revenue += got * this.price[c.drink]
    const outcome: Outcome = got === c.cups ? 'served' : got > 0 ? 'partial' : 'stockout'
    if (outcome === 'served') this.m.served++
    else if (outcome === 'partial') this.m.partial++
    else this.m.stockouts++
    this.startService()
    return { customer: c, outcome, cupsServed: got, t: this.t }
  }
}

export function runScored(r: RoundSpec, x: Decision, seed: number, hours = 120): SimMetrics {
  const sim = new ShopSim(r, x, seed, hours)
  sim.advance(hours)
  return sim.metrics()
}
