import data from '../../scenarios/default_v2.json'
import type { Decision, DecisionKey, RoundSpec, Scenario, SliderSpec } from './types'

export const SCENARIO = data as Scenario

export function getRound(scn: Scenario, round: number): RoundSpec {
  const r = scn.rounds.find((x) => x.round === round)
  if (!r) throw new Error(`Round ${round} is not in scenario ${scn.id}`)
  return r
}

/** Values a slider can take, exactly as shown to the player. */
export function sliderValues(s: SliderSpec): number[] {
  const n = Math.round((s.max - s.min) / s.step)
  return Array.from({ length: n + 1 }, (_, i) => roundTo(s.min + i * s.step, s.step))
}

export function roundTo(v: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9))
  return Number((Math.round(v / step) * step).toFixed(decimals))
}

export function clampToSlider(s: SliderSpec, v: number): number {
  if (!Number.isFinite(v)) return s.min
  return roundTo(Math.min(s.max, Math.max(s.min, v)), s.step)
}

/** Values the optimizer and the player may choose for one decision in this round. */
export function choices(scn: Scenario, r: RoundSpec, key: DecisionKey): number[] {
  if (!r.decisions.includes(key)) return [r.defaults[key]]
  return sliderValues(scn.sliders[key])
}

/** Decision with inactive variables pinned to the round's fixed values. */
export function normalize(r: RoundSpec, x: Decision): Decision {
  return {
    hot: r.decisions.includes('hot') ? x.hot : r.defaults.hot,
    cold: r.decisions.includes('cold') ? x.cold : r.defaults.cold,
    markup: r.decisions.includes('markup') ? x.markup : r.defaults.markup,
    service: r.decisions.includes('service') ? x.service : r.service.mu,
  }
}
