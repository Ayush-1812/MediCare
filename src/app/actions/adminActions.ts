'use server'

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { v2 as cloudinary } from 'cloudinary'
import { createSession, destroySession, getSessionId } from '@/lib/auth'
import { rateLimit, resetRateLimit, retryAfterMessage } from '@/lib/rateLimit'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

function fail(message: string) {
    return { success: false as const, message }
}

/**
 * Raw errors must not reach the browser: a Prisma failure message can carry table and
 * column names, and a Cloudinary one can carry account details. Every action below now
 * logs the real error server-side and returns this instead.
 */
function unexpected(scope: string, error: unknown) {
    console.error(`[${scope}]`, error)
    return fail('Something went wrong. Please try again.')
}

/**
 * Gate for every admin action.
 *
 * Server actions are ordinary POST endpoints — anything exported from a `'use server'`
 * file is callable by anyone who can reach the app, whether or not the UI ever shows
 * them a button. These actions previously had no check at all, so `appointmentsAdmin`
 * would hand every patient's appointment history to an unauthenticated caller. The
 * admin *page* guard is not a substitute: it only decides what gets rendered.
 */
async function requireAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
    const adminId = await getSessionId('admin')
    if (!adminId) return { ok: false, message: 'Not authorized. Please sign in as an administrator.' }
    return { ok: true }
}

/**
 * Compares two secrets without leaking their contents through timing.
 *
 * `a !== b` on strings bails at the first differing byte, so response time reveals how
 * much of a guess was correct — enough to recover a secret character by character given
 * enough attempts. Both sides are hashed first so the comparison is always over equal
 * lengths, which `timingSafeEqual` requires.
 */
function secretsMatch(a: string, b: string): boolean {
    const ha = crypto.createHash('sha256').update(a).digest()
    const hb = crypto.createHash('sha256').update(b).digest()
    return crypto.timingSafeEqual(ha, hb)
}

export async function loginAdmin(formData: FormData) {
    try {
        const email = ((formData.get('email') as string) ?? '').trim()
        const password = (formData.get('password') as string) ?? ''

        const adminEmail = process.env.ADMIN_EMAIL
        // Prefer a bcrypt hash. ADMIN_PASSWORD (plaintext) still works so existing
        // deployments keep logging in, but it is the weaker path: anything that exposes
        // the environment — a log dump, a crash report, a shared .env — exposes the
        // password itself. Generate a hash and set ADMIN_PASSWORD_HASH instead.
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH
        const adminPassword = process.env.ADMIN_PASSWORD

        if (!adminEmail || (!adminPasswordHash && !adminPassword)) {
            console.error('[loginAdmin] ADMIN_EMAIL and ADMIN_PASSWORD_HASH (or ADMIN_PASSWORD) are not configured')
            return fail('Admin login is not configured')
        }

        if (!adminPasswordHash) {
            console.warn(
                '[loginAdmin] Using plaintext ADMIN_PASSWORD. Set ADMIN_PASSWORD_HASH ' +
                'to a bcrypt hash instead — see .env.example.',
            )
        }

        // Tighter than the patient and doctor limits: there is exactly one admin account,
        // it is the highest-value target in the app, and a legitimate administrator has no
        // reason to need more than a handful of attempts. Keyed on the submitted email so
        // guessing a wrong username cannot lock the real admin out of their own budget.
        const limitKey = `login:admin:${email.toLowerCase()}`
        const limit = rateLimit(limitKey, 5, 15 * 60 * 1000)
        if (!limit.allowed) {
            return fail(`Too many login attempts. ${retryAfterMessage(limit.retryAfterSeconds)}`)
        }

        const emailOk = secretsMatch(email.toLowerCase(), adminEmail.trim().toLowerCase())
        const passwordOk = adminPasswordHash
            ? await bcrypt.compare(password, adminPasswordHash)
            : secretsMatch(password, adminPassword as string)

        // One message for both branches, so the form cannot be used to discover whether
        // an email is the admin's.
        if (!emailOk || !passwordOk) {
            return fail('Invalid Credentials')
        }

        resetRateLimit(limitKey)

        // The old token signed `email + password` as its payload — a JWT payload is only
        // base64, so the admin password was readable straight out of the cookie.
        const token = await createSession('admin', 'admin')
        return { success: true as const, token }
    } catch (error) {
        return unexpected('loginAdmin', error)
    }
}

