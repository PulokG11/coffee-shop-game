import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { expectedPerHour, isFeasible } from '../engine/model'
import { solveRound } from '../engine/optimizer'
import { hashSeed, randomSeed } from '../engine/rng'
import { SCENARIO, clampToSlider, getRound, normalize } from '../engine/scenario'
import { runScored, type SimMetrics } from '../engine/sim'
import type { Decision, DecisionKey, Scenario } from '../engine/types'
import { scenarioById } from '../engine/weekly'
import { championshipApi, type Joined, type Standing } from '../lib/api/championship'

export type Screen = 'home' | 'play' | 'compare' | 'summary' | 'leaderboard'

export type Mode =
  | { kind: 'solo' }
  | {
      kind: 'championship'
      matchKind: 'class' | 'weekly'
      code: string
      matchName: string
      scenarioId: string
      expiresAt: string
      playerId: string
      token: string
      displayName: string
    }

export type ChampionshipMode = Extract<Mode, { kind: 'championship' }>

export interface RoundResult {
  round: number
  /** Seed for replaying extra weeks on this device; the scored week's seed stays on the server in championships. */
  seed: number
  player: Decision
  /** Null in championships: the optimizer's plan is never revealed. */
  optimal: Decision | null
  playerRun: SimMetrics
  optimalRun: SimMetrics
  /** Expected profit over the full run (analytic model). */
  playerExpected: number
  optimalExpected: number
  solveMs: number
  candidates: number
  standing?: Standing
}

interface Progress {
  mode: Mode
  round: number
  sessionSeed: number
  draft: Decision
  tried: Decision
  tries: number
  results: RoundResult[]
}

interface GameState extends Progress {
  screen: Screen
  liveSeed: number
  introOpen: boolean
  /** The other kind of game, kept while you play this one. */
  soloStash: Progress | null
  champStash: Progress | null
  submitting: boolean
  submitError: string | null
  leaderboardCode: string | null
  returnTo: Screen
  organizerKeys: Record<string, string>
  lastName: string

  newGame: () => void
  resume: () => void
  resumeSolo: () => void
  resumeChampionship: () => void
  startChampionship: (joined: Joined) => void
  goHome: () => void
  setDraft: (key: DecisionKey, value: number) => void
  resetDraft: () => void
  trySolution: () => void
  submit: () => Promise<boolean>
  clearSubmitError: () => void
  nextRound: () => void
  setIntroOpen: (open: boolean) => void
  openLeaderboard: (code: string) => void
  closeLeaderboard: () => void
  rememberOrganizer: (code: string, key: string) => void
  forgetMatch: (code: string) => void
  setLastName: (name: string) => void
}

const scenarioCache = new Map<string, Scenario>()
export function scenarioOf(mode: Mode): Scenario {
  if (mode.kind === 'solo') return SCENARIO
  let scn = scenarioCache.get(mode.scenarioId)
  if (!scn) {
    scn = scenarioById(mode.scenarioId)
    scenarioCache.set(mode.scenarioId, scn)
  }
  return scn
}

function fresh(mode: Mode): Progress {
  const r = getRound(scenarioOf(mode), 1)
  const start = normalize(r, r.defaults)
  return { mode, round: 1, sessionSeed: randomSeed(), draft: start, tried: start, tries: 0, results: [] }
}

const snapshot = (s: Progress): Progress => ({
  mode: s.mode,
  round: s.round,
  sessionSeed: s.sessionSeed,
  draft: s.draft,
  tried: s.tried,
  tries: s.tries,
  results: s.results,
})

export const isFinished = (p: Pick<Progress, 'results' | 'mode'>) => p.results.length >= scenarioOf(p.mode).rounds.length

