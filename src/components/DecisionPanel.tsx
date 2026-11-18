import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { arrivalRate, baristaCost, isFeasible, priceOf, resourceUse } from '../engine/model'
import { SCENARIO } from '../engine/scenario'
import type { DecisionKey, RoundSpec } from '../engine/types'
import { fmtInt, fmtPrice } from '../lib/format'
import { useGame } from '../store/game'
import { KEY_LABEL, VIZ, fmtDecision } from './chartKit'

const SWATCH: Partial<Record<DecisionKey, string>> = { hot: VIZ.hot, cold: VIZ.cold }

export function DecisionPanel({ r }: { r: RoundSpec }) {
  const draft = useGame((s) => s.draft)
  const tried = useGame((s) => s.tried)
  const setDraft = useGame((s) => s.setDraft)
  const resetDraft = useGame((s) => s.resetDraft)
  const trySolution = useGame((s) => s.trySolution)
  const [confirming, setConfirming] = useState(false)

  const feasible = isFeasible(r, draft)
  const changed = r.decisions.some((k) => draft[k] !== tried[k])
  const use = resourceUse(r, draft)
  const short = [use.beans > r.resources.beans && 'beans', use.water > r.resources.water && 'water'].filter(Boolean).join(' and ')

  return (
    <section aria-labelledby="dp-title" className="ticket-hang">
      <div className="ticket">
        <div className="flex items-start justify-between gap-2">
          <h3 id="dp-title" className="ticket-title">
            Your plan
          </h3>
          <span role="status" className={`stamp ${feasible ? 'border-good-ink text-good-ink' : 'border-bad-ink text-bad-ink'}`}>
            {feasible ? 'Feasible' : 'Infeasible'}
          </span>
        </div>

        <div className="mt-3 space-y-4">
          {r.decisions.map((key) => {
            const s = SCENARIO.sliders[key]
            const red = (key === 'hot' || key === 'cold') && !feasible
            const id = `slider-${key}`
            return (
              <div key={key}>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={id} className="flex items-center gap-1.5 text-[15px] font-bold">
                    {SWATCH[key] && <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: SWATCH[key] }} />}
                    {s.label}
                  </label>
                  <div className="flex items-center gap-1">
                    {key === 'markup' && <span className="text-ink-soft">$</span>}
                    <input
                      type="number"
                      aria-label={`${s.label} value`}
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={draft[key]}
                      onChange={(e) => setDraft(key, Number(e.target.value))}
                      className={`w-[4.75rem] rounded-lg border-2 px-2 py-0.5 text-right text-base font-bold tabular-nums ${
                        red ? 'border-bad bg-bad-tint text-bad-ink' : 'border-paper-edge bg-paper text-ink'
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
                  className={`slider mt-2 w-full ${red ? 'slider-bad' : ''}`}
                />
                {key === 'markup' && (
                  <p className="mt-1 text-sm text-ink-soft">
                    Hot {fmtPrice(priceOf(r, 'hot', draft.markup))}, cold {fmtPrice(priceOf(r, 'cold', draft.markup))}. About {fmtInt(arrivalRate(r, draft.markup))}{' '}
                    customers an hour walk in.
                  </p>
                )}
                {key === 'service' && <p className="mt-1 text-sm text-ink-soft">This barista costs {fmtPrice(baristaCost(r, draft.service))} an hour.</p>}
              </div>
            )
          })}
        </div>

        {!feasible && <p className="mt-3 text-sm font-bold text-bad-ink">Not enough {short} for this plan. Lower the brewing sliders.</p>}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={trySolution} disabled={!feasible} className="btn btn-paper">
            {changed ? 'Try solution' : 'Run again'}
          </button>
          <button onClick={() => setConfirming(true)} disabled={!feasible} className="btn btn-cherry">
            Submit
          </button>
        </div>
        {changed && (
          <button onClick={resetDraft} className="mt-2 text-sm text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink">
            Reset to the plan that’s running
          </button>
        )}
      </div>
      {confirming && <ConfirmSubmit r={r} onCancel={() => setConfirming(false)} />}
    </section>
  )
}

function ConfirmSubmit({ r, onCancel }: { r: RoundSpec; onCancel: () => void }) {
  const draft = useGame((s) => s.draft)
  const submit = useGame((s) => s.submit)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Portal: the ticket's drop-shadow filter would otherwise trap position:fixed inside it
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="ticket-hang w-full max-w-md">
        <div className="ticket px-6 pt-6">
          <h2 id="confirm-title" className="font-display text-3xl leading-none">
            Lock in this plan?
          </h2>
          <dl className="mt-4 text-[15px]">
            {r.decisions.map((k) => (
              <div key={k} className="flex justify-between border-t border-dashed border-paper-edge py-1.5">
                <dt className="text-ink-soft">{KEY_LABEL[k]}</dt>
                <dd className="font-bold tabular-nums">{fmtDecision(k, draft[k])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[15px] text-ink-soft">
            Your plan and the optimizer’s will each run one fresh five-day week with the same customers. You can’t change this round afterwards.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button ref={cancelRef} onClick={onCancel} className="btn btn-paper">
              Keep testing
            </button>
            <button onClick={submit} className="btn btn-cherry">
              Lock it in
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
