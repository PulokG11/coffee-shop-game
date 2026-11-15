import { useMemo } from 'react'
import { SCENARIO, getRound } from '../engine/scenario'
import type { SimMetrics } from '../engine/sim'
import type { DecisionKey } from '../engine/types'
import { fmtInt, fmtMoney } from '../lib/format'
import { comparisonMessage } from '../lib/tips'
import { useGame, type RoundResult } from '../store/game'
import { KEY_LABEL, VIZ, fmtDecision } from './chartKit'
import { CremaAvatar } from './Guide'
import { OutcomeChart, useSpread } from './OutcomeChart'

export function Comparison() {
  const round = useGame((s) => s.round)
  const result = useGame((s) => s.results.find((x) => x.round === s.round))
  const nextRound = useGame((s) => s.nextRound)
  if (!result) return null
  return <ComparisonBody key={round} result={result} onNext={nextRound} />
}

function ComparisonBody({ result, onNext }: { result: RoundResult; onNext: () => void }) {
  const r = getRound(SCENARIO, result.round)
  const spread = useSpread(r, result.player, result.optimal, result.seed)
  const youWon = result.playerRun.profit > result.optimalRun.profit
  const samePlan = r.decisions.every((k) => result.player[k] === result.optimal[k])
  const verdict = samePlan
    ? 'You found the optimizer’s plan.'
    : youWon
      ? '🎉 You beat the optimizer this week.'
      : result.playerRun.profit === result.optimalRun.profit
        ? 'A tie this week.'
        : 'The optimizer came out ahead this week.'
  const message = useMemo(
    () =>
      comparisonMessage({
        playerRun: result.playerRun.profit,
        optimalRun: result.optimalRun.profit,
        playerExpected: result.playerExpected,
        optimalExpected: result.optimalExpected,
      }),
    [result],
  )
  const last = result.round === SCENARIO.rounds.length

  return (
    <main className="mx-auto max-w-6xl px-4 py-5">
      <div className="rounded-2xl bg-[#fffdf8] p-5 shadow-sm ring-1 ring-black/5">
        <p className="text-xs font-semibold uppercase tracking-wide text-coffee-500">
          Round {result.round} results · {r.title}
        </p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Headline label="Your week" value={result.playerRun.profit} color={VIZ.you} />
          <Headline label="Optimizer’s week" value={result.optimalRun.profit} color={VIZ.optimizer} />
        </div>
        <p className="mt-3 text-sm font-semibold text-coffee-900">
          {verdict}{' '}
          <span className="font-normal text-[#52514e]">Both plans served exactly the same stream of customers.</span>
        </p>
        <div className="mt-3 flex gap-3 rounded-xl bg-coffee-50 p-3">
          <CremaAvatar size={44} />
          <p className="text-sm leading-relaxed text-coffee-900">{message}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <section className="rounded-2xl bg-[#fffdf8] p-4 shadow-sm ring-1 ring-black/5">
          <h3 className="text-sm font-semibold text-coffee-900">Settings</h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#52514e]">
                <th className="py-1 font-medium">Decision</th>
                <th className="py-1 text-right font-medium">You</th>
                <th className="py-1 text-right font-medium">Optimizer</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {r.decisions.map((k: DecisionKey) => (
                <tr key={k} className="border-t border-coffee-100">
                  <td className="py-1.5">{KEY_LABEL[k]}</td>
                  <td className="py-1.5 text-right">{fmtDecision(k, result.player[k])}</td>
                  <td className="py-1.5 text-right">{fmtDecision(k, result.optimal[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-4 text-sm font-semibold text-coffee-900">This week</h3>
          <MetricsTable r={r} you={result.playerRun} opt={result.optimalRun} result={result} />
        </section>

        <section className="rounded-2xl bg-[#fffdf8] p-4 shadow-sm ring-1 ring-black/5">
          <h3 className="text-sm font-semibold text-coffee-900">One week is just one possible future</h3>
          <OutcomeChart
            rows={[
              { label: 'You', color: VIZ.you, expected: result.playerExpected, run: result.playerRun.profit, weeks: spread?.player ?? null },
              { label: 'Optimizer', color: VIZ.optimizer, expected: result.optimalExpected, run: result.optimalRun.profit, weeks: spread?.optimal ?? null },
            ]}
          />
          <p className="mt-2 text-sm text-coffee-900" aria-live="polite">
            {samePlan
              ? 'Your plan is the optimizer’s plan, so the two tie in every possible week. The spread above is what randomness alone does to one plan.'
              : spread
              ? `Replaying ${spread.player.length} more weeks with identical customers for both plans, yours came out ahead in ${spread.playerWins} of them (${Math.round((spread.playerWins / spread.player.length) * 100)}%).`
              : 'Replaying 150 more weeks for both plans…'}
          </p>
          <p className="mt-2 text-xs text-[#52514e]">
            Optimizer: exact search of the expected-profit model over every slider setting ({fmtInt(result.candidates)} plans after pruning), solved in{' '}
            {result.solveMs < 1 ? 'under a millisecond' : `${result.solveMs.toFixed(0)} ms`}.
          </p>
        </section>
      </div>

      <div className="mt-5 flex justify-end">
        <button onClick={onNext} className="rounded-lg bg-coffee-800 px-5 py-2.5 font-semibold text-white hover:bg-coffee-900">
          {last ? 'See final results →' : `On to round ${result.round + 1} →`}
        </button>
      </div>
    </main>
  )
}

function Headline({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="h-10 w-1.5 rounded-full" style={{ background: color }} />
      <div>
        <div className="text-sm text-[#52514e]">{label}</div>
        <div className="text-3xl font-semibold text-coffee-900">{fmtMoney(value)}</div>
      </div>
    </div>
  )
}

function MetricsTable({ r, you, opt, result }: { r: ReturnType<typeof getRound>; you: SimMetrics; opt: SimMetrics; result: RoundResult }) {
  const rows: [string, (m: SimMetrics) => string][] = [
    ['Profit', (m) => fmtMoney(m.profit)],
    ['Revenue', (m) => fmtMoney(m.revenue)],
    ['Brewing cost', (m) => fmtMoney(m.brewCost)],
  ]
  if (r.service.costPerUnit > 0) rows.push(['Barista cost', (m) => fmtMoney(m.baristaCost)])
  rows.push(['Customers served', (m) => fmtInt(m.served + m.partial)])
  rows.push(
    r.orders
      ? ['Cups we ran out of', (m) => fmtInt(m.cupsShort.hot + m.cupsShort.cold)]
      : ['Customers we ran out for', (m) => fmtInt(m.stockouts)],
  )
  if (r.balk) rows.push(['Walked away (line too long)', (m) => fmtInt(m.balked)])
  rows.push(['Cups wasted', (m) => fmtInt(m.cupsWasted.hot + m.cupsWasted.cold)])
  rows.push(['Average wait', (m) => `${m.avgWaitMin.toFixed(1)} min`])

  return (
    <table className="mt-2 w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-[#52514e]">
          <th className="py-1 font-medium">Scored week</th>
          <th className="py-1 text-right font-medium">You</th>
          <th className="py-1 text-right font-medium">Optimizer</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map(([label, f]) => (
          <tr key={label} className="border-t border-coffee-100">
            <td className="py-1.5">{label}</td>
            <td className="py-1.5 text-right">{f(you)}</td>
            <td className="py-1.5 text-right">{f(opt)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-coffee-200 font-semibold">
          <td className="py-1.5">Expected profit (average week)</td>
          <td className="py-1.5 text-right">{fmtMoney(result.playerExpected)}</td>
          <td className="py-1.5 text-right">{fmtMoney(result.optimalExpected)}</td>
        </tr>
      </tbody>
    </table>
  )
}
