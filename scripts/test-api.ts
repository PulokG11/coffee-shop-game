// End-to-end check of the Championship API. Creates a throwaway class match and deletes it at the end.
// Run: API_URL=http://localhost:8787 npm run test:api   (or the deployed function's URL)
import { readFileSync } from 'node:fs'

const SCENARIO = JSON.parse(readFileSync('scenarios/default_v2.json', 'utf8')) as { rounds: { round: number; defaults: Record<string, number> }[] }
const getRound = (_: unknown, n: number) => SCENARIO.rounds.find((r) => r.round === n)!

const API = (process.env.API_URL ?? 'http://localhost:8787').replace(/\/+$/, '')
let failures = 0

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` ${JSON.stringify(detail)}`}`)
  if (!ok) failures++
}

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5174', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any, cors: res.headers.get('access-control-allow-origin') }
}

const health = await call('GET', '/health')
check('health', health.status === 200 && health.body.ok === true, health)
check('CORS allows the dev origin', health.cors === 'http://localhost:5174', health.cors)

const code = `test-${Date.now().toString(36)}`
const created = await call('POST', '/v1/matches', { name: 'API test match', code, days: 1 })
check('create a class match with a custom code', created.status === 201 && created.body.code === code && !!created.body.organizerKey, created)
const key = created.body.organizerKey as string

try {
  const dup = await call('POST', '/v1/matches', { name: 'Again', code })
  check('a taken code is reported', dup.status === 409, dup)
  const bad = await call('POST', '/v1/matches', { name: 'x', code: 'weekly-nope' })
  check('weekly- codes are reserved', bad.status === 422, bad)

  const a = await call('POST', `/v1/matches/${code.toUpperCase()}/players`, { displayName: 'Ada' })
  check('join (codes are case-insensitive)', a.status === 201 && !!a.body.token, a)
  const clash = await call('POST', `/v1/matches/${code}/players`, { displayName: 'ada' })
  check('display names are unique per match', clash.status === 409, clash)
  const rude = await call('POST', `/v1/matches/${code}/players`, { displayName: 'sh1t' })
  const rude2 = await call('POST', `/v1/matches/${code}/players`, { displayName: 'Shit Brew' })
  check('offensive names are refused, including look-alike spellings', rude.status === 422 && rude2.status === 422, { rude, rude2 })
  const b = await call('POST', `/v1/matches/${code}/players`, { displayName: 'Grace' })
  check('second player joins', b.status === 201, b)
  const missing = await call('POST', '/v1/matches/no-such-match/players', { displayName: 'Zed' })
  check('unknown code is a 404', missing.status === 404, missing)

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` })
  const r1 = getRound(SCENARIO, 1)
  const sub = (p: any, round: number, decision: unknown) => call('POST', `/v1/players/${p.body.playerId}/rounds/${round}`, { decision }, auth(p.body.token))

  const noAuth = await call('POST', `/v1/players/${a.body.playerId}/rounds/1`, { decision: r1.defaults })
  check('scoring needs the player token', noAuth.status === 401, noAuth)
  const skip = await sub(a, 2, getRound(SCENARIO, 2).defaults)
  check('rounds must be played in order', skip.status === 409, skip)
  const infeasible = await sub(a, 1, { hot: 90 })
  check('infeasible plans are refused', infeasible.status === 422, infeasible)
  const offGrid = await sub(a, 1, { hot: 30.5 })
  check('values must be slider values', offGrid.status === 422, offGrid)

  const s1 = await sub(a, 1, { hot: 44 })
  check('round 1 is scored on the server', s1.status === 200 && typeof s1.body.playerRun?.profit === 'number', s1)
  check('the optimal plan is never sent', !('optimal' in s1.body) && !JSON.stringify(s1.body).includes('"decision":{"hot":45'), s1.body)
  const again = await sub(a, 1, { hot: 10 })
  check('resubmitting returns the stored result', again.status === 200 && again.body.replayed === true && again.body.decision.hot === 44, again.body)
  const g1 = await sub(b, 1, { hot: 44 })
  check('same plan, same match: same customers and profit', g1.body.playerRun?.profit === s1.body.playerRun?.profit, [g1.body.playerRun?.profit, s1.body.playerRun?.profit])
  const g2 = await sub(b, 2, getRound(SCENARIO, 2).defaults)
  check('round 2 scores', g2.status === 200 && g2.body.standing.rank >= 1, g2.body.standing)

  const lb = await call('GET', `/v1/matches/${code}/leaderboard`)
  check('leaderboard lists both players, best first', lb.status === 200 && lb.body.entries.length === 2 && lb.body.entries[0].total >= lb.body.entries[1].total, lb.body)
  check('leaderboard does not leak secrets or tokens', !/secret|token/i.test(JSON.stringify(lb.body)), lb.body)

  const weekly = await call('GET', '/v1/weekly')
  check('weekly match exists for this week', weekly.status === 200 && /^weekly-\d{4}-w\d{2}$/.test(weekly.body.code), weekly.body)
} finally {
  const wrongKey = await call('DELETE', `/v1/matches/${code}`, undefined, { 'X-Organizer-Key': 'nope' })
  check('only the organizer can delete', wrongKey.status === 403, wrongKey)
  const del = await call('DELETE', `/v1/matches/${code}`, undefined, { 'X-Organizer-Key': key })
  check('organizer deletes the match (cleanup)', del.status === 200, del)
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
