// Neon Function "api": Championship matches, server-scored rounds and leaderboards.
// Uses Neon's HTTP SQL endpoint so the bundle has no npm dependencies.
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { expectedPerHour, isFeasible } from '../src/engine/model.ts'
import { solveRound, type Optimum } from '../src/engine/optimizer.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { SCENARIO, getRound, normalize, sliderValues } from '../src/engine/scenario.ts'
import { runScored } from '../src/engine/sim.ts'
import { DECISION_KEYS, type Decision } from '../src/engine/types.ts'
import { isoWeekId, scenarioById, weekBounds, weeklyCode, weeklyScenarioId } from '../src/engine/weekly.ts'

const BUILD = process.env.BUILD_SHA ?? 'dev'
const ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'https://pulokg11.github.io,http://localhost:5174,http://127.0.0.1:5174').split(','),
)

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function sql<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const res = await fetch(`https://${new URL(url).hostname}/sql`, {
    method: 'POST',
    headers: { 'Neon-Connection-String': url, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, params }),
  })
  if (!res.ok) throw new Error(`sql ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = (await res.json()) as { rows: { j: T | string }[] }
  return body.rows.map((r) => (typeof r.j === 'string' ? JSON.parse(r.j) : r.j))
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const sameHash = (token: string, hash: string) => {
  const a = Buffer.from(sha256(token))
  const b = Buffer.from(hash)
  return a.length === b.length && timingSafeEqual(a, b)
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CODE = /^[a-z0-9][a-z0-9-]{2,31}$/
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'bitch', 'whore', 'rape', 'nazi', 'hitler', 'slut', 'retard']
const cents = (v: number) => Math.round(v * 100) / 100

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text()
  if (text.length > 4096) throw new HttpError(413, 'Request body is too large')
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON')
  }
}

function cleanText(raw: unknown, max: number): string {
  return (typeof raw === 'string' ? raw : '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function displayName(raw: unknown): string {
  const name = cleanText(raw, 24)
  if (!name) throw new HttpError(422, 'Choose a display name')
  const LOOKALIKE: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', $: 's', '7': 't', '8': 'b' }
  const flat = name
    .toLowerCase()
    .replace(/[0-9!@$]/g, (c) => LOOKALIKE[c] ?? c)
    .replace(/[^a-z]/g, '')
  if (BLOCKED.some((w) => flat.includes(w))) throw new HttpError(422, 'Choose a different display name')
  return name
}

function normalizeCode(raw: unknown): string {
  return (typeof raw === 'string' ? raw : '').trim().toLowerCase()
}

// ── Matches ───────────────────────────────────────────────────────────────────

const MATCH_FIELDS = `'code', m.code, 'kind', m.kind, 'name', m.name, 'scenarioId', m.scenario_id,
  'expiresAt', m.expires_at, 'expired', m.expires_at < now(),
  'players', (SELECT count(*) FROM championship_player p WHERE p.match_id = m.match_id),
  'finished', (SELECT count(*) FROM (SELECT 1 FROM championship_player p JOIN championship_round r USING (player_id)
                WHERE p.match_id = m.match_id GROUP BY p.player_id HAVING count(*) >= ${SCENARIO.rounds.length}) f)`

async function matchInfo(code: string) {
  const [row] = await sql(`SELECT json_build_object(${MATCH_FIELDS}) AS j FROM championship m WHERE m.code = $1`, [code])
  return row ?? null
}

/** The current week's global match exists as soon as someone asks for it. */
async function ensureWeekly() {
  const weekId = isoWeekId()
  const code = weeklyCode(weekId)
  await sql(
    `INSERT INTO championship (code, kind, name, scenario_id, secret, expires_at)
     VALUES ($1, 'weekly', $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING RETURNING json_build_object('code', code) AS j`,
    [code, `Global match, week ${weekId.slice(6)} of ${weekId.slice(0, 4)}`, weeklyScenarioId(weekId), randomBytes(16).toString('hex'), weekBounds(weekId).end.toISOString()],
  )
  return matchInfo(code)
}

async function createMatch(req: Request) {
  const body = await readJson(req)
  const name = cleanText(body.name, 60)
  if (!name) throw new HttpError(422, 'Give the match a name')
  const days = Math.min(90, Math.max(1, Math.round(Number(body.days) || 30)))
  const wanted = normalizeCode(body.code)
  if (wanted && (!CODE.test(wanted) || wanted.startsWith('weekly-'))) {
    throw new HttpError(422, 'Codes are 3 to 32 letters, digits or hyphens, and cannot start with "weekly-"')
  }
  const organizerKey = randomBytes(18).toString('base64url')
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = wanted || Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
    const [row] = await sql<{ code: string; expiresAt: string }>(
      `INSERT INTO championship (code, kind, name, scenario_id, secret, organizer_key_hash, expires_at)
       VALUES ($1, 'class', $2, $3, $4, $5, now() + make_interval(days => $6::int))
       ON CONFLICT (code) DO NOTHING
       RETURNING json_build_object('code', code, 'name', name, 'expiresAt', expires_at) AS j`,
      [code, name, SCENARIO.id, randomBytes(16).toString('hex'), sha256(organizerKey), days],
    )
    if (row) return { ...row, organizerKey }
    if (wanted) throw new HttpError(409, `The code "${wanted}" is already in use. Pick another.`)
  }
  throw new HttpError(503, 'Could not find a free code. Try again.')
}

async function deleteMatch(req: Request, code: string) {
  const key = req.headers.get('x-organizer-key') ?? ''
  const [m] = await sql<{ hash: string | null }>(`SELECT json_build_object('hash', organizer_key_hash) AS j FROM championship WHERE code = $1`, [code])
  if (!m) throw new HttpError(404, 'No match uses that code')
  if (!m.hash || !key || !sameHash(key, m.hash)) throw new HttpError(403, 'Only the organizer can delete this match')
  await sql(`DELETE FROM championship WHERE code = $1 RETURNING json_build_object('code', code) AS j`, [code])
  return { deleted: true }
}

async function joinMatch(req: Request, code: string) {
  const body = await readJson(req)
  const name = displayName(body.displayName)
  const info = (code.startsWith('weekly-') ? (code === weeklyCode(isoWeekId()) ? await ensureWeekly() : await matchInfo(code)) : await matchInfo(code)) as
    | { expired: boolean }
    | null
  if (!info) throw new HttpError(404, 'No match uses that code. Check it with your organizer.')
  if (info.expired) throw new HttpError(410, 'That match has ended')
  const token = randomBytes(24).toString('base64url')
  const [row] = await sql<{ playerId: string }>(
    `INSERT INTO championship_player (match_id, display_name, token_hash)
     SELECT match_id, $2, $3 FROM championship WHERE code = $1
     ON CONFLICT DO NOTHING
     RETURNING json_build_object('playerId', player_id) AS j`,
    [code, name, sha256(token)],
  )
  if (!row) throw new HttpError(409, `Someone in this match is already called "${name}". Pick another name.`)
  return { playerId: row.playerId, token, displayName: name, match: info }
}

async function leaderboard(code: string, url: URL) {
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100))
  const info = await matchInfo(code)
  if (!info) throw new HttpError(404, 'No match uses that code')
  const entries = await sql(
    `SELECT json_build_object('playerId', p.player_id, 'name', p.display_name, 'total', COALESCE(sum(r.profit), 0),
              'rounds', count(r.round), 'last', max(r.submitted_at)) AS j
     FROM championship_player p JOIN championship m USING (match_id)
     LEFT JOIN championship_round r USING (player_id)
     WHERE m.code = $1
     GROUP BY p.player_id, p.display_name
     ORDER BY COALESCE(sum(r.profit), 0) DESC, count(r.round) DESC, max(r.submitted_at) ASC NULLS LAST
     LIMIT $2`,
    [code, limit],
  )
  return { match: info, entries }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

const optima = new Map<string, Optimum>()
function optimumFor(scenarioId: string, round: number): Optimum {
  const key = `${scenarioId}:${round}`
  let opt = optima.get(key)
  if (!opt) {
    const scn = scenarioById(scenarioId)
    opt = solveRound(scn, getRound(scn, round))
    optima.set(key, opt)
  }
  return opt
}

function parseDecision(raw: unknown, scenarioId: string, round: number): Decision {
  const scn = scenarioById(scenarioId)
  const r = getRound(scn, round)
  const src = (raw ?? {}) as Record<string, unknown>
  const x = { ...r.defaults }
  for (const key of r.decisions) {
    const v = Number(src[key])
    if (!Number.isFinite(v) || !sliderValues(scn.sliders[key]).some((s) => Math.abs(s - v) < 1e-6)) {
      throw new HttpError(422, `${key} must be one of the slider's values`)
    }
    x[key] = v
  }
  const plan = normalize(r, x)
  if (!isFeasible(r, plan)) throw new HttpError(422, 'That plan needs more beans or water than the shop has')
  return plan
}

