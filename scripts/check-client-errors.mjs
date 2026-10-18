/**
 * Loads pages in a real browser and reports client-side exceptions.
 * ──────────────────────────────────────────────────────────────────
 * "Application error: a client-side exception has occurred" is Next's generic message for
 * an uncaught error during render or hydration. The useful detail only exists in the
 * browser console, which is awkward to read off a deployed site and impossible to read
 * from a screenshot — so this opens the pages headlessly and prints what the console says.
 *
 * Run it against a local production build, or any deployment:
 *   node scripts/check-client-errors.mjs
 *   BASE_URL=https://your-site.example node scripts/check-client-errors.mjs
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000'
const PAGES = (process.env.PAGES || '/,/about,/login?mode=signup,/doctors').split(',')

/** playwright-core pins an exact browser build; resolve whatever is installed instead. */
function resolveChromium() {
    if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
    const root = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright')
    if (fs.existsSync(root)) {
        const builds = fs
            .readdirSync(root)
            .filter((n) => /^chromium-\d+$/.test(n))
            .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
        for (const b of builds) {
            const exe = path.join(root, b, 'chrome-win64', 'chrome.exe')
            if (fs.existsSync(exe)) return exe
        }
    }
    for (const c of [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]) {
        if (fs.existsSync(c)) return c
    }
    return undefined
}

async function main() {
    const browser = await chromium.launch({ executablePath: resolveChromium() })
    let failures = 0

    try {
        for (const route of PAGES) {
            const context = await browser.newContext()
            const page = await context.newPage()

            const errors = []
            const warnings = []
            // `pageerror` is the uncaught exception itself — the thing Next is hiding
            // behind its generic message.
            page.on('pageerror', (e) => errors.push(`UNCAUGHT  ${e.message}`))
            page.on('console', (m) => {
                if (m.type() === 'error') errors.push(`console.error  ${m.text()}`)
                else if (m.type() === 'warning') warnings.push(m.text())
            })
            page.on('requestfailed', (r) =>
                errors.push(`request failed  ${r.url().slice(0, 100)} — ${r.failure()?.errorText}`),
            )

            const url = `${BASE}${route}`
            let status = 'n/a'
            try {
                const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
                status = String(res?.status() ?? 'no response')
                // Hydration runs after DOMContentLoaded, and the crash happens there.
                await page.waitForTimeout(6000)
            } catch (e) {
                errors.push(`navigation failed  ${e.message.split('\n')[0]}`)
            }

            // Next renders this exact text when a client exception escapes.
            const crashed = await page
                .locator('text=Application error')
                .count()
                .catch(() => 0)

            const bad = errors.length > 0 || crashed > 0
            if (bad) failures += 1
            console.log(`\n  ${route}  → HTTP ${status}${crashed ? '  ** CLIENT CRASH **' : ''}`)
            for (const e of errors.slice(0, 8)) console.log(`      ${e}`)
            if (!bad) console.log('      clean')
            if (warnings.length) console.log(`      (${warnings.length} warnings)`)

            await context.close()
        }
    } finally {
        await browser.close()
    }

    console.log(`\n${PAGES.length - failures}/${PAGES.length} pages clean\n`)
    if (failures) process.exitCode = 1
}

main().catch((e) => {
    console.error('check failed:', e)
    process.exitCode = 1
})
