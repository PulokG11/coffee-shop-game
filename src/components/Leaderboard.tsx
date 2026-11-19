import { useEffect, useState } from 'react'
import { SCENARIO } from '../engine/scenario'
import { championshipApi, type LeaderboardEntry, type MatchInfo } from '../lib/api/championship'
import { fmtMoney, fmtUntil, ordinal } from '../lib/format'
import { useGame } from '../store/game'
import { Logo, Trophy } from './TopBar'

const REFRESH_MS = 5000

export function Leaderboard() {
  const code = useGame((s) => s.leaderboardCode) ?? ''
  const close = useGame((s) => s.closeLeaderboard)
  const goHome = useGame((s) => s.goHome)
  const forgetMatch = useGame((s) => s.forgetMatch)
  const organizerKey = useGame((s) => s.organizerKeys[code])
  const myId = useGame((s) => {
    const m = s.mode.kind === 'championship' ? s.mode : s.champStash?.mode.kind === 'championship' ? s.champStash.mode : null
    return m && m.code === code ? m.playerId : null
  })
  const [data, setData] = useState<{ match: MatchInfo; entries: LeaderboardEntry[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let stop = false
    let timer = 0
    const load = async () => {
      try {
        if (code.startsWith('weekly-')) await championshipApi.weekly()
        const res = await championshipApi.leaderboard(code)
        if (stop) return
        setData(res)
        setError(null)
        setUpdated(new Date())
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : 'Could not load the leaderboard')
      }
      if (!stop) timer = window.setTimeout(load, document.hidden ? REFRESH_MS * 4 : REFRESH_MS)
    }
    void load()
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    return () => {
      stop = true
      clearTimeout(timer)
      clearInterval(tick)
    }
  }, [code])

  const match = data?.match
  const rounds = SCENARIO.rounds.length

  return (
    <>
      <header className="sticky top-0 z-20 border-b-2 border-board-line bg-board/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-2">
          <button onClick={goHome} className="flex items-center gap-2 font-display text-2xl text-chalk" aria-label="Back to the home screen">
            <Logo />
            <span className="hidden sm:inline">Coffee Shop Game</span>
          </button>
          <button onClick={close} className="btn btn-chalk px-4 py-2 text-base">
            Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-6">
        <p className="flex items-center gap-2 font-display text-xl text-marigold">
          <Trophy size={22} />
          {match?.kind === 'weekly' ? 'Global weekly match' : 'Class match'}
        </p>
        <h1 className="font-display text-4xl leading-tight text-chalk sm:text-5xl">{match?.name ?? 'Leaderboard'}</h1>

        {match && (
          <div className="mt-4 flex flex-wrap gap-4">
            {match.kind === 'class' ? (
              <div className="till px-5 py-3">
                <div className="text-sm text-chalk-dim">Players join with the code</div>
                <div className="till-digits text-3xl tracking-wider">{match.code}</div>
              </div>
            ) : (
              <div className="till px-5 py-3">
                <div className="text-sm text-chalk-dim">{match.expired ? 'This week’s match has ended' : 'A new match starts in'}</div>
                <div className="till-digits text-2xl">{match.expired ? 'Ended' : fmtUntil(match.expiresAt, now)}</div>
              </div>
            )}
            <div className="till px-5 py-3">
              <div className="text-sm text-chalk-dim">Players</div>
              <div className="till-digits text-3xl">{match.players}</div>
            </div>
            <div className="till px-5 py-3">
              <div className="text-sm text-chalk-dim">Finished all {rounds} rounds</div>
              <div className="till-digits text-3xl">{match.finished}</div>
            </div>
          </div>
        )}
        {match?.expired && match.kind === 'class' && <p className="mt-4 font-display text-xl text-marigold">This match has ended. The standings below are final.</p>}

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-bad-tint px-4 py-3 font-bold text-bad-ink">
            {error}
          </p>
        )}

        <section aria-labelledby="standings" className="ticket-hang mt-8">
          <div className="ticket">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="standings" className="ticket-title">
                Standings
              </h2>
              <span className="text-sm text-ink-soft" aria-live="polite">
                {updated ? `Updated ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}, refreshes every 5 seconds` : 'Loading…'}
              </span>
            </div>
            {data && data.entries.length === 0 ? (
              <p className="mt-3 text-ink-soft">
                Nobody has joined yet.{match?.kind === 'class' && <> Share the code <b className="text-ink">{match.code}</b> with your players.</>}
              </p>
            ) : (
              <table className="mt-2 w-full text-[15px]">
                <thead>
                  <tr className="text-left text-sm text-ink-soft">
                    <th className="w-14 py-1 font-normal">Rank</th>
                    <th className="py-1 font-normal">Player</th>
                    <th className="py-1 text-right font-normal">Rounds</th>
                    <th className="py-1 text-right font-bold">Total profit</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data?.entries.map((e, i) => {
                    const rank = i > 0 && data.entries[i - 1].total === e.total ? null : i + 1
                    const me = e.playerId === myId
                    return (
                      <tr key={e.playerId} className={`border-t border-dashed border-paper-edge ${me ? 'bg-marigold-tint font-bold' : ''}`}>
                        <td className="py-1.5 pl-1">{rank ? ordinal(rank) : '='}</td>
                        <td className="py-1.5">
                          {e.name}
                          {me && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">you</span>}
                        </td>
                        <td className="py-1.5 text-right">
                          {e.rounds}/{rounds}
                        </td>
                        <td className="py-1.5 text-right">{fmtMoney(e.total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-sm text-ink-soft">
              Everyone in the match is scored on the same customers, so a higher total means better plans, not better luck. Ties share a rank.
            </p>
          </div>
        </section>

        {organizerKey && match && <OrganizerTools code={code} organizerKey={organizerKey} onDeleted={() => forgetMatch(code)} />}
        {!organizerKey && match?.kind === 'class' && <OrganizerKeyEntry code={code} />}
      </main>
    </>
  )
}

function OrganizerKeyEntry({ code }: { code: string }) {
  const rememberOrganizer = useGame((s) => s.rememberOrganizer)
  const [key, setKey] = useState('')
  return (
    <details className="chalk-rule mt-10 pt-5 text-chalk-dim">
      <summary className="cursor-pointer font-display text-xl text-chalk">Organize this match from this device</summary>
      <form
        className="mt-3 flex max-w-xl flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (key.trim()) rememberOrganizer(code, key.trim())
        }}
      >
        <label className="min-w-[16rem] flex-1">
          <span className="text-[15px] font-bold text-chalk">Organizer key</span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-lg border-2 border-paper-edge bg-paper px-3 py-2 text-ink"
          />
        </label>
        <button type="submit" className="btn btn-chalk px-4 py-2 text-base">
          Use this key
        </button>
      </form>
      <p className="mt-2 text-sm">The key was shown when the match was created. The server checks it before deleting anything.</p>
    </details>
  )
}

function OrganizerTools({ code, organizerKey, onDeleted }: { code: string; organizerKey: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    try {
      await championshipApi.remove(code, organizerKey)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the match')
      setBusy(false)
    }
  }

  return (
    <section className="chalk-rule mt-10 pt-5">
      <h2 className="font-display text-2xl text-chalk">You organize this match</h2>
      <p className="mt-1 text-chalk-dim">Deleting the match removes every player and score. It cannot be undone.</p>
      {error && <p className="mt-2 font-bold text-[#ffb4b4]">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        {confirming ? (
          <>
            <button onClick={() => setConfirming(false)} disabled={busy} className="btn btn-chalk px-4 py-2 text-base">
              Keep the match
            </button>
            <button onClick={() => void remove()} disabled={busy} className="btn btn-cherry px-4 py-2 text-base">
              {busy ? 'Deleting…' : 'Yes, delete it and all scores'}
            </button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} className="btn btn-chalk px-4 py-2 text-base">
            Delete this match
          </button>
        )}
      </div>
    </section>
  )
}
