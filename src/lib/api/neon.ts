/**
 * Thin wrappers around the game's FastAPI server.
 * The client never talks to Neon Postgres directly — all DB work goes through
 * the server so seeds, scoring, and optimizer logic stay server-authoritative.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('csg_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  access_token: string
  user_id: string
  display_name: string
}

export async function signUp(email: string, password: string, displayName: string) {
  return apiFetch<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  })
}

export async function signIn(email: string, password: string) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function signOut() {
  localStorage.removeItem('csg_token')
}

// ── Game ──────────────────────────────────────────────────────────────────────

export interface SimulateRequest {
  round_number: number
  scenario_id: string
  decision: {
    hot_qty: number
    cold_qty: number
    markup?: number
    service_rate?: number
  }
  seed: number
}

export async function simulateRound(req: SimulateRequest) {
  return apiFetch('/simulate', { method: 'POST', body: JSON.stringify(req) })
}

export async function getOptimalDecision(
  round_number: number,
  scenario_id: string,
  seed: number,
) {
  return apiFetch('/optimize', {
    method: 'POST',
    body: JSON.stringify({ round_number, scenario_id, seed }),
  })
}

export async function listScenarios(): Promise<string[]> {
  return apiFetch('/scenarios')
}

// ── Leaderboard (polling) ─────────────────────────────────────────────────────

export interface LeaderboardRow {
  display_name: string
  total_profit: number
  rounds_played: number
  snapshot_at: string
}

export async function fetchLeaderboard(
  classId: string,
  scenarioId: string,
): Promise<LeaderboardRow[]> {
  return apiFetch(`/leaderboard?class_id=${classId}&scenario_id=${scenarioId}`)
}

/**
 * Subscribe to leaderboard updates via SSE.
 * Falls back to polling every `pollMs` if SSE is unavailable.
 */
export function subscribeLeaderboard(
  classId: string,
  scenarioId: string,
  onUpdate: (rows: LeaderboardRow[]) => void,
  pollMs = 5000,
): () => void {
  const url = `${API_BASE}/leaderboard/stream?class_id=${classId}&scenario_id=${scenarioId}`

  try {
    const es = new EventSource(url)
    es.onmessage = (e) => {
      try { onUpdate(JSON.parse(e.data)) } catch { /* ignore parse errors */ }
    }
    es.onerror = () => {
      es.close()
      startPolling()
    }
    return () => es.close()
  } catch {
    return startPolling()
  }

  function startPolling() {
    const id = setInterval(async () => {
      try { onUpdate(await fetchLeaderboard(classId, scenarioId)) } catch { /* ignore */ }
    }, pollMs)
    return () => clearInterval(id)
  }
}