function screenFor(p: Progress): Screen {
  if (isFinished(p)) return 'summary'
  return p.results.some((r) => r.round === p.round) ? 'compare' : 'play'
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** Make `target` the active game; the current one is kept in its stash. */
      const switchTo = (target: Progress, screen?: Screen) => {
        const s = get()
        const current = snapshot(s)
        const hasCurrent = s.sessionSeed !== 0
        set({
          ...target,
          soloStash: target.mode.kind === 'solo' ? null : hasCurrent && current.mode.kind === 'solo' ? current : s.soloStash,
          champStash: target.mode.kind === 'championship' ? null : hasCurrent && current.mode.kind === 'championship' ? current : s.champStash,
          screen: screen ?? screenFor(target),
          liveSeed: randomSeed(),
          introOpen: screenFor(target) === 'play',
          submitting: false,
          submitError: null,
        })
      }

      return {
        ...fresh({ kind: 'solo' }),
        sessionSeed: 0,
        screen: 'home',
        liveSeed: 1,
        introOpen: true,
        soloStash: null,
        champStash: null,
        submitting: false,
        submitError: null,
        leaderboardCode: null,
        returnTo: 'home',
        organizerKeys: {},
        lastName: '',

        newGame: () => switchTo(fresh({ kind: 'solo' }), 'play'),

        resume: () => {
          const s = get()
          set({ screen: screenFor(s), introOpen: screenFor(s) === 'play', liveSeed: randomSeed() })
        },

        resumeSolo: () => {
          const s = get()
          if (s.mode.kind === 'solo' && s.sessionSeed !== 0) s.resume()
          else if (s.soloStash) switchTo(s.soloStash)
        },

        resumeChampionship: () => {
          const s = get()
          if (s.mode.kind === 'championship') s.resume()
          else if (s.champStash) switchTo(s.champStash)
        },

        startChampionship: (j) => {
          const mode: ChampionshipMode = {
            kind: 'championship',
            matchKind: j.match.kind,
            code: j.match.code,
            matchName: j.match.name,
            scenarioId: j.match.scenarioId,
            expiresAt: j.match.expiresAt,
            playerId: j.playerId,
            token: j.token,
            displayName: j.displayName,
          }
          set({ lastName: j.displayName })
          switchTo(fresh(mode), 'play')
        },

        goHome: () => set({ screen: 'home' }),

        setDraft: (key, value) => {
          const { mode, round, draft } = get()
          const scn = scenarioOf(mode)
          if (!getRound(scn, round).decisions.includes(key)) return
          set({ draft: { ...draft, [key]: clampToSlider(scn.sliders[key], value) } })
        },

        resetDraft: () => set({ draft: { ...get().tried } }),

        trySolution: () => {
          const { mode, round, draft, tries } = get()
          if (!isFeasible(getRound(scenarioOf(mode), round), draft)) return
          set({ tried: { ...draft }, liveSeed: randomSeed(), tries: tries + 1 })
        },

        submit: async () => {
          const { mode, round, draft, sessionSeed, results, submitting } = get()
          const scn = scenarioOf(mode)
          const r = getRound(scn, round)
          const player = normalize(r, draft)
          if (submitting || !isFeasible(r, player) || results.some((x) => x.round === round)) return false

          if (mode.kind === 'solo') {
            const seed = hashSeed(sessionSeed, scn.id, scn.version, round)
            const opt = solveRound(scn, r)
            const result: RoundResult = {
              round,
              seed,
              player,
              optimal: opt.decision,
              playerRun: runScored(r, player, seed, scn.hours),
              optimalRun: runScored(r, opt.decision, seed, scn.hours),
              playerExpected: expectedPerHour(r, player).profit * scn.hours,
              optimalExpected: opt.expected.profit * scn.hours,
              solveMs: opt.solveMs,
              candidates: opt.candidates,
            }
            set({ results: [...results, result], tried: player, screen: 'compare' })
            return true
          }

          set({ submitting: true, submitError: null })
          try {
            const res = await championshipApi.submit(mode.playerId, mode.token, round, player)
            const result: RoundResult = {
              round,
              seed: hashSeed(mode.playerId, round),
              player: res.decision,
              optimal: null,
              playerRun: res.playerRun,
              optimalRun: res.optimalRun,
              playerExpected: res.playerExpected,
              optimalExpected: res.optimalExpected,
              solveMs: res.solveMs,
              candidates: res.candidates,
              standing: res.standing,
            }
            set((s) => ({ results: [...s.results, result], tried: res.decision, draft: res.decision, screen: 'compare', submitting: false }))
            return true
          } catch (err) {
            set({ submitting: false, submitError: err instanceof Error ? err.message : 'Submitting failed. Try again.' })
            return false
          }
        },

        clearSubmitError: () => set({ submitError: null }),

        nextRound: () => {
          const s = get()
          const scn = scenarioOf(s.mode)
          if (s.round >= scn.rounds.length) {
            set({ screen: 'summary' })
            return
          }
          const next = s.round + 1
          const r = getRound(scn, next)
          const start = normalize(r, r.defaults)
          set({ round: next, draft: start, tried: start, liveSeed: randomSeed(), tries: 0, screen: 'play', introOpen: true })
        },

        setIntroOpen: (open) => set({ introOpen: open }),

        openLeaderboard: (code) => set((s) => ({ leaderboardCode: code, returnTo: s.screen === 'leaderboard' ? s.returnTo : s.screen, screen: 'leaderboard' })),
        closeLeaderboard: () => set((s) => ({ screen: s.returnTo === 'leaderboard' ? 'home' : s.returnTo })),

        rememberOrganizer: (code, key) => set((s) => ({ organizerKeys: { ...s.organizerKeys, [code]: key } })),

        forgetMatch: (code) =>
          set((s) => {
            const organizerKeys = { ...s.organizerKeys }
            delete organizerKeys[code]
            const inMatch = (p: Progress | null) => p?.mode.kind === 'championship' && p.mode.code === code
            if (inMatch(s)) {
              // The deleted match was the active game: bring the solo game back if there is one.
              const solo = s.soloStash ?? { ...fresh({ kind: 'solo' }), sessionSeed: 0 }
              return { organizerKeys, ...solo, soloStash: null, champStash: null, screen: 'home' as Screen }
            }
            return { organizerKeys, champStash: inMatch(s.champStash) ? null : s.champStash }
          }),

        setLastName: (name) => set({ lastName: name }),
      }
    },
    {
      // Same key as v0.2/v0.3 so saved solo games carry over; version 1 saves had no mode.
      name: `coffee-shop-game:${SCENARIO.id}@${SCENARIO.version}`,
      version: 2,
      migrate: (persisted, version) =>
        (version < 2
          ? { ...(persisted as object), mode: { kind: 'solo' }, soloStash: null, champStash: null, organizerKeys: {}, lastName: '' }
          : persisted) as GameState,
      partialize: (s) => ({
        ...snapshot(s),
        soloStash: s.soloStash,
        champStash: s.champStash,
        organizerKeys: s.organizerKeys,
        lastName: s.lastName,
      }),
      merge: (persisted, current) => ({ ...current, ...(persisted as object), screen: 'home', introOpen: false }),
    },
  ),
)

export function useScenario(): Scenario {
  return useGame((s) => scenarioOf(s.mode))
}

/** Solo progress, whether it is the active game or waiting in its stash. */
export function soloProgress(s: Progress & Pick<GameState, 'soloStash'>): Progress | null {
  if (s.mode.kind === 'solo') return s.sessionSeed !== 0 ? s : null
  return s.soloStash
}

export function champProgress(s: Pick<GameState, 'mode' | 'champStash'> & Progress): Progress | null {
  return s.mode.kind === 'championship' ? s : s.champStash
}
