import { resourceUse } from '../engine/model'
import { SCENARIO } from '../engine/scenario'
import type { Decision, RoundSpec } from '../engine/types'
import { fmtInt } from '../lib/format'
import { VIZ, scale } from './chartKit'

type Pt = [number, number]

/** Clip a polygon to the half-plane a·x + b·y ≤ c (Sutherland–Hodgman). */
function clip(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const inside = (p: Pt) => a * p[0] + b * p[1] <= c + 1e-9
  const out: Pt[] = []
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]
    const pi = inside(p)
    const qi = inside(q)
    if (pi) out.push(p)
    if (pi !== qi) {
      const t = (c - a * p[0] - b * p[1]) / (a * (q[0] - p[0]) + b * (q[1] - p[1]))
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
    }
  })
  return out
}

export function ConstraintMonitor({ r, draft }: { r: RoundSpec; draft: Decision }) {
  const use = resourceUse(r, draft)
  const rows = [
    { key: 'beans', label: 'Beans', unit: 'g', used: use.beans, cap: r.resources.beans },
    { key: 'water', label: 'Water', unit: 'ml', used: use.water, cap: r.resources.water },
  ] as const
  const twoDrinks = r.decisions.includes('cold')

  return (
    <section aria-labelledby="cm-title" className="ticket-hang">
      <div className="ticket">
      <h3 id="cm-title" className="ticket-title">
        Constraint Monitor
      </h3>
      <p className="mt-0.5 text-sm text-ink-soft">What one hour of brewing needs, against what the shop has.</p>
      <div className="mt-3 space-y-3">
        {rows.map((row) => {
          const over = row.used > row.cap + 1e-9
          const frac = Math.min(1, row.used / row.cap)
          return (
            <div key={row.key}>
              <div className="flex justify-between text-sm">
                <span className="font-bold">{row.label}</span>
                <span className="tabular-nums text-ink-soft">
                  {fmtInt(row.used)} / {fmtInt(row.cap)} {row.unit} per hour
                </span>
              </div>
              <div
                className="mt-1 h-3 w-full overflow-hidden rounded-full bg-paper-edge"
                role="meter"
                aria-label={`${row.label} used`}
                aria-valuemin={0}
                aria-valuemax={row.cap}
                aria-valuenow={Math.round(row.used)}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-150"
                  style={{ width: `${frac * 100}%`, background: over ? VIZ.critical : VIZ.ink }}
                />
              </div>
              {over && (
                <p className="mt-1 text-sm font-bold text-bad-ink">
                  ⚠ Over by {fmtInt(row.used - row.cap)} {row.unit}
                </p>
              )}
            </div>
          )
        })}
      </div>
      {twoDrinks && <FeasibleRegion r={r} draft={draft} />}
      </div>
    </section>
  )
}

function FeasibleRegion({ r, draft }: { r: RoundSpec; draft: Decision }) {
  const W = 260
  const H = 170
  const M = { l: 34, r: 10, t: 8, b: 28 }
  const hmax = SCENARIO.sliders.hot.max
  const cmax = SCENARIO.sliders.cold.max
  const sx = scale(0, hmax, M.l, W - M.r)
  const sy = scale(0, cmax, H - M.b, M.t)
  let poly: Pt[] = [
    [0, 0],
    [hmax, 0],
    [hmax, cmax],
    [0, cmax],
  ]
  for (const res of ['beans', 'water'] as const) {
    poly = clip(poly, r.drinks.hot.use[res], r.drinks.cold.use[res], r.resources[res])
  }
  const feasible = resourceUse(r, draft).beans <= r.resources.beans && resourceUse(r, draft).water <= r.resources.water
  const ticks = [0, 25, 50, 75, 100]

  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label={`Feasible plans for hot and cold coffee. Your plan, ${draft.hot} hot and ${draft.cold} cold per hour, is ${feasible ? 'inside' : 'outside'} the region.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke={VIZ.grid} />
            <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={VIZ.grid} />
            <text x={sx(t)} y={H - M.b + 12} fontSize="9" textAnchor="middle" fill={VIZ.muted}>
              {t}
            </text>
            <text x={M.l - 5} y={sy(t) + 3} fontSize="9" textAnchor="end" fill={VIZ.muted}>
              {t}
            </text>
          </g>
        ))}
        <polygon points={poly.map(([h, c]) => `${sx(h)},${sy(c)}`).join(' ')} fill="#fdf0d2" fillOpacity="1" stroke="#b07a10" strokeWidth="1.5" />
        <text x={sx(4)} y={sy(6)} fontSize="10" fill={VIZ.secondary}>
          feasible
        </text>
        <circle cx={sx(draft.hot)} cy={sy(draft.cold)} r="5.5" fill={feasible ? VIZ.you : VIZ.critical} stroke={VIZ.surface} strokeWidth="2" />
        <text x={(M.l + W - M.r) / 2} y={H - 3} fontSize="10" textAnchor="middle" fill={VIZ.secondary}>
          Hot cups / hour
        </text>
        <text x={10} y={(M.t + H - M.b) / 2} fontSize="10" textAnchor="middle" fill={VIZ.secondary} transform={`rotate(-90 10 ${(M.t + H - M.b) / 2})`}>
          Cold cups / hour
        </text>
      </svg>
    </figure>
  )
}
