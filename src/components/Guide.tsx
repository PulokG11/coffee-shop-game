import { useEffect, useRef, useState } from 'react'
import { orderMoments } from '../engine/model'
import type { RoundSpec } from '../engine/types'
import { fmtInt, fmtPrice } from '../lib/format'
import type { Tip } from '../lib/tips'

export function CremaAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <circle cx="20" cy="20" r="20" fill="#f2b134" />
      <path d="M9 15h20v9a9 9 0 0 1-9 9h-2a9 9 0 0 1-9-9z" fill="#c8283b" />
      <path d="M29 17h2a3.2 3.2 0 0 1 0 6.4h-2" fill="none" stroke="#c8283b" strokeWidth="2.2" />
      <ellipse cx="19" cy="15" rx="10" ry="2.4" fill="#2a1d17" />
      <circle cx="15.5" cy="22.5" r="1.4" fill="#ffffff" />
      <circle cx="22.5" cy="22.5" r="1.4" fill="#ffffff" />
      <path d="M16 26.5q3 2.6 6 0" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15 11q-1.5-2.5 0-5M20 11q-1.5-2.5 0-5M25 11q-1.5-2.5 0-5" fill="none" stroke="#2a1d17" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function GuideButton({ tips }: { tips: Tip[] }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  const fresh = tips.some((t) => !seen.has(t.id))

  useEffect(() => {
    if (!open) return
    setSeen((s) => (tips.every((t) => s.has(t.id)) ? s : new Set([...s, ...tips.map((t) => t.id)])))
  }, [open, tips])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={fresh ? 'Crema has a new tip' : 'Open tips from Crema'}
        className="relative flex items-center gap-2 rounded-full border-2 border-chalk/40 bg-board-raised py-1 pl-1 pr-3 font-display text-lg text-chalk hover:border-chalk"
      >
        <CremaAvatar size={32} />
        Crema
        {fresh && (
          <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-cherry font-display text-sm text-white ring-2 ring-board motion-safe:animate-bounce">
            !
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Tips from Crema" className="absolute right-0 z-30 mt-3 w-[min(23rem,90vw)] rounded-2xl bg-paper p-4 text-ink shadow-2xl">
          <span aria-hidden className="absolute -top-2 right-10 h-4 w-4 rotate-45 bg-paper" />
          <ul className="space-y-3">
            {tips.map((t) => (
              <li key={t.id}>
                <div className="font-display text-lg leading-tight">{t.title}</div>
                <p className="text-[15px] leading-snug text-ink-soft">{t.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function briefingRows(r: RoundSpec): { drink: [string, string, string][]; shop: [string, string][] } {
  const cold = r.drinks.cold.psi > 0
  const markup = r.decisions.includes('markup')
  const val = (f: (d: 'hot' | 'cold') => string): [string, string] => [f('hot'), cold ? f('cold') : '—']
  const drink: [string, string, string][] = [
    ['Price per cup', ...(markup ? (['cost + markup', cold ? 'cost + markup' : '—'] as [string, string]) : val((d) => fmtPrice(r.drinks[d].price)))],
    ['Brewing cost per cup', ...val((d) => fmtPrice(r.drinks[d].cost))],
    ['Beans per cup', ...val((d) => `${r.drinks[d].use.beans} g`)],
    ['Water per cup', ...val((d) => `${r.drinks[d].use.water} ml`)],
    ['Share of customers', ...val((d) => `${Math.round(r.drinks[d].psi * 100)}%`)],
  ]
  const shop: [string, string][] = [
    ['Beans on hand each hour', `${fmtInt(r.resources.beans)} g`],
    ['Water on hand each hour', `${fmtInt(r.resources.water)} ml`],
    [
      'Customers walking in per hour',
      markup ? `about ${r.arrivals.lambda0} at a $0 markup, fewer as the markup rises` : `about ${r.arrivals.lambda0}`,
    ],
    [
      'Barista serves per hour',
      r.decisions.includes('service') ? `you choose; costs ${fmtPrice(r.service.costPerUnit)}/h for each customer per hour` : `about ${r.service.mu}`,
    ],
  ]
  if (r.balk) shop.push(['Long lines', 'some arriving customers leave'])
  if (r.orders) shop.push(['Cups per order', `1, 2 or 3 (average ${orderMoments(r).m1.toFixed(1)})`])
  return { drink, shop }
}

export function RoundIntro({ r, onClose }: { r: RoundSpec; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    btn.current?.focus()
  }, [])
  const { drink, shop } = briefingRows(r)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="my-auto w-full max-w-2xl rounded-2xl border-[10px] border-[#8a5a35] bg-board p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-4">
          <CremaAvatar size={64} />
          <div>
            <p className="font-display text-lg text-marigold">Round {r.round} of 8</p>
            <h2 id="intro-title" className="font-display text-4xl leading-none text-chalk">
              {r.title}
            </h2>
            <p className="mt-1 text-chalk-dim">{r.wrinkle}</p>
          </div>
        </div>
        <p className="mt-4 text-[17px] leading-relaxed text-chalk">{r.intro}</p>

        <div className="paper-card mt-4">
          <h3 className="font-display text-xl">Today’s numbers</h3>
          <table className="mt-1 w-full text-[15px]">
            <thead>
              <tr className="text-left text-sm text-ink-soft">
                <th className="py-1 font-normal" />
                <th className="py-1 text-right font-bold">
                  <span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#eb6834]" />
                  Hot
                </th>
                <th className="py-1 text-right font-bold">
                  <span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#2a78d6]" />
                  Cold
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {drink.map(([label, h, c]) => (
                <tr key={label} className="border-t border-paper-edge">
                  <td className="py-1">{label}</td>
                  <td className="py-1 text-right">{h}</td>
                  <td className="py-1 text-right">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-2 grid gap-x-4 text-[15px] sm:grid-cols-[auto_1fr]">
            {shop.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="border-t border-paper-edge py-1 text-ink-soft">{k}</dt>
                <dd className="border-t border-paper-edge py-1 sm:text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-4 text-chalk-dim">
          Move the sliders to build a plan, press <b className="text-chalk">Try solution</b> to watch it run, and <b className="text-chalk">Submit</b> when you trust it.
        </p>
        <div className="mt-4 flex justify-end">
          <button ref={btn} onClick={onClose} className="btn btn-cherry px-6 py-3 text-xl">
            Open the shop
          </button>
        </div>
      </div>
    </div>
  )
}
