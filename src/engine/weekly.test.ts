import { describe, expect, it } from 'vitest'
import { expectedPerHour, isFeasible } from './model'
import { solveRound } from './optimizer'
import { normalize } from './scenario'
import { runScored } from './sim'
import { isoWeekId, scenarioById, weekBounds, weeklyCode, weeklyScenario } from './weekly'

describe('week ids', () => {
  it('follows ISO-8601 weeks in UTC', () => {
    expect(isoWeekId(new Date('2026-11-19T12:00:00Z'))).toBe('2026-W47')
    expect(isoWeekId(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53')
    expect(isoWeekId(new Date('2025-12-29T00:00:00Z'))).toBe('2026-W01')
  })

  it('starts weeks on Monday 00:00 UTC', () => {
    const { start, end } = weekBounds('2026-W47')
    expect(start.toISOString()).toBe('2026-11-16T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-23T00:00:00.000Z')
    expect(isoWeekId(start)).toBe('2026-W47')
    expect(weeklyCode('2026-W47')).toBe('weekly-2026-w47')
  })
})

describe('weekly scenarios', () => {
  const weeks = ['2026-W47', '2026-W48', '2027-W05']

  it('are deterministic, different each week, and resolvable by id', () => {
    expect(weeklyScenario('2026-W47')).toEqual(weeklyScenario('2026-W47'))
    expect(weeklyScenario('2026-W47').rounds).not.toEqual(weeklyScenario('2026-W48').rounds)
    expect(scenarioById('weekly-2026-W47')).toEqual(weeklyScenario('2026-W47'))
  })

  it('start every round from a feasible plan and have a profitable optimum the simulation agrees with', () => {
    for (const w of weeks) {
      const scn = weeklyScenario(w)
      for (const r of scn.rounds) {
        expect(isFeasible(r, normalize(r, r.defaults))).toBe(true)
        const opt = solveRound(scn, r)
        expect(opt.expected.profit).toBeGreaterThan(0)
        const x = opt.decision
        let sum = 0
        for (let s = 0; s < 25; s++) sum += runScored(r, x, 500 + s, scn.hours).profit
        const exp = expectedPerHour(r, x).profit * scn.hours
        expect(Math.abs(sum / 25 - exp) / exp).toBeLessThan(0.05)
      }
    }
  })
})