export async function addDoctor(formData: FormData) {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) return fail(auth.message)

        const name = formData.get('name') as string
        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const speciality = formData.get('speciality') as string
        const degree = formData.get('degree') as string
        const experience = formData.get('experience') as string
        const about = formData.get('about') as string
        const fees = parseInt(formData.get('fees') as string)
        const address = formData.get('address') as string
        const languages = formData.get('languages') as string
        const awards = formData.get('awards') as string
        const gender = ((formData.get('gender') as string) ?? '').trim() || 'Not Selected'
        const phone = ((formData.get('phone') as string) ?? '').trim()
        const registrationNo = ((formData.get('registrationNo') as string) ?? '').trim()
        const hospital = ((formData.get('hospital') as string) ?? '').trim()
        const city = ((formData.get('city') as string) ?? '').trim()
        const consultationModes = ((formData.get('consultationModes') as string) ?? 'Video Consultation')
            .split(',').map((m) => m.trim()).filter(Boolean)
        const availableDays = ((formData.get('availableDays') as string) ?? 'Mon,Tue,Wed,Thu,Fri')
            .split(',').map((d) => d.trim()).filter(Boolean)
        const slotStartTime = ((formData.get('slotStartTime') as string) ?? '').trim() || '10:00'
        const slotEndTime = ((formData.get('slotEndTime') as string) ?? '').trim() || '17:00'
        const parsedDuration = parseInt((formData.get('slotDuration') as string) ?? '', 10)
        const slotDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30
        const imageFile = formData.get('image') as File

        if (!name || !email || !password || !speciality || !degree || !experience || !about || isNaN(fees) || !address || !imageFile) {
            return { success: false, message: "Missing Details" }
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        // Image Upload
        const arrayBuffer = await imageFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        // Only `secure_url` is read below, so that is all this needs to promise.
        const uploadResponse = await new Promise<{ secure_url?: string }>((resolve, reject) => {
            cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
                if (error || !result) reject(error ?? new Error('Image upload failed'))
                else resolve(result)
            }).end(buffer)
        })

        await prisma.doctor.create({
            data: {
                name,
                email,
                password: hashedPassword,
                speciality,
                degree,
                experience,
                about,
                languages,
                awards,
                gender,
                phone,
                registrationNo,
                hospital,
                city,
                consultationModes,
                availableDays,
                slotStartTime,
                slotEndTime,
                slotDuration,
                fees,
                address: JSON.parse(address),
                image: uploadResponse.secure_url,
                slots_booked: {},
                profileCompleted: true
            }
        })

        return { success: true as const, message: "Doctor Added" }
    } catch (error) {
        return unexpected('addDoctor', error)
    }
}

export async function allDoctors() {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) return fail(auth.message)

        const doctors = await prisma.doctor.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                speciality: true,
                degree: true,
                experience: true,
                about: true,
                available: true,
                fees: true,
                address: true,
                languages: true,
                awards: true,
                gender: true,
                hospital: true,
                city: true,
                registrationNo: true,
                availableDays: true,
                slotStartTime: true,
                slotEndTime: true,
                profileCompleted: true
            }
        })
        return { success: true as const, doctors }
    } catch (error) {
        return unexpected('allDoctors', error)
    }
}

export async function changeAvailability(docId: string) {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) return fail(auth.message)

        const doctor = await prisma.doctor.findUnique({ where: { id: docId } })
        if (!doctor) return { success: false, message: "Doctor not found" }

        await prisma.doctor.update({
            where: { id: docId },
            data: { available: !doctor.available }
        })
        return { success: true as const, message: "Availability Changed" }
    } catch (error) {
        return unexpected('changeAvailability', error)
    }
}

export async function appointmentsAdmin() {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) return fail(auth.message)

        const appointments = await prisma.appointment.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { name: true, image: true, gender: true } },
                doctor: { select: { name: true, image: true, gender: true } }
            }
        })
        return { success: true as const, appointments }
    } catch (error) {
        return unexpected('appointmentsAdmin', error)
    }
}

export async function adminDashboard() {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) return fail(auth.message)

        const doctors = await prisma.doctor.count()
        const users = await prisma.user.count()
        const appointments = await prisma.appointment.count()
        const latestAppointments = await prisma.appointment.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { name: true, image: true, gender: true } },
                doctor: { select: { name: true, image: true, gender: true } }
            }
        })

        return {
            success: true as const,
            dashData: {
                doctors,
                appointments,
                patients: users,
                latestAppointments
            }
        }
    } catch (error) {
        return unexpected('adminDashboard', error)
    }
}

/**
 * Whether the caller holds a valid admin session.
 *
 * The admin layout used to decide this from `localStorage.getItem('adminToken')`, which
 * proves nothing: it is writable from the console, and it says nothing about whether the
 * httpOnly cookie the server actually trusts is present or still valid. This asks the
 * server, so an expired or forged session is caught.
 */
export async function verifyAdminSession() {
    const auth = await requireAdmin()
    return { success: auth.ok }
}

export async function logoutAdmin() {
    await destroySession('admin')
    return { success: true as const }
}
