/**
 * Post-seed sanity check: are the seeded doctors actually bookable, and does the voice
 * tool layer find them? Read-only.
 *   npx tsx scripts/check-seed.ts
 */
import fs from 'node:fs'
import path from 'node:path'
for (const f of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), f); if (!fs.existsSync(p)) continue
    for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (!m || process.env[m[1]]) continue
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
}
import prisma from '../src/lib/prisma'
import { generateSlots } from '../src/lib/schedule'

async function main() {
    const docs = await prisma.doctor.findMany({
        where: { profileCompleted: true, email: { endsWith: '@demo-medicare.invalid' } },
        select: { name: true, speciality: true, languages: true, city: true, fees: true,
            availableDays: true, slotStartTime: true, slotEndTime: true, slotDuration: true, slots_booked: true },
    })
    const counts = docs.map((d) => ({ name: d.name, open: generateSlots(d).reduce((a, b) => a + b.length, 0) }))
    const zero = counts.filter((c) => c.open === 0)
    const sorted = counts.map((c) => c.open).sort((a, b) => a - b)
    console.log(`seeded doctors: ${docs.length}`)
    console.log(`open slots over the next 7 days — min ${sorted[0]}, median ${sorted[Math.floor(sorted.length / 2)]}, max ${sorted[sorted.length - 1]}`)
    console.log(`doctors with zero open slots: ${zero.length ? zero.map((z) => z.name).join(', ') : 'none'}`)

    // The same filters search_doctors uses, to prove the voice layer reaches this data.
    for (const [label, where] of [
        ['speciality "derma"', { speciality: { contains: 'derma', mode: 'insensitive' as const } }],
        ['language "Tamil"', { languages: { contains: 'Tamil', mode: 'insensitive' as const } }],
        ['city "Pune"', { city: { contains: 'Pune', mode: 'insensitive' as const } }],
        ['fee <= 500', { fees: { lte: 500 } }],
    ] as const) {
        const n = await prisma.doctor.count({ where: { profileCompleted: true, available: true, ...where } })
        console.log(`  search_doctors ${label}: ${n} match(es)`)
    }
    await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
