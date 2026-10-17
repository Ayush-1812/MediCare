const fs = require('fs'), path = require('path')
for (const f of ['.env.local', '.env']) {
  const p = path.join(process.cwd(), f); if (!fs.existsSync(p)) continue
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (!m || process.env[m[1]]) continue
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
;(async () => {
  try {
    const t = Date.now(); await p.$queryRaw`SELECT 1`
    console.log('  reachable — SELECT 1 in ' + (Date.now() - t) + 'ms')
    const seq = []
    for (let i = 0; i < 10; i++) { const s = Date.now(); await p.$queryRaw`SELECT 1`; seq.push(Date.now() - s) }
    console.log('  10 sequential round-trips (ms): ' + seq.join(', '))
  } catch (e) { console.log('  UNREACHABLE — ' + String(e.message).split('\n').filter(Boolean).pop()) }
  await p.$disconnect()
})()
