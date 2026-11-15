import { useMemo, useState } from 'react'
import { expectedPerHour, isFeasible } from '../engine/model'
import { SCENARIO, sliderValues } from '../engine/scenario'
import type { Decision, DecisionKey, RoundSpec } from '../engine/types'
import { fmtCompactMoney, fmtMoney } from '../lib/format'
import { KEY_LABEL, VIZ, fmtDecision, niceTicks, scale } from './chartKit'

const W = 380
const H = 200
const M = { l: 46, r: 14, t: 18, b: 30 }

export function ProfitMonitor({ r, draft }: { r: RoundSpec; draft: Decision }) {
  const [view, setView] = useState<DecisionKey>(r.decisions.includes('markup') ? 'markup' : r.decisions[0])
  const [hover, setHover] = useState<number | null>(null)

  const pts = useMemo(
    () =>
      sliderValues(SCENARIO.sliders[view]).map((v) => {
        const x = { ...draft, [view]: v }
        return { v, y: expectedPerHour(r, x).profit * SCENARIO.hours, feasible: isFeasible(r, x) }
      }),
    [r, draft, view],
  )

  const ys = pts.map((p) => p.y)
  const yMin = Math.min(0, ...ys)
  const yMax = Math.max(0, ...ys) * 1.05
  const yTicks = niceTicks(yMin, yMax, 4)
  const y0 = Math.min(yTicks[0], yMin)
  const y1 = Math.max(yTicks[yTicks.length - 1], yMax)
  const sx = scale(pts[0].v, pts[pts.length - 1].v, M.l, W - M.r)
  const sy = scale(y0, y1, H - M.b, M.t)
  const xTicks = niceTicks(pts[0].v, pts[pts.length - 1].v, 5)

  const segments: { feasible: boolean; d: string }[] = []
  pts.forEach((p, i) => {
    const cmd = `${sx(p.v).toFixed(1)},${sy(p.y).toFixed(1)}`
    const lastSeg = segments[segments.length - 1]
    if (!lastSeg || lastSeg.feasible !== p.feasible) {
      const prev = pts[i - 1]
      segments.push({ feasible: p.feasible, d: prev ? `M${sx(prev.v).toFixed(1)},${sy(prev.y).toFixed(1)}L${cmd}` : `M${cmd}` })
    } else lastSeg.d += `L${cmd}`
  })

  const bands: [number, number][] = []
  let runStart: number | null = null
  pts.forEach((p, i) => {
    if (!p.feasible && runStart === null) runStart = i
    const last = i === pts.length - 1
    if (runStart !== null && (p.feasible || last)) {
      const end = p.feasible ? i - 1 : i
      const a = runStart > 0 ? (pts[runStart - 1].v + pts[runStart].v) / 2 : pts[runStart].v
      const b = end < pts.length - 1 ? (pts[end].v + pts[end + 1].v) / 2 : pts[end].v
      bands.push([a, b])
      runStart = null
    }
  })

  const cur = pts.find((p) => Math.abs(p.v - draft[view]) < 1e-9) ?? pts[0]
  const hv = hover !== null ? pts[hover] : null
  const peak = pts.filter((p) => p.feasible).reduce((a, b) => (b.y > a.y ? b : a), pts[0])

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * (W - M.l - M.r) + M.l
    let best = 0
    pts.forEach((p, i) => {
      if (Math.abs(sx(p.v) - px) < Math.abs(sx(pts[best].v) - px)) best = i
    })
    setHover(best)
  }

  return (
    <section aria-labelledby="pm-title" className="rounded-xl bg-[#fffdf8] p-3 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="pm-title" className="text-sm font-semibold text-coffee-900">
          Profit Monitor
        </h3>
        <div role="tablist" aria-label="Vary which decision" className="flex gap-1">
          {r.decisions.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                view === k ? 'bg-coffee-800 text-white' : 'bg-coffee-100 text-coffee-800 hover:bg-coffee-200'
              }`}
            >
              {KEY_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-xs text-[#52514e]">
        Expected 5-day profit as {KEY_LABEL[view].toLowerCase()} changes, other sliders held where they are.
      </p>

      <div className="relative mt-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Expected profit curve for ${KEY_LABEL[view]}. Your choice ${fmtDecision(view, cur.v)} gives ${fmtMoney(cur.y)}.`}>
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#f6efe4" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#e2d3bd" strokeWidth="2" />
            </pattern>
          </defs>
          {bands.map(([a, b], i) => (
            <g key={i}>
              <rect x={sx(a)} y={M.t} width={Math.max(2, sx(b) - sx(a))} height={H - M.t - M.b} fill="url(#hatch)" />
              {sx(b) - sx(a) > 60 && (
                <text x={(sx(a) + sx(b)) / 2} y={H - M.b - 8} textAnchor="middle" fontSize="10" fill={VIZ.secondary}>
                  Infeasible
                </text>
              )}
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth="1" />
              <text x={M.l - 6} y={sy(t) + 3.5} textAnchor="end" fontSize="10" fill={VIZ.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmtCompactMoney(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={H - M.b + 14} textAnchor="middle" fontSize="10" fill={VIZ.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {view === 'markup' ? `$${t}` : t}
            </text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 3} textAnchor="middle" fontSize="10" fill={VIZ.secondary}>
            {SCENARIO.sliders[view].label}
          </text>
          {segments.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill="none"
              stroke={s.feasible ? VIZ.curve : VIZ.axis}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {peak.feasible && Math.abs(peak.v - cur.v) > 1e-9 && (
            <text x={sx(peak.v)} y={sy(peak.y) - 8} textAnchor="middle" fontSize="10" fill={VIZ.secondary}>
              peak
            </text>
          )}
          <circle cx={sx(cur.v)} cy={sy(cur.y)} r="5.5" fill={cur.feasible ? VIZ.you : VIZ.critical} stroke={VIZ.surface} strokeWidth="2" />
          {hv && (
            <g pointerEvents="none">
              <line x1={sx(hv.v)} x2={sx(hv.v)} y1={M.t} y2={H - M.b} stroke={VIZ.muted} strokeWidth="1" />
              <circle cx={sx(hv.v)} cy={sy(hv.y)} r="4" fill={hv.feasible ? VIZ.curve : VIZ.axis} stroke={VIZ.surface} strokeWidth="2" />
            </g>
          )}
          <rect
            x={M.l}
            y={M.t}
            width={W - M.l - M.r}
            height={H - M.t - M.b}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hv && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-md bg-coffee-900 px-2 py-1 text-xs text-white shadow"
            style={{ left: `${(sx(hv.v) / W) * 100}%`, transform: `translateX(${sx(hv.v) > W * 0.6 ? '-105%' : '5%'})` }}
          >
            <div className="font-semibold">{fmtDecision(view, hv.v)}</div>
            <div>Expected {fmtMoney(hv.y)}</div>
            {!hv.feasible && <div className="text-[#ffb4b4]">Infeasible: not enough beans or water</div>}
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#52514e]">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: cur.feasible ? VIZ.you : VIZ.critical }} />
        Your choice: {fmtDecision(view, cur.v)} → expected {fmtMoney(cur.y)}
      </div>
      <table className="sr-only">
        <caption>Expected 5-day profit by {KEY_LABEL[view]}</caption>
        <tbody>
          {pts
            .filter((_, i) => i % 5 === 0)
            .map((p) => (
              <tr key={p.v}>
                <td>{fmtDecision(view, p.v)}</td>
                <td>{fmtMoney(p.y)}</td>
                <td>{p.feasible ? 'feasible' : 'infeasible'}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  )
}
