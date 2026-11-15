import { arrivalRate, baristaCost, isFeasible, priceOf, resourceUse } from '../engine/model'
import { SCENARIO } from '../engine/scenario'
import type { DecisionKey, RoundSpec } from '../engine/types'
import { fmtInt, fmtPrice } from '../lib/format'
import { useGame } from '../store/game'
import { VIZ } from './chartKit'

const SWATCH: Partial<Record<DecisionKey, string>> = { hot: VIZ.hot, cold: VIZ.cold }

export function DecisionPanel({ r }: { r: RoundSpec }) {
  const draft = useGame((s) => s.draft)
  const tried = useGame((s) => s.tried)
  const setDraft = useGame((s) => s.setDraft)
  const resetDraft = useGame((s) => s.resetDraft)
  const trySolution = useGame((s) => s.trySolution)
  const submit = useGame((s) => s.submit)

  const feasible = isFeasible(r, draft)
  const changed = r.decisions.some((k) => draft[k] !== tried[k])
  const use = resourceUse(r, draft)
  const short = [use.beans > r.resources.beans && 'beans', use.water > r.resources.water && 'water'].filter(Boolean).join(' and ')

  return (
    <section aria-labelledby="dp-title" className="rounded-xl bg-[#fffdf8] p-3 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <h3 id="dp-title" className="text-sm font-semibold text-coffee-900">
          Your decisions
        </h3>
        <span
          role="status"
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${feasible ? 'bg-[#e3f5e3] text-[#006300]' : 'bg-[#fde8e8] text-[#b42318]'}`}
        >
          {feasible ? '✓ Feasible' : '⚠ INFEASIBLE'}
        </span>
      </div>

      <div className="mt-2 space-y-3">
        {r.decisions.map((key) => {
          const s = SCENARIO.sliders[key]
          const quantity = key === 'hot' || key === 'cold'
          const red = quantity && !feasible
          const id = `slider-${key}`
          return (
            <div key={key}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-coffee-900">
                  {SWATCH[key] && <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SWATCH[key] }} />}
                  {s.label}
                </label>
                <div className="flex items-center gap-1">
                  {key === 'markup' && <span className="text-sm text-[#52514e]">$</span>}
                  <input
                    type="number"
                    aria-label={`${s.label} value`}
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={draft[key]}
                    onChange={(e) => setDraft(key, Number(e.target.value))}
                    className={`w-[4.5rem] rounded-md border px-1.5 py-0.5 text-right text-sm tabular-nums ${
                      red ? 'border-[#d03b3b] bg-[#fde8e8] font-semibold text-[#b42318]' : 'border-coffee-200 bg-white text-coffee-900'
                    }`}
                  />
                </div>
              </div>
              <input
                id={id}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={draft[key]}
                aria-valuetext={`${draft[key]} ${s.unit}`}
                onChange={(e) => setDraft(key, Number(e.target.value))}
                className={`slider mt-1 w-full ${red ? 'slider-bad' : ''}`}
              />
              {key === 'markup' && (
                <p className="text-xs text-[#52514e]">
                  Hot {fmtPrice(priceOf(r, 'hot', draft.markup))} · Cold {fmtPrice(priceOf(r, 'cold', draft.markup))} · about{' '}
                  {fmtInt(arrivalRate(r, draft.markup))} customers/h walk in
                </p>
              )}
              {key === 'service' && <p className="text-xs text-[#52514e]">Barista costs {fmtPrice(baristaCost(r, draft.service))} per hour</p>}
            </div>
          )
        })}
      </div>

      {!r.decisions.includes('markup') && (
        <p className="mt-2 text-xs text-[#52514e]">
          Prices are fixed: hot {fmtPrice(r.drinks.hot.price)}
          {r.drinks.cold.psi > 0 && <>, cold {fmtPrice(r.drinks.cold.price)}</>}. Brewing cost per cup: hot {fmtPrice(r.drinks.hot.cost)}
          {r.drinks.cold.psi > 0 && <>, cold {fmtPrice(r.drinks.cold.cost)}</>}.
        </p>
      )}

      {!feasible && <p className="mt-2 text-xs font-medium text-[#b42318]">Not enough {short} for this plan. Lower the brewing sliders.</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={trySolution}
          disabled={!feasible}
          className="flex-1 rounded-lg border-2 border-coffee-800 px-3 py-1.5 text-sm font-semibold text-coffee-900 transition hover:bg-coffee-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {changed ? 'Try Solution' : 'Run again'}
        </button>
        <button
          onClick={submit}
          disabled={!feasible}
          className="flex-1 rounded-lg bg-coffee-800 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-coffee-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit Solution
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-[#52514e]">
        <span>Submitting locks this plan in and scores it on a full 5-day run.</span>
        {changed && (
          <button onClick={resetDraft} className="shrink-0 underline decoration-dotted hover:text-coffee-900">
            Reset to last tried
          </button>
        )}
      </div>
    </section>
  )
}
