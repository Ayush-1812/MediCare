import { VOICE_TOOLS } from '../../src/lib/voice/tools/definitions'
import { buildSystemInstruction, buildTimeContext } from '../../src/lib/voice/prompt'
const toolsJson = JSON.stringify(VOICE_TOOLS)
const sys = buildSystemInstruction({ name: 'Ayush Jangid', upcomingCount: 1, hasJoinableConsultation: false }, 'en-IN', buildTimeContext('Asia/Kolkata'))
const est = (n: number) => Math.ceil(n / 4)
console.log(`system prompt:     ${sys.length} chars  ~${est(sys.length)} tokens`)
console.log(`tool declarations: ${toolsJson.length} chars  ~${est(toolsJson.length)} tokens  (${VOICE_TOOLS.length} tools)`)
const rows = VOICE_TOOLS.map((t) => ({ name: t.name as string, chars: JSON.stringify(t).length, desc: (t.description ?? '').length }))
rows.sort((a, b) => b.chars - a.chars)
console.log('\nlargest declarations:')
for (const r of rows.slice(0, 8)) console.log(`  ${String(r.chars).padStart(5)} chars  (description ${String(r.desc).padStart(4)})  ${r.name}`)
