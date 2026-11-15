import { useMemo } from 'react'
import { SCENARIO, getRound } from '../engine/scenario'
import { fmtMoney } from '../lib/format'
import { useGame } from '../store/game'
import { VIZ } from './chartKit'
import { CremaAvatar } from './Guide'

const LESSONS = [
  ['Feasible is not the same as good', 'Every plan inside the beans and water limits was allowed, yet their profits differed enormously.'],
  ['One week does not judge a decision', 'The same plan earns different amounts on different weeks. Judge a plan by its spread of outcomes, not one lucky or unlucky run.'],
  ['Intuition breaks down', 'Prices, lines and bigger orders interact. Curves peaked, flattened and shifted in ways that are hard to guess.'],
  ['Optimization and simulation work together', 'The optimizer picks the plan that is best on average; simulation shows how that plan behaves week by week.'],
]

export function Summary() {
  const unsorted = useGame((s) => s.results)
  const results = useMemo(() => [...unsorted].sort((a, b) => a.round - b.round), [unsorted])
  const newGame = useGame((s) => s.newGame)
  const goHome = useGame((s) => s.goHome)
  const you = results.reduce((a, r) => a + r.playerRun.profit, 0)
  const opt = results.reduce((a, r) => a + r.optimalRun.profit, 0)
  const youE = results.reduce((a, r) => a + r.playerExpected, 0)
  const optE = results.reduce((a, r) => a + r.optimalExpected, 0)
  const wins = results.filter((r) => r.playerRun.profit > r.optimalRun.profit).length

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <section className="rounded-2xl bg-[#fffdf8] p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-xs font-semibold uppercase tracking-wide text-coffee-500">The week is done</p>
        <h1 className="font-display text-3xl font-bold text-coffee-900">Final results</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-sm text-[#52514e]">Your total score</div>
            <div className="text-4xl font-semibold text-coffee-900">{fmtMoney(you)}</div>
          </div>
          <div>
            <div className="text-sm text-[#52514e]">Optimizer’s total</div>
            <div className="text-2xl font-semibold text-coffee-900">{fmtMoney(opt)}</div>
          </div>
          <div>
            <div className="text-sm text-[#52514e]">Your plans’ expected value</div>
            <div className="text-2xl font-semibold text-coffee-900">{optE > 0 ? `${Math.round((youE / optE) * 100)}%` : '—'}</div>
            <div className="text-xs text-[#52514e]">of the optimizer’s, on average</div>
          </div>
        </div>
        <div className="mt-4 flex gap-3 rounded-xl bg-coffee-50 p-3">
          <CremaAvatar size={44} />
          <p className="text-sm leading-relaxed text-coffee-900">
            You beat the optimizer in {wins} of {results.length} scored weeks.{' '}
            {wins > 0
              ? 'Those wins were real, but they came from the customers who happened to show up. Over many weeks, the plans that are best on average pull ahead.'
              : 'Matching an optimizer by hand is hard when every week is random, and that is the point of using one.'}
          </p>
        </div>
      </section>

      <section className="mt-4 overflow-x-auto rounded-2xl bg-[#fffdf8] p-4 shadow-sm ring-1 ring-black/5">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-[#52514e]">
              <th className="py-1 font-medium">Round</th>
              <th className="py-1 text-right font-medium">
                <Swatch c={VIZ.you} /> You (scored week)
              </th>
              <th className="py-1 text-right font-medium">
                <Swatch c={VIZ.optimizer} /> Optimizer
              </th>
              <th className="py-1 text-right font-medium">You, expected</th>
              <th className="py-1 text-right font-medium">Optimizer, expected</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {results.map((res) => (
              <tr key={res.round} className="border-t border-coffee-100">
                <td className="py-1.5">
                  {res.round}. {getRound(SCENARIO, res.round).title}
                </td>
                <td className="py-1.5 text-right font-semibold">
                  {res.playerRun.profit > res.optimalRun.profit && <span title="You won this week">★ </span>}
                  {fmtMoney(res.playerRun.profit)}
                </td>
                <td className="py-1.5 text-right">{fmtMoney(res.optimalRun.profit)}</td>
                <td className="py-1.5 text-right">{fmtMoney(res.playerExpected)}</td>
                <td className="py-1.5 text-right">{fmtMoney(res.optimalExpected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[#52514e]">★ marks weeks where your plan earned more than the optimizer’s on the same customers.</p>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        {LESSONS.map(([t, d]) => (
          <div key={t} className="rounded-xl bg-coffee-50 p-4 ring-1 ring-coffee-100">
            <h3 className="font-semibold text-coffee-900">{t}</h3>
            <p className="mt-1 text-sm text-[#52514e]">{d}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={goHome} className="rounded-lg border-2 border-coffee-800 px-4 py-2 font-semibold text-coffee-900 hover:bg-coffee-100">
          Home
        </button>
        <button onClick={newGame} className="rounded-lg bg-coffee-800 px-4 py-2 font-semibold text-white hover:bg-coffee-900">
          Play again
        </button>
      </div>
    </main>
  )
}

const Swatch = ({ c }: { c: string }) => <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: c }} />
