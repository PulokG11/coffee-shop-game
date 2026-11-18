import { useEffect, useState } from 'react'
import { hashSeed } from '../engine/rng'
import { SCENARIO } from '../engine/scenario'
import { runScored } from '../engine/sim'
import type { Decision, RoundSpec } from '../engine/types'
import { fmtMoney } from '../lib/format'
import { VIZ, niceTicks, scale } from './chartKit'

const WEEKS = 150

export interface Spread {
  player: number[]
  optimal: number[]
  playerWins: number
}

/** Simulates extra weeks in small batches so the page stays responsive. */
export function useSpread(r: RoundSpec, player: Decision, optimal: Decision, seed: number): Spread | null {
  const [spread, setSpread] = useState<Spread | null>(null)
  useEffect(() => {
    let cancelled = false
    const acc: Spread = { player: [], optimal: [], playerWins: 0 }
    const batch = () => {
      if (cancelled) return
      for (let k = 0; k < 15 && acc.player.length < WEEKS; k++) {
        const s = hashSeed(seed, 'spread', acc.player.length)
        const p = runScored(r, player, s, SCENARIO.hours).profit
        const o = runScored(r, optimal, s, SCENARIO.hours).profit
        acc.player.push(p)
        acc.optimal.push(o)
        if (p > o) acc.playerWins++
      }
      if (acc.player.length < WEEKS) setTimeout(batch, 0)
      else setSpread(acc)
    }
    setSpread(null)
    const id = setTimeout(batch, 50)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [r, player, optimal, seed])
  return spread
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo)
}

interface Row {
  label: string
  color: string
  expected: number
  run: number
  weeks: number[] | null
}

export function OutcomeChart({ rows }: { rows: Row[] }) {
  const [hover, setHover] = useState<string | null>(null)
  const W = 620
  const H = 64 + rows.length * 46
  const M = { l: 92, r: 18, t: 22, b: 26 }
  const all = rows.flatMap((r) => [r.expected, r.run, ...(r.weeks ? [quantile(r.weeks, 0.05), quantile(r.weeks, 0.95)] : [])])
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = Math.max(1, (hi - lo) * 0.08)
  const ticks = niceTicks(lo - pad, hi + pad, 5)
  const d0 = Math.min(ticks[0], lo - pad)
  const d1 = Math.max(ticks[ticks.length - 1], hi + pad)
  const sx = scale(d0, d1, M.l, W - M.r)
  const rowY = (i: number) => M.t + 24 + i * 46

  const readout =
    hover ??
    'Filled dot: the expected week, averaged over every week that could happen. Hollow ring: the week you were scored on. Bar: where 90% of 150 more simulated weeks landed.'

  return (
    <figure>
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
        {rows.map((r) => (
          <span key={r.label} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
            {r.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden>
            <circle cx="6" cy="6" r="4.5" fill={VIZ.secondary} />
          </svg>
          expected week
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden>
            <circle cx="6" cy="6" r="4" fill="none" stroke={VIZ.secondary} strokeWidth="2" />
          </svg>
          this scored week
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2 w-5 rounded-full bg-ink-soft/25" />
          90% of simulated weeks
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Profit outcomes for your plan and the optimizer's plan">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke={VIZ.grid} />
            <text x={sx(t)} y={H - M.b + 14} fontSize="10" textAnchor="middle" fill={VIZ.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtMoney(t)}
            </text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 2} fontSize="10" textAnchor="middle" fill={VIZ.secondary}>
          5-day profit
        </text>
        {rows.map((r, i) => {
          const y = rowY(i)
          const p5 = r.weeks ? quantile(r.weeks, 0.05) : null
          const p95 = r.weeks ? quantile(r.weeks, 0.95) : null
          return (
            <g key={r.label}>
              <text x={M.l - 10} y={y + 4} fontSize="12" fontWeight="600" textAnchor="end" fill={VIZ.ink}>
                {r.label}
              </text>
              {p5 !== null && p95 !== null ? (
                <rect
                  x={sx(p5)}
                  y={y - 5}
                  width={Math.max(4, sx(p95) - sx(p5))}
                  height={10}
                  rx={5}
                  fill={r.color}
                  fillOpacity={0.2}
                  onPointerEnter={() => setHover(`${r.label}: 90% of 150 simulated weeks earned between ${fmtMoney(p5)} and ${fmtMoney(p95)}.`)}
                  onPointerLeave={() => setHover(null)}
                />
              ) : (
                <text x={sx(r.expected)} y={y - 12} fontSize="10" textAnchor="middle" fill={VIZ.muted}>
                  simulating more weeks…
                </text>
              )}
              <circle
                cx={sx(r.expected)}
                cy={y}
                r={6.5}
                fill={r.color}
                stroke={VIZ.surface}
                strokeWidth={2}
                onPointerEnter={() => setHover(`${r.label}: expected ${fmtMoney(r.expected)} in an average week.`)}
                onPointerLeave={() => setHover(null)}
              />
              <circle
                cx={sx(r.run)}
                cy={y}
                r={6}
                fill={VIZ.surface}
                fillOpacity={0.6}
                stroke={r.color}
                strokeWidth={2.5}
                onPointerEnter={() => setHover(`${r.label}: earned ${fmtMoney(r.run)} in the scored week.`)}
                onPointerLeave={() => setHover(null)}
              />
              <circle cx={sx(r.run)} cy={y} r={12} fill="transparent" onPointerEnter={() => setHover(`${r.label}: earned ${fmtMoney(r.run)} in the scored week.`)} onPointerLeave={() => setHover(null)} />
            </g>
          )
        })}
      </svg>
      <figcaption className="min-h-[2.5rem] text-sm text-ink-soft" aria-live="polite">
        {readout}
      </figcaption>
    </figure>
  )
}
