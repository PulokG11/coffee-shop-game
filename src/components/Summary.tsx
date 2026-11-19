import { useMemo } from 'react'
import { getRound } from '../engine/scenario'
import { fmtMoney } from '../lib/format'
import { useGame, useScenario } from '../store/game'
import { VIZ } from './chartKit'
import { CremaAvatar } from './Guide'

const LESSONS = [
  ['Feasible is not the same as good', 'Every plan inside the beans and water limits was allowed, yet their profits differed enormously.'],
  ['One week does not judge a decision', 'The same plan earns different amounts in different weeks. Judge a plan by its spread of outcomes, not one lucky or unlucky run.'],
  ['Intuition breaks down', 'Prices, lines and group orders interact. Curves peaked, flattened and shifted in ways that are hard to guess.'],
  ['Optimization and simulation work together', 'The optimizer picks the plan that is best on average; simulation shows how that plan behaves week by week.'],
]

export function Summary() {
  const unsorted = useGame((s) => s.results)
  const results = useMemo(() => [...unsorted].sort((a, b) => a.round - b.round), [unsorted])
  const newGame = useGame((s) => s.newGame)
  const goHome = useGame((s) => s.goHome)
  const scn = useScenario()
  const mode = useGame((s) => s.mode)
  const openLeaderboard = useGame((s) => s.openLeaderboard)
  const you = results.reduce((a, r) => a + r.playerRun.profit, 0)
  const opt = results.reduce((a, r) => a + r.optimalRun.profit, 0)
  const youE = results.reduce((a, r) => a + r.playerExpected, 0)
  const optE = results.reduce((a, r) => a + r.optimalExpected, 0)
  const wins = results.filter((r) => r.playerRun.profit > r.optimalRun.profit).length

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6">
      <p className="font-display text-xl text-marigold">Five days, eight rounds</p>
      <h1 className="font-display text-5xl leading-none text-chalk">Final results</h1>

      <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="till px-5 py-4">
          <div className="text-chalk-dim">Your total score</div>
          <div className="till-digits text-5xl leading-tight">{fmtMoney(you)}</div>
        </div>
        <div className="till px-5 py-4">
          <div className="text-chalk-dim">Optimizer’s total</div>
          <div className="till-digits text-3xl leading-tight">{fmtMoney(opt)}</div>
        </div>
        <div className="till px-5 py-4">
          <div className="text-chalk-dim">Your plans on average</div>
          <div className="till-digits text-3xl leading-tight">{optE > 0 ? `${Math.round((youE / optE) * 100)}%` : '—'}</div>
          <div className="text-sm text-chalk-dim">of the optimizer’s expected profit</div>
        </div>
      </div>

      <div className="mt-5 flex max-w-3xl items-start gap-3">
        <CremaAvatar size={52} />
        <p className="rounded-2xl rounded-tl-sm bg-paper p-4 leading-relaxed text-ink">
          You beat the optimizer in {wins} of {results.length} scored weeks.{' '}
          {wins > 0
            ? 'Those wins were real, but they came from the customers who happened to show up. Over many weeks, the plans that are best on average pull ahead.'
            : 'Matching an optimizer by hand is hard when every week is random, and that is the point of using one.'}
        </p>
      </div>

      <section aria-label="Round by round" className="ticket-hang mt-8">
        <div className="ticket overflow-x-auto">
          <h2 className="ticket-title">Round by round</h2>
          <table className="mt-2 w-full min-w-[560px] text-[15px]">
            <thead>
              <tr className="text-left text-sm text-ink-soft">
                <th className="py-1 font-normal">Round</th>
                <th className="py-1 text-right font-bold">
                  <Swatch c={VIZ.you} /> You
                </th>
                <th className="py-1 text-right font-bold">
                  <Swatch c={VIZ.optimizer} /> Optimizer
                </th>
                <th className="py-1 text-right font-normal">You, expected</th>
                <th className="py-1 text-right font-normal">Optimizer, expected</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {results.map((res) => (
                <tr key={res.round} className="border-t border-dashed border-paper-edge">
                  <td className="py-1.5">
                    {res.round}. {getRound(scn, res.round).title}
                  </td>
                  <td className="py-1.5 text-right font-bold">
                    {res.playerRun.profit > res.optimalRun.profit && <span title="You won this week">★ </span>}
                    {fmtMoney(res.playerRun.profit)}
                  </td>
                  <td className="py-1.5 text-right">{fmtMoney(res.optimalRun.profit)}</td>
                  <td className="py-1.5 text-right text-ink-soft">{fmtMoney(res.playerExpected)}</td>
                  <td className="py-1.5 text-right text-ink-soft">{fmtMoney(res.optimalExpected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-ink-soft">★ marks weeks where your plan earned more than the optimizer’s with the same customers.</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-3xl text-chalk">What the week showed</h2>
        <div className="mt-4 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {LESSONS.map(([t, d]) => (
            <div key={t} className="chalk-rule pt-3">
              <h3 className="font-display text-xl text-chalk">{t}</h3>
              <p className="mt-1 text-chalk-dim">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 flex justify-end gap-3">
        <button onClick={goHome} className="btn btn-chalk px-5 py-3">
          Home
        </button>
        {mode.kind === 'championship' ? (
          <button onClick={() => openLeaderboard(mode.code)} className="btn btn-cherry px-6 py-3 text-xl">
            See the leaderboard
          </button>
        ) : (
          <button onClick={newGame} className="btn btn-cherry px-6 py-3 text-xl">
            Play again
          </button>
        )}
      </div>
    </main>
  )
}

const Swatch = ({ c }: { c: string }) => <span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: c }} />
