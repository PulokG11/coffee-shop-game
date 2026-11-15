import { useEffect, useRef, useState } from 'react'
import type { RoundSpec } from '../engine/types'
import type { Tip } from '../lib/tips'

export function CremaAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#f0d5a0" />
      <path d="M10 15h18v9a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" fill="#723c14" />
      <path d="M28 17h2a3 3 0 0 1 0 6h-2" fill="none" stroke="#723c14" strokeWidth="2" />
      <ellipse cx="19" cy="15" rx="9" ry="2.2" fill="#d4883c" />
      <circle cx="15.5" cy="22" r="1.3" fill="#fdf8f0" />
      <circle cx="22.5" cy="22" r="1.3" fill="#fdf8f0" />
      <path d="M16 26q3 2.5 6 0" fill="none" stroke="#fdf8f0" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M15 11q-1.5-2.5 0-5M20 11q-1.5-2.5 0-5M25 11q-1.5-2.5 0-5" fill="none" stroke="#b8651e" strokeWidth="1.2" strokeLinecap="round" />
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
        className="relative flex items-center gap-2 rounded-full bg-coffee-100 py-1 pl-1 pr-3 text-sm font-semibold text-coffee-900 hover:bg-coffee-200"
      >
        <CremaAvatar size={30} />
        Crema
        {fresh && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#d03b3b] text-xs font-bold text-white motion-safe:animate-bounce">
            !
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Tips from Crema" className="absolute right-0 z-30 mt-2 w-[min(22rem,90vw)] rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/10">
          <ul className="space-y-3">
            {tips.map((t) => (
              <li key={t.id}>
                <div className="text-sm font-semibold text-coffee-900">{t.title}</div>
                <p className="text-sm text-[#52514e]">{t.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function RoundIntro({ r, onClose }: { r: RoundSpec; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    btn.current?.focus()
  }, [])
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="w-full max-w-lg rounded-2xl bg-[#fffdf8] p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <CremaAvatar size={56} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-coffee-500">Round {r.round} of 8 · New today</p>
            <h2 id="intro-title" className="font-display text-2xl font-bold text-coffee-900">
              {r.title}
            </h2>
            <p className="text-sm font-medium text-coffee-700">{r.wrinkle}</p>
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-coffee-900">{r.intro}</p>
        <p className="mt-3 text-sm text-[#52514e]">
          Move the sliders to build a plan, press <b>Try Solution</b> to watch it run, and <b>Submit Solution</b> when you trust it.
        </p>
        <button ref={btn} onClick={onClose} className="mt-4 w-full rounded-lg bg-coffee-800 py-2 font-semibold text-white hover:bg-coffee-900">
          Let’s brew
        </button>
      </div>
    </div>
  )
}
