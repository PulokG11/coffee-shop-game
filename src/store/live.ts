import { create } from 'zustand'
import type { SimMetrics } from '../engine/sim'

export const SPEEDS = [1, 5, 20, 100] as const
export type Speed = (typeof SPEEDS)[number]

/** Real seconds per simulated hour at 1× speed. */
export const SECONDS_PER_HOUR = 20

interface LiveState {
  metrics: SimMetrics | null
  stock: { hot: number; cold: number }
  inShop: number
  profitByHour: number[]
  speed: Speed
  paused: boolean
  setSpeed: (s: Speed) => void
  togglePause: () => void
  publish: (p: Pick<LiveState, 'metrics' | 'stock' | 'inShop' | 'profitByHour'>) => void
}

export const useLive = create<LiveState>()((set) => ({
  metrics: null,
  stock: { hot: 0, cold: 0 },
  inShop: 0,
  profitByHour: [],
  speed: 5,
  paused: false,
  setSpeed: (speed) => set({ speed, paused: false }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  publish: (p) => set(p),
}))