interface Stored {
  round: number
  decision: Decision
  detail: Record<string, unknown>
}

async function submitRound(req: Request, playerId: string, round: number) {
  if (!UUID.test(playerId) || !Number.isInteger(round) || round < 1 || round > SCENARIO.rounds.length) throw new HttpError(404, 'not found')
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const [p] = await sql<{ tokenHash: string; secret: string; scenarioId: string; expired: boolean; played: number }>(
    `SELECT json_build_object('tokenHash', p.token_hash, 'secret', m.secret, 'scenarioId', m.scenario_id,
       'expired', m.expires_at < now(), 'played', (SELECT count(*) FROM championship_round r WHERE r.player_id = p.player_id)) AS j
     FROM championship_player p JOIN championship m USING (match_id) WHERE p.player_id = $1`,
    [playerId],
  )
  if (!p || !token || !sameHash(token, p.tokenHash)) throw new HttpError(401, 'Your championship session is not valid. Join the match again.')

  if (round <= p.played) {
    const [prev] = await sql<Stored>(
      `SELECT json_build_object('round', round, 'decision', decision, 'detail', detail) AS j FROM championship_round WHERE player_id = $1 AND round = $2`,
      [playerId, round],
    )
    return { ...prev.detail, decision: prev.decision, round, replayed: true, ...(await standing(playerId)) }
  }
  if (p.expired) throw new HttpError(410, 'That match has ended')
  if (round !== p.played + 1) throw new HttpError(409, `Submit round ${p.played + 1} first`)

  const body = await readJson(req)
  const decision = parseDecision(body.decision, p.scenarioId, round)
  const scn = scenarioById(p.scenarioId)
  const r = getRound(scn, round)
  // Every player in the match gets the same customers in this round.
  const seed = hashSeed(p.secret, 'round', round)
  const opt = optimumFor(p.scenarioId, round)
  const playerRun = runScored(r, decision, seed, scn.hours)
  const optimalRun = runScored(r, opt.decision, seed, scn.hours)
  const detail = {
    playerRun,
    optimalRun,
    playerExpected: cents(expectedPerHour(r, decision).profit * scn.hours),
    optimalExpected: cents(opt.expected.profit * scn.hours),
    solveMs: opt.solveMs,
    candidates: opt.candidates,
  }
  await sql(
    `INSERT INTO championship_round (player_id, round, decision, profit, expected, optimal_profit, optimal_expected, detail)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (player_id, round) DO NOTHING
     RETURNING json_build_object('round', round) AS j`,
    [playerId, round, JSON.stringify(decision), cents(playerRun.profit), detail.playerExpected, cents(optimalRun.profit), detail.optimalExpected, JSON.stringify(detail)],
  )
  return { ...detail, decision, round, replayed: false, ...(await standing(playerId)) }
}

