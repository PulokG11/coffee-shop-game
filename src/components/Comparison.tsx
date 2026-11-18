import { useMemo } from 'react'
import { SCENARIO, getRound } from '../engine/scenario'
import type { SimMetrics } from '../engine/sim'
import type { RoundSpec } from '../engine/types'
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
      ? 'You beat the optimizer this week!'
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
    <main className="mx-auto max-w-[1200px] px-4 py-6">
      <p className="font-display text-xl text-marigold">Round {result.round} results</p>
      <h1 className="font-display text-4xl leading-none text-chalk sm:text-5xl">{r.title}</h1>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TillScore label="Your week" value={result.playerRun.profit} color={VIZ.you} />
        <TillScore label="Optimizer’s week" value={result.optimalRun.profit} color={VIZ.optimizer} />
      </div>
      <p className="mt-4 text-chalk-dim">
        <span className="font-display text-2xl text-chalk">{verdict}</span> Both plans served exactly the same customers.
      </p>
      <div className="mt-4 flex max-w-3xl items-start gap-3">
        <CremaAvatar size={52} />
        <p className="rounded-2xl rounded-tl-sm bg-paper p-4 text-[16px] leading-relaxed text-ink">{message}</p>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_1.35fr]">
        <section aria-labelledby="receipt-title" className="ticket-hang">
          <div className="ticket">
            <h2 id="receipt-title" className="ticket-title">
              The receipt
            </h2>
            <table className="mt-2 w-full text-[15px]">
              <thead>
                <tr className="text-left text-sm text-ink-soft">
                  <th className="py-1 font-normal">Plan</th>
                  <th className="py-1 text-right font-bold">You</th>
                  <th className="py-1 text-right font-bold">Optimizer</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {r.decisions.map((k) => (
                  <tr key={k} className="border-t border-dashed border-paper-edge">
                    <td className="py-1.5">{KEY_LABEL[k]}</td>
                    <td className="py-1.5 text-right">{fmtDecision(k, result.player[k])}</td>
                    <td className="py-1.5 text-right">{fmtDecision(k, result.optimal[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <MetricsTable r={r} you={result.playerRun} opt={result.optimalRun} result={result} />
          </div>
        </section>

        <section aria-labelledby="spread-title" className="paper-card pt-5">
          <h2 id="spread-title" className="ticket-title">
            One week is just one possible future
          </h2>
          <OutcomeChart
            rows={[
              { label: 'You', color: VIZ.you, expected: result.playerExpected, run: result.playerRun.profit, weeks: spread?.player ?? null },
              { label: 'Optimizer', color: VIZ.optimizer, expected: result.optimalExpected, run: result.optimalRun.profit, weeks: spread?.optimal ?? null },
            ]}
          />
          <p className="mt-2 text-[15px]" aria-live="polite">
            {samePlan
              ? 'Your plan is the optimizer’s plan, so the two tie in every possible week. The spread above is what randomness alone does to one plan.'
              : spread
                ? `Replaying ${spread.player.length} more weeks with identical customers for both plans, yours came out ahead in ${spread.playerWins} of them (${Math.round((spread.playerWins / spread.player.length) * 100)}%).`
                : 'Replaying 150 more weeks for both plans…'}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            The optimizer searched every slider setting of the expected-profit model ({fmtInt(result.candidates)} plans after pruning) in{' '}
            {result.solveMs < 1 ? 'under a millisecond' : `${result.solveMs.toFixed(0)} ms`}.
          </p>
        </section>
      </div>

      <div className="mt-8 flex justify-end">
        <button onClick={onNext} className="btn btn-cherry px-7 py-3 text-xl">
          {last ? 'See final results' : `Start round ${result.round + 1}`}
        </button>
      </div>
    </main>
  )
}

function TillScore({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="till flex items-center gap-4 px-5 py-4">
      <span aria-hidden className="h-12 w-2 rounded-full" style={{ background: color }} />
      <div>
        <div className="text-chalk-dim">{label}</div>
        <div className="till-digits text-4xl leading-tight">{fmtMoney(value)}</div>
      </div>
    </div>
  )
}

function MetricsTable({ r, you, opt, result }: { r: RoundSpec; you: SimMetrics; opt: SimMetrics; result: RoundResult }) {
  const rows: [string, (m: SimMetrics) => string][] = [
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
    <table className="mt-4 w-full text-[15px]">
      <thead>
        <tr className="text-left text-sm text-ink-soft">
          <th className="py-1 font-normal">The scored week</th>
          <th className="py-1 text-right font-bold">You</th>
          <th className="py-1 text-right font-bold">Optimizer</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map(([label, f]) => (
          <tr key={label} className="border-t border-dashed border-paper-edge">
            <td className="py-1.5">{label}</td>
            <td className="py-1.5 text-right">{f(you)}</td>
            <td className="py-1.5 text-right">{f(opt)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-ink font-bold">
          <td className="py-1.5">Profit</td>
          <td className="py-1.5 text-right">{fmtMoney(you.profit)}</td>
          <td className="py-1.5 text-right">{fmtMoney(opt.profit)}</td>
        </tr>
        <tr className="text-ink-soft">
          <td className="py-1.5">Expected in an average week</td>
          <td className="py-1.5 text-right">{fmtMoney(result.playerExpected)}</td>
          <td className="py-1.5 text-right">{fmtMoney(result.optimalExpected)}</td>
        </tr>
      </tbody>
    </table>
  )
}
