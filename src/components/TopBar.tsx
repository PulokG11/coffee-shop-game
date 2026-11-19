import type { ReactNode } from 'react'
import { fmtMoney } from '../lib/format'
import { useGame, useScenario } from '../store/game'

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <path d="M5 11h18v8a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" fill="#c8283b" />
      <path d="M23 13h2a3.5 3.5 0 0 1 0 7h-2" fill="none" stroke="#c8283b" strokeWidth="2.4" />
      <ellipse cx="14" cy="11" rx="9" ry="2.4" fill="#f2b134" />
      <path d="M10 7q-1.5-2.5 0-5M14.5 7q-1.5-2.5 0-5M19 7q-1.5-2.5 0-5" fill="none" stroke="#eceee4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function Trophy({ size = 18, color = '#f2b134' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className="shrink-0">
      <path d="M6 3h8v5a4 4 0 0 1-8 0z" fill={color} />
      <path d="M6 5H3.5a2.5 2.5 0 0 0 2.6 3.2M14 5h2.5a2.5 2.5 0 0 1-2.6 3.2" fill="none" stroke={color} strokeWidth="1.6" />
      <rect x="9" y="12" width="2" height="3" fill={color} />
      <rect x="6" y="15" width="8" height="2.2" rx="1" fill={color} />
    </svg>
  )
}

function CupMarker({ state }: { state: 'done' | 'current' | 'todo' }) {
  const fill = state === 'done' ? '#f2b134' : 'none'
  const stroke = state === 'todo' ? '#5d6f66' : '#f2b134'
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M2.5 5h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" fill={fill} stroke={stroke} strokeWidth="1.8" />
      <path d="M13.5 6.5h1a2 2 0 0 1 0 4h-1" fill="none" stroke={stroke} strokeWidth="1.6" />
    </svg>
  )
}

export function TopBar({ right }: { right?: ReactNode }) {
  const round = useGame((s) => s.round)
  const results = useGame((s) => s.results)
  const goHome = useGame((s) => s.goHome)
  const mode = useGame((s) => s.mode)
  const openLeaderboard = useGame((s) => s.openLeaderboard)
  const scn = useScenario()
  const score = results.reduce((a, r) => a + r.playerRun.profit, 0)

  return (
    <header className="sticky top-0 z-20 border-b-2 border-board-line bg-board/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <button onClick={goHome} className="flex items-center gap-2 font-display text-2xl text-chalk" aria-label="Back to the home screen">
          <Logo />
          <span className="hidden sm:inline">Coffee Shop Game</span>
        </button>
        <nav aria-label={`Round ${round} of ${scn.rounds.length}`} className="flex items-center gap-2">
          <span className="font-display text-lg text-chalk">Round {round}</span>
          <span className="flex items-center gap-0.5">
            {scn.rounds.map((r) => {
              const done = results.some((x) => x.round === r.round)
              const state = done ? 'done' : r.round === round ? 'current' : 'todo'
              return (
                <span key={r.round} title={`Round ${r.round}: ${r.title}${done ? ' (scored)' : ''}`} className={state === 'current' ? 'rounded-full ring-2 ring-marigold/60' : ''}>
                  <CupMarker state={state} />
                </span>
              )
            })}
          </span>
        </nav>
        <div className="flex items-center gap-3">
          {mode.kind === 'championship' && (
            <button
              onClick={() => openLeaderboard(mode.code)}
              title={`${mode.matchName}: open the leaderboard`}
              className="flex items-center gap-1.5 rounded-full border-2 border-marigold/70 px-3 py-1 font-display text-base text-marigold hover:border-marigold"
            >
              <Trophy />
              <span className="max-w-[11rem] truncate">{mode.matchKind === 'weekly' ? 'Weekly match' : mode.code}</span>
            </button>
          )}
          <div className="till flex items-baseline gap-2 px-3 py-1.5">
            <span className="text-xs text-chalk-dim">Score</span>
            <span className="till-digits text-lg">{fmtMoney(score)}</span>
          </div>
          {right}
        </div>
      </div>
    </header>
  )
}
