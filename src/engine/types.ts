export type Drink = 'hot' | 'cold'
export const DRINKS: readonly Drink[] = ['hot', 'cold']

export type DecisionKey = 'hot' | 'cold' | 'markup' | 'service'
export const DECISION_KEYS: readonly DecisionKey[] = ['hot', 'cold', 'markup', 'service']

export interface Decision {
  hot: number
  cold: number
  markup: number
  service: number
}

export interface ResourceUse {
  beans: number
  water: number
}

export interface DrinkSpec {
  psi: number
  /** Price per cup when markup is not a decision. */
  price: number
  /** Brewing cost per cup brewed (sold or wasted). */
  cost: number
  use: ResourceUse
}

export interface SliderSpec {
  min: number
  max: number
  step: number
  label: string
  unit: string
}

export interface RoundSpec {
  round: number
  title: string
  wrinkle: string
  intro: string
  decisions: DecisionKey[]
  drinks: Record<Drink, DrinkSpec>
  /** λ(m) = lambda0 · exp(−k·m) when markup is a decision, else lambda0. */
  arrivals: { lambda0: number; k: number }
  /** Fixed service rate unless 'service' is a decision; barista cost = costPerUnit · μ per hour. */
  service: { mu: number; costPerUnit: number }
  /** Join probability for an arrival that sees n customers in the shop: exp(−n/beta). */
  balk: { beta: number } | null
  /** p[i] = probability a customer orders i+1 cups. */
  orders: { p: number[] } | null
  resources: ResourceUse
  defaults: Decision
}

export interface Scenario {
  id: string
  version: string
  name: string
  hours: number
  notes?: string
  sliders: Record<DecisionKey, SliderSpec>
  rounds: RoundSpec[]
}
