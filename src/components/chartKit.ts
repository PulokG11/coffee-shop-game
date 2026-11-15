import type { DecisionKey } from '../engine/types'

export const VIZ = {
  surface: '#fffdf8',
  ink: '#2e1808',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#ece4d6',
  axis: '#c3c2b7',
  you: '#6250d6',
  optimizer: '#008300',
  hot: '#eb6834',
  cold: '#2a78d6',
  critical: '#d03b3b',
  good: '#0ca30c',
  curve: '#723c14',
}

export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min]
  const span = max - min
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag
  const start = Math.floor(min / step + 1e-9) * step
  const out: number[] = []
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)))
  return out
}

export const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)

export const KEY_LABEL: Record<DecisionKey, string> = {
  hot: 'Hot coffee',
  cold: 'Cold coffee',
  markup: 'Price',
  service: 'Barista',
}

export function fmtDecision(key: DecisionKey, v: number): string {
  switch (key) {
    case 'hot':
    case 'cold':
      return `${v} cups/h`
    case 'markup':
      return `$${v.toFixed(2)} markup`
    case 'service':
      return `${v} customers/h`
  }
}
