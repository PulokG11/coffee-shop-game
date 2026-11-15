import type { RoundSpec } from '../engine/types'
import { fmtClock, fmtInt, fmtMoney } from '../lib/format'
import { SPEEDS, useLive } from '../store/live'

export function SimControls() {
  const speed = useLive((s) => s.speed)
  const paused = useLive((s) => s.paused)
  const setSpeed = useLive((s) => s.setSpeed)
  const togglePause = useLive((s) => s.togglePause)
  const hours = useLive((s) => s.metrics?.hours ?? 0)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm font-semibold tabular-nums text-coffee-900" aria-live="off">
        {fmtClock(hours)} <span className="font-normal text-[#52514e]">· hour {Math.min(120, Math.floor(hours))} of 120</span>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Simulation speed">
        <button
          onClick={togglePause}
          aria-pressed={paused}
          className="rounded-md bg-coffee-100 px-2 py-0.5 text-xs font-semibold text-coffee-900 hover:bg-coffee-200"
        >
          {paused ? '▶ Play' : '❚❚ Pause'}
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s && !paused}
            className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
              speed === s ? 'bg-coffee-800 text-white' : 'bg-coffee-100 text-coffee-900 hover:bg-coffee-200'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg bg-[#fffdf8] px-3 py-2 ring-1 ring-black/5">
      <div className="text-xs text-[#52514e]">{label}</div>
      <div className="text-lg font-semibold text-coffee-900">{value}</div>
      {note && <div className="text-[11px] text-[#898781]">{note}</div>}
    </div>
  )
}

export function LiveStats({ r }: { r: RoundSpec }) {
  const m = useLive((s) => s.metrics)
  if (!m) return null
  const cupsShort = m.cupsShort.hot + m.cupsShort.cold
  const wasted = m.cupsWasted.hot + m.cupsWasted.cold
  const lostLabel = r.orders ? 'Cups we ran out of' : 'Ran out for'
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Live shop numbers">
      <Tile label="Profit so far" value={fmtMoney(m.profit)} />
      <Tile label="Customers served" value={fmtInt(m.served + m.partial)} note={m.partial ? `${fmtInt(m.partial)} got only part of their order` : undefined} />
      <Tile label={lostLabel} value={fmtInt(r.orders ? cupsShort : m.stockouts)} note={r.orders ? 'cups' : 'customers'} />
      <Tile label="Walked away" value={r.balk ? fmtInt(m.balked) : '—'} note={r.balk ? 'line too long' : 'no balking yet'} />
      <Tile label="Cups wasted" value={fmtInt(wasted)} />
      <Tile label="Average wait" value={`${m.avgWaitMin.toFixed(1)} min`} />
    </div>
  )
}
