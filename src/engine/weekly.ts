import { isFeasible } from './model'
import { hashSeed, mulberry32 } from './rng'
import { SCENARIO } from './scenario'
import type { RoundSpec, Scenario } from './types'

const DAY = 86_400_000

/** ISO-8601 week of a UTC date, e.g. "2026-W47". Weeks start on Monday. */
export function isoWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const year = d.getUTCFullYear()
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / DAY + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Monday 00:00 UTC at the start of the week and of the next one. */
export function weekBounds(weekId: string): { start: Date; end: Date } {
  const [, y, w] = weekId.match(/^(\d{4})-W(\d{2})$/) ?? []
  if (!y) throw new Error(`Bad week id ${weekId}`)
  const jan4 = new Date(Date.UTC(Number(y), 0, 4))
  const start = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * DAY + (Number(w) - 1) * 7 * DAY)
  return { start, end: new Date(start.getTime() + 7 * DAY) }
}

export const weeklyCode = (weekId: string) => `weekly-${weekId.toLowerCase()}`
export const weeklyScenarioId = (weekId: string) => `weekly-${weekId}`

const step = (v: number, s: number) => Math.round(v / s) * s
const cents = (v: number) => Math.round(v * 100) / 100

/**
 * This week's version of the eight rounds: demand, supplies and costs move within fixed ranges,
 * so every week has a different best plan while each round still teaches the same idea.
 */
export function weeklyScenario(weekId: string, base: Scenario = SCENARIO): Scenario {
  const rnd = mulberry32(hashSeed('weekly', weekId))
  const pick = (lo: number, hi: number) => step(lo + rnd() * (hi - lo), 0.05)
  const rounds = base.rounds.map((r): RoundSpec => {
    const demand = pick(0.85, 1.15)
    const supply = pick(0.9, 1.1)
    const cost = pick(0.85, 1.15)
    const next: RoundSpec = {
      ...r,
      drinks: {
        hot: { ...r.drinks.hot, cost: cents(r.drinks.hot.cost * cost) },
        cold: { ...r.drinks.cold, cost: cents(r.drinks.cold.cost * cost) },
      },
      arrivals: { ...r.arrivals, lambda0: Math.round(r.arrivals.lambda0 * demand) },
      resources: { beans: step(r.resources.beans * supply, 10), water: step(r.resources.water * supply, 100) },
      defaults: { ...r.defaults },
    }
    while (!isFeasible(next, next.defaults) && (next.defaults.hot > 0 || next.defaults.cold > 0)) {
      next.defaults.hot = Math.max(0, next.defaults.hot - 1)
      if (r.decisions.includes('cold')) next.defaults.cold = Math.max(0, next.defaults.cold - 1)
    }
    return next
  })
  return { ...base, id: weeklyScenarioId(weekId), name: `Week ${weekId.slice(6)} of ${weekId.slice(0, 4)}`, rounds }
}

/** The scenario a match plays: the standard week, or a weekly variant. */
export function scenarioById(id: string): Scenario {
  if (id === SCENARIO.id) return SCENARIO
  const m = id.match(/^weekly-(\d{4}-W\d{2})$/)
  if (m) return weeklyScenario(m[1])
  throw new Error(`Unknown scenario ${id}`)
}
