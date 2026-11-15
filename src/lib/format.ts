const money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const fmtMoney = (v: number) => money0.format(Math.round(v))
export const fmtPrice = (v: number) => money2.format(v)
export const fmtInt = (v: number) => int.format(Math.round(v))
export const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

export function fmtCompactMoney(v: number): string {
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}K`
  return `${sign}$${Math.round(a)}`
}

export function fmtClock(simHours: number): string {
  const day = Math.min(5, Math.floor(simHours / 24) + 1)
  const h = Math.floor(simHours % 24)
  const m = Math.floor((simHours * 60) % 60)
  return `Day ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
