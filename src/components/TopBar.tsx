import type { ReactNode } from 'react'
import { SCENARIO } from '../engine/scenario'
import { fmtMoney } from '../lib/format'
import { useGame } from '../store/game'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M5 11h18v8a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" fill="#723c14" />
      <path d="M23 13h2a3.5 3.5 0 0 1 0 7h-2" fill="none" stroke="#723c14" strokeWidth="2.2" />
      <ellipse cx="14" cy="11" rx="9" ry="2.4" fill="#d4883c" />
      <path d="M10 7q-1.5-2.5 0-5M14.5 7q-1.5-2.5 0-5M19 7q-1.5-2.5 0-5" fill="none" stroke="#b8651e" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function TopBar({ right }: { right?: ReactNode }) {
  const round = useGame((s) => s.round)
  const results = useGame((s) => s.results)
  const goHome = useGame((s) => s.goHome)
  const score = results.reduce((a, r) => a + r.playerRun.profit, 0)

  return (
    <header className="sticky top-0 z-20 border-b border-coffee-200 bg-coffee-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        <button onClick={goHome} className="flex items-center gap-2 rounded-md font-display text-lg font-bold text-coffee-900" aria-label="Back to the home screen">
          <Logo />
          <span className="hidden sm:inline">Coffee Shop Game</span>
        </button>
        <nav aria-label="Rounds" className="flex items-center gap-1.5">
          <span className="mr-1 text-sm font-semibold text-coffee-900">
            Round {round}/{SCENARIO.rounds.length}
          </span>
          {SCENARIO.rounds.map((r) => {
            const done = results.some((x) => x.round === r.round)
            const current = r.round === round
            return (
              <span
                key={r.round}
                title={`Round ${r.round}: ${r.title}${done ? ' (scored)' : ''}`}
                className={`h-2.5 w-2.5 rounded-full ${current ? 'ring-2 ring-coffee-500 ring-offset-1' : ''} ${done ? 'bg-coffee-600' : 'bg-coffee-200'}`}
              />
            )
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-[#52514e]">Score</div>
            <div className="text-sm font-semibold tabular-nums text-coffee-900">{fmtMoney(score)}</div>
          </div>
          {right}
        </div>
      </div>
    </header>
  )
}