async function standing(playerId: string) {
  const [s] = await sql<{ total: number; rank: number; players: number }>(
    `WITH totals AS (
       SELECT p.player_id, COALESCE(sum(r.profit), 0) AS total
       FROM championship_player p LEFT JOIN championship_round r USING (player_id)
       WHERE p.match_id = (SELECT match_id FROM championship_player WHERE player_id = $1)
       GROUP BY p.player_id)
     SELECT json_build_object('total', t.total, 'rank', (SELECT count(*) + 1 FROM totals o WHERE o.total > t.total),
       'players', (SELECT count(*) FROM totals)) AS j
     FROM totals t WHERE t.player_id = $1`,
    [playerId],
  )
  return { standing: s }
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    ...(ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Organizer-Key',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const cors = corsHeaders(req)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

    const url = new URL(req.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    try {
      if (req.method === 'GET' && (path === '/' || path === '/health')) return json({ ok: true, build: BUILD })
      if (req.method === 'GET' && path === '/v1/weekly') return json(await ensureWeekly())
      if (req.method === 'POST' && path === '/v1/matches') return json(await createMatch(req), 201)

      const m = path.match(/^\/v1\/matches\/([^/]+)(\/players|\/leaderboard)?$/)
      if (m) {
        const code = normalizeCode(decodeURIComponent(m[1]))
        if (!CODE.test(code)) throw new HttpError(404, 'No match uses that code')
        if (req.method === 'GET' && !m[2]) {
          const info = await matchInfo(code)
          if (!info) throw new HttpError(404, 'No match uses that code')
          return json(info)
        }
        if (req.method === 'DELETE' && !m[2]) return json(await deleteMatch(req, code))
        if (req.method === 'POST' && m[2] === '/players') return json(await joinMatch(req, code), 201)
        if (req.method === 'GET' && m[2] === '/leaderboard') return json(await leaderboard(code, url))
      }

      const s = path.match(/^\/v1\/players\/([^/]+)\/rounds\/(\d+)$/)
      if (req.method === 'POST' && s) return json(await submitRound(req, s[1], Number(s[2])))
      return json({ error: 'not found' }, 404)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      console.error(err)
      return json({ error: 'internal error' }, 500)
    }
  },
}
