import { expectedPerHour, isFeasible, resourceUse } from '../engine/model'
import { SCENARIO, sliderValues } from '../engine/scenario'
import type { SimMetrics } from '../engine/sim'
import type { Decision, DecisionKey, RoundSpec } from '../engine/types'

export interface Tip {
  id: string
  title: string
  text: string
}

const LABEL: Record<DecisionKey, string> = {
  hot: 'hot coffees',
  cold: 'cold coffees',
  markup: 'the markup',
  service: 'barista skill',
}

/** Is the decision on the falling side of the expected-profit curve for this slider? */
export function pastPeak(r: RoundSpec, x: Decision, key: DecisionKey): 'down' | 'up' | null {
  const vals = sliderValues(SCENARIO.sliders[key])
  const i = vals.findIndex((v) => Math.abs(v - x[key]) < 1e-9)
  if (i < 0) return null
  const f = (v: number) => expectedPerHour(r, { ...x, [key]: v }).profit
  const here = f(vals[i])
  const lower = i > 0 ? f(vals[i - 1]) : -Infinity
  const higher = i < vals.length - 1 && isFeasible(r, { ...x, [key]: vals[i + 1] }) ? f(vals[i + 1]) : -Infinity
  if (lower > here + 0.01) return 'down'
  if (higher > here + 0.01) return 'up'
  return null
}

export function currentTips(args: {
  r: RoundSpec
  draft: Decision
  tried: Decision
  live: SimMetrics | null
  tries: number
}): Tip[] {
  const { r, draft, tried, live, tries } = args
  const tips: Tip[] = []

  if (!isFeasible(r, draft)) {
    const use = resourceUse(r, draft)
    const short = use.beans > r.resources.beans ? 'beans' : 'water'
    tips.push({
      id: `infeasible-${short}`,
      title: 'That plan is infeasible',
      text: `Brewing that much needs more ${short} than the shop has each hour. Bring the sliders back into the green before you try it. Being allowed is the first test a plan must pass, but it says nothing about whether the plan is any good.`,
    })
  }

  const changed = r.decisions.some((k) => draft[k] !== tried[k])
  if (changed && isFeasible(r, draft)) {
    tips.push({
      id: 'try-it',
      title: 'Sliders only set a candidate',
      text: 'Moving a slider does not change the shop. Press Try Solution to restart the simulation with your new plan.',
    })
  }

  if (live && live.hours < 4 && tries > 0) {
    tips.push({
      id: 'warm-up',
      title: 'Let it run',
      text: 'The shop opened empty a moment ago, so the numbers are still jumping around. Give it a few simulated hours to settle before you judge the plan.',
    })
  }

  if (live && live.hours > 3 && r.balk && live.arrivals > 0 && live.balked / live.arrivals > 0.15) {
    tips.push({
      id: 'congestion',
      title: 'The line is scaring people off',
      text: `${Math.round((live.balked / live.arrivals) * 100)}% of arriving customers have walked away because the line was too long. ${
        r.decisions.includes('service') ? 'A faster barista or a higher price would thin the crowd.' : 'A higher price thins the crowd, and the customers who stay pay more.'
      }`,
    })
  }

  if (isFeasible(r, draft)) {
    for (const key of r.decisions) {
      if (pastPeak(r, draft, key) === 'down') {
        tips.push({
          id: `past-peak-${key}`,
          title: 'Past the peak',
          text: `More isn't always better. The Profit Monitor shows that lowering ${LABEL[key]} a little would earn more on average.`,
        })
        break
      }
    }
  }

  tips.push({ id: `round-${r.round}`, title: `Round ${r.round}: ${r.title}`, text: r.intro })
  return tips
}

export function comparisonMessage(args: {
  playerRun: number
  optimalRun: number
  playerExpected: number
  optimalExpected: number
}): string {
  const { playerRun, optimalRun, playerExpected, optimalExpected } = args
  const gapExpected = optimalExpected - playerExpected
  if (gapExpected < Math.max(1, Math.abs(optimalExpected) * 0.001)) {
    return 'Your plan matches the optimizer’s: nothing better exists on average. Any difference in this run is down to the customers who happened to show up.'
  }
  if (playerRun > optimalRun) {
    return `You beat the optimizer on this run! That is not a bug. Both plans faced exactly the same customers, and this week yours happened to do better. On average, though, the optimizer’s plan earns about ${Math.round(gapExpected).toLocaleString('en-US')} dollars more per week. The question is which plan you would trust before you know who walks in.`
  }
  return `The optimizer’s plan earned more this time, and it would on average too: about ${Math.round(gapExpected).toLocaleString('en-US')} dollars more over a week. It does not predict the future; it picks the plan that does best across all the weeks that could happen.`
}
