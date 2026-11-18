import type { RoundSpec } from '../engine/types'
import { fmtInt, fmtMoney } from '../lib/format'
import { SPEEDS, useLive } from '../store/live'

export function SimControls() {
  const speed = useLive((s) => s.speed)
  const paused = useLive((s) => s.paused)
  const setSpeed = useLive((s) => s.setSpeed)
  const togglePause = useLive((s) => s.togglePause)
  const hours = useLive((s) => s.metrics?.hours ?? 0)
  const day = Math.min(5, Math.floor(hours / 24) + 1)
  const h = Math.floor(hours % 24)
  const m = Math.floor((hours * 60) % 60)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-board-raised px-3 py-2">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-2xl leading-none text-chalk">
          Day {day}, {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
        </span>
        <span className="text-sm text-chalk-dim">hour {Math.min(120, Math.floor(hours))} of 120</span>
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label="Simulation speed">
        <button onClick={togglePause} aria-pressed={paused} className="btn btn-chalk min-w-[5.5rem] px-3 py-1.5 text-base">
          {paused ? '▶ Play' : '❚❚ Pause'}
        </button>
        {SPEEDS.map((s) => {
          const on = speed === s && !paused
          return (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              aria-pressed={on}
              aria-label={`Speed ${s} times`}
              className={`btn px-2.5 py-1.5 text-base tabular-nums ${on ? 'btn-marigold' : 'btn-chalk'}`}
            >
              {s}×
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Cell({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-sm text-chalk-dim">{label}</div>
      <div className="till-digits text-2xl leading-tight">{value}</div>
      {note && <div className="text-xs text-chalk-dim/80">{note}</div>}
    </div>
  )
}

/** Live numbers for the running week, styled as the shop's till. */
export function LiveStats({ r }: { r: RoundSpec }) {
  const m = useLive((s) => s.metrics)
  if (!m) return null
  const cupsShort = m.cupsShort.hot + m.cupsShort.cold
  const wasted = m.cupsWasted.hot + m.cupsWasted.cold
  return (
    <div className="till grid grid-cols-2 divide-chalk/10 sm:grid-cols-3 sm:divide-x xl:grid-cols-6" aria-label="Live shop numbers">
      <Cell label="Profit so far" value={fmtMoney(m.profit)} />
      <Cell label="Served" value={fmtInt(m.served + m.partial)} note={m.partial ? `${fmtInt(m.partial)} only partly` : 'customers'} />
      <Cell label="Ran out" value={fmtInt(r.orders ? cupsShort : m.stockouts)} note={r.orders ? 'cups' : 'customers'} />
      <Cell label="Walked away" value={r.balk ? fmtInt(m.balked) : '0'} note={r.balk ? 'line too long' : 'no balking yet'} />
      <Cell label="Cups wasted" value={fmtInt(wasted)} />
      <Cell label="Average wait" value={`${m.avgWaitMin.toFixed(1)} min`} />
    </div>
  )
}
