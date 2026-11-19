// Runs the Championship API locally on http://localhost:8787 against DATABASE_URL from .env.local.
// Run: npm run api:dev  (builds the bundle first)
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

// The bundle from `npm run api:build`: the exact code that is deployed
const { default: handler } = await import('../dist-api/index.mjs')
const port = Number(process.env.PORT ?? 8787)

createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === 'GET' || req.method === 'HEAD' || !chunks.length ? undefined : Buffer.concat(chunks),
  })
  const response = await handler.fetch(request)
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}).listen(port, () => console.log(`api on http://localhost:${port}`))
