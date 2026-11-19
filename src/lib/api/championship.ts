import type { SimMetrics } from '../../engine/sim'
import type { Decision } from '../../engine/types'

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the championship server. Check your connection and try again.')
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(res.status, data.error ?? `The championship server answered ${res.status}`)
  return data as T
}

export interface MatchInfo {
  code: string
  kind: 'class' | 'weekly'
  name: string
  scenarioId: string
  expiresAt: string
  expired: boolean
  players: number
  finished: number
}

export interface Joined {
  playerId: string
  token: string
  displayName: string
  match: MatchInfo
}

export interface Standing {
  total: number
  rank: number
  players: number
}

export interface Scored {
  round: number
  decision: Decision
  replayed: boolean
  playerRun: SimMetrics
  optimalRun: SimMetrics
  playerExpected: number
  optimalExpected: number
  solveMs: number
  candidates: number
  standing: Standing
}

export interface LeaderboardEntry {
  playerId: string
  name: string
  total: number
  rounds: number
  last: string | null
}

const enc = encodeURIComponent

export const championshipApi = {
  weekly: () => call<MatchInfo>('GET', '/v1/weekly'),
  match: (code: string) => call<MatchInfo>('GET', `/v1/matches/${enc(code)}`),
  create: (name: string, code: string, days: number) =>
    call<{ code: string; name: string; expiresAt: string; organizerKey: string }>('POST', '/v1/matches', { name, code: code || undefined, days }),
  join: (code: string, displayName: string) => call<Joined>('POST', `/v1/matches/${enc(code)}/players`, { displayName }),
  submit: (playerId: string, token: string, round: number, decision: Decision) =>
    call<Scored>('POST', `/v1/players/${enc(playerId)}/rounds/${round}`, { decision }, { Authorization: `Bearer ${token}` }),
  leaderboard: (code: string) => call<{ match: MatchInfo; entries: LeaderboardEntry[] }>('GET', `/v1/matches/${enc(code)}/leaderboard`),
  remove: (code: string, organizerKey: string) => call<{ deleted: true }>('DELETE', `/v1/matches/${enc(code)}`, undefined, { 'X-Organizer-Key': organizerKey }),
}
