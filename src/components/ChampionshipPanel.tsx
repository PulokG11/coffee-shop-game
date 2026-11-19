import { useState, type FormEvent, type ReactNode } from 'react'
import { isoWeekId, weekBounds, weeklyCode } from '../engine/weekly'
import { championshipApi } from '../lib/api/championship'
import { fmtUntil } from '../lib/format'
import { champProgress, isFinished, useGame } from '../store/game'
import { Trophy } from './TopBar'

const field =
  'mt-1 w-full rounded-lg border-2 border-paper-edge bg-paper px-3 py-2 text-[16px] text-ink placeholder:text-ink-faint focus-visible:border-marigold'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[15px] font-bold text-chalk">{label}</span>
      {hint && <span className="ml-2 text-sm text-chalk-dim">{hint}</span>}
      {children}
    </label>
  )
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-3 rounded-lg bg-bad-tint px-3 py-2 text-[15px] font-bold text-bad-ink">
      {message}
    </p>
  )
}

export function ChampionshipPanel() {
  const state = useGame()
  const current = champProgress(state)
  const unfinished = current && !isFinished(current) && current.mode.kind === 'championship' ? current.mode : null

  return (
    <section id="championship" aria-labelledby="champ-title" className="mx-auto max-w-[1400px] px-4 py-10">
      <h2 id="champ-title" className="flex items-center gap-2 font-display text-3xl text-chalk">
        <Trophy size={28} /> Championship mode
      </h2>
      <p className="mt-2 max-w-3xl text-chalk-dim">
        Championships are for classes and events. Everyone in a match faces exactly the same customers, the server scores every round, and the leaderboard
        ranks total profit. The optimizer’s plans stay secret. To play on your own, choose Play the game instead.
      </p>
      {unfinished && (
        <p className="mt-3 max-w-3xl text-marigold">
          You’re partway through {unfinished.matchName}. Joining another match replaces that game on this device; your scores there stay on its leaderboard.
        </p>
      )}
      <div className="mt-6 grid gap-x-10 gap-y-10 lg:grid-cols-3">
        <JoinClass />
        <JoinWeekly />
        <CreateMatch />
      </div>
    </section>
  )
}

function useJoin() {
  const startChampionship = useGame((s) => s.startChampionship)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const join = async (code: string, name: string) => {
    setBusy(true)
    setError(null)
    try {
      startChampionship(await championshipApi.join(code, name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the match')
      setBusy(false)
    }
  }
  return { busy, error, join }
}

function JoinClass({ initialCode = '' }: { initialCode?: string }) {
  const lastName = useGame((s) => s.lastName)
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState(lastName)
  const { busy, error, join } = useJoin()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void join(code.trim(), name.trim())
  }
  return (
    <form onSubmit={submit} className="chalk-rule space-y-3 pt-5" aria-labelledby="join-title">
      <h3 id="join-title" className="font-display text-2xl text-chalk">
        Join a class match
      </h3>
      <p className="text-chalk-dim">Your organizer gives you a match code.</p>
      <Field label="Match code">
        <input className={field} value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" spellCheck={false} maxLength={32} placeholder="e.g. ops101" />
      </Field>
      <Field label="Display name" hint="shown on the leaderboard">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={24} autoComplete="nickname" />
      </Field>
      <ErrorLine message={error} />
      <button type="submit" disabled={busy} className="btn btn-cherry w-full py-3 text-xl">
        {busy ? 'Joining…' : 'Join match'}
      </button>
    </form>
  )
}

function JoinWeekly() {
  const lastName = useGame((s) => s.lastName)
  const openLeaderboard = useGame((s) => s.openLeaderboard)
  const [name, setName] = useState(lastName)
  const { busy, error, join } = useJoin()
  const weekId = isoWeekId()
  const code = weeklyCode(weekId)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void join(code, name.trim())
  }
  return (
    <form onSubmit={submit} className="chalk-rule space-y-3 pt-5" aria-labelledby="weekly-title">
      <h3 id="weekly-title" className="font-display text-2xl text-chalk">
        This week’s global match
      </h3>
      <p className="text-chalk-dim">
        No code needed. Each week brings a new version of the eight rounds. This one ends in {fmtUntil(weekBounds(weekId).end.toISOString())} (Monday 00:00 UTC).
      </p>
      <Field label="Display name" hint="shown on the leaderboard">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={24} autoComplete="nickname" />
      </Field>
      <ErrorLine message={error} />
      <button type="submit" disabled={busy} className="btn btn-cherry w-full py-3 text-xl">
        {busy ? 'Entering…' : 'Enter weekly match'}
      </button>
      <button type="button" onClick={() => openLeaderboard(code)} className="w-full text-center text-chalk underline decoration-dotted underline-offset-4 hover:text-marigold">
        See this week’s leaderboard
      </button>
    </form>
  )
}

function CreateMatch() {
  const rememberOrganizer = useGame((s) => s.rememberOrganizer)
  const openLeaderboard = useGame((s) => s.openLeaderboard)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [days, setDays] = useState(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ code: string; name: string; organizerKey: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await championshipApi.create(name.trim(), code.trim().toLowerCase(), days)
      rememberOrganizer(res.code, res.organizerKey)
      setCreated(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the match')
    }
    setBusy(false)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  if (created) {
    return (
      <div className="chalk-rule space-y-3 pt-5" aria-live="polite">
        <h3 className="font-display text-2xl text-chalk">{created.name} is ready</h3>
        <p className="text-chalk-dim">Share this code with your players. They join from this page.</p>
        <div className="till flex items-center justify-between gap-3 px-4 py-3">
          <span className="till-digits text-3xl tracking-wider">{created.code}</span>
          <button onClick={() => void copy(created.code)} className="btn btn-chalk px-3 py-1.5 text-base">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-sm text-chalk-dim">
          This device remembers that you organize the match, so you can delete it from its leaderboard. Your organizer key, in case you switch devices:{' '}
          <code className="break-all rounded bg-board-raised px-1.5 py-0.5 text-chalk">{created.organizerKey}</code>
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => openLeaderboard(created.code)} className="btn btn-marigold px-4 py-2 text-base">
            Open the leaderboard
          </button>
          <button onClick={() => setCreated(null)} className="btn btn-chalk px-4 py-2 text-base">
            Create another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="chalk-rule space-y-3 pt-5" aria-labelledby="create-title">
      <h3 id="create-title" className="font-display text-2xl text-chalk">
        Run a class match
      </h3>
      <p className="text-chalk-dim">For instructors and event hosts. Players need no account, just the code.</p>
      <Field label="Match name">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="e.g. Operations 101, Tuesday" />
      </Field>
      <Field label="Match code" hint="optional; we’ll make one">
        <input
          className={field}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={32}
          pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,31}"
          title="3 to 32 letters, digits or hyphens"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. ops101"
        />
      </Field>
      <Field label="Open for">
        <select className={field} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </Field>
      <ErrorLine message={error} />
      <button type="submit" disabled={busy} className="btn btn-marigold w-full py-3 text-xl">
        {busy ? 'Creating…' : 'Create match'}
      </button>
    </form>
  )
}
