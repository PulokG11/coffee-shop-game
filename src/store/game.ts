import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { expectedPerHour, isFeasible } from '../engine/model'
import { solveRound } from '../engine/optimizer'
import { hashSeed, randomSeed } from '../engine/rng'
import { SCENARIO, clampToSlider, getRound, normalize } from '../engine/scenario'
import { runScored, type SimMetrics } from '../engine/sim'
import type { Decision, DecisionKey } from '../engine/types'

export type Screen = 'home' | 'play' | 'compare' | 'summary'

export interface RoundResult {
  round: number
  seed: number
  player: Decision
  optimal: Decision
  playerRun: SimMetrics
  optimalRun: SimMetrics
  /** Expected profit over the full run (analytic model). */
  playerExpected: number
  optimalExpected: number
  solveMs: number
  candidates: number
}

interface GameState {
  screen: Screen
  round: number
  sessionSeed: number
  draft: Decision
  tried: Decision
  liveSeed: number
  tries: number
  results: RoundResult[]
  introOpen: boolean

  newGame: () => void
  resume: () => void
  goHome: () => void
  setDraft: (key: DecisionKey, value: number) => void
  resetDraft: () => void
  trySolution: () => void
  submit: () => void
  nextRound: () => void
  setIntroOpen: (open: boolean) => void
}

const startOf = (round: number) => normalize(getRound(SCENARIO, round), getRound(SCENARIO, round).defaults)

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'home',
      round: 1,
      sessionSeed: 0,
      draft: startOf(1),
      tried: startOf(1),
      liveSeed: 1,
      tries: 0,
      results: [],
      introOpen: true,

      newGame: () =>
        set({
          screen: 'play',
          round: 1,
          sessionSeed: randomSeed(),
          draft: startOf(1),
          tried: startOf(1),
          liveSeed: randomSeed(),
          tries: 0,
          results: [],
          introOpen: true,
        }),

      resume: () => {
        const s = get()
        set({ screen: s.results.some((r) => r.round === s.round) ? 'compare' : 'play' })
      },

      goHome: () => set({ screen: 'home' }),

      setDraft: (key, value) => {
        const { round, draft } = get()
        const r = getRound(SCENARIO, round)
        if (!r.decisions.includes(key)) return
        set({ draft: { ...draft, [key]: clampToSlider(SCENARIO.sliders[key], value) } })
      },

      resetDraft: () => set({ draft: { ...get().tried } }),

      trySolution: () => {
        const { round, draft, tries } = get()
        if (!isFeasible(getRound(SCENARIO, round), draft)) return
        set({ tried: { ...draft }, liveSeed: randomSeed(), tries: tries + 1 })
      },

      submit: () => {
        const { round, draft, sessionSeed, results } = get()
        const r = getRound(SCENARIO, round)
        const player = normalize(r, draft)
        if (!isFeasible(r, player) || results.some((x) => x.round === round)) return
        const seed = hashSeed(sessionSeed, SCENARIO.id, SCENARIO.version, round)
        const opt = solveRound(SCENARIO, r)
        const H = SCENARIO.hours
        const result: RoundResult = {
          round,
          seed,
          player,
          optimal: opt.decision,
          playerRun: runScored(r, player, seed, H),
          optimalRun: runScored(r, opt.decision, seed, H),
          playerExpected: expectedPerHour(r, player).profit * H,
          optimalExpected: opt.expected.profit * H,
          solveMs: opt.solveMs,
          candidates: opt.candidates,
        }
        set({ results: [...results, result], tried: player, screen: 'compare' })
      },

      nextRound: () => {
        const { round } = get()
        if (round >= SCENARIO.rounds.length) {
          set({ screen: 'summary' })
          return
        }
        const next = round + 1
        set({
          round: next,
          draft: startOf(next),
          tried: startOf(next),
          liveSeed: randomSeed(),
          tries: 0,
          screen: 'play',
          introOpen: true,
        })
      },

      setIntroOpen: (open) => set({ introOpen: open }),
    }),
    {
      name: `coffee-shop-game:${SCENARIO.id}@${SCENARIO.version}`,
      version: 1,
      partialize: (s) => ({
        screen: s.screen,
        round: s.round,
        sessionSeed: s.sessionSeed,
        draft: s.draft,
        tried: s.tried,
        results: s.results,
        tries: s.tries,
      }),
      merge: (persisted, current) => ({ ...current, ...(persisted as object), screen: 'home', introOpen: false }),
    },
  ),
)

export const hasSavedGame = (s: Pick<GameState, 'sessionSeed' | 'results' | 'round'>) =>
  s.sessionSeed !== 0 && !(s.round === SCENARIO.rounds.length && s.results.length === SCENARIO.rounds.length)
