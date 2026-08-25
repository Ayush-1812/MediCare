'use server'

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { v2 as cloudinary } from 'cloudinary'
import { createSession, destroySession, getSessionId } from '@/lib/auth'
import { rateLimit, resetRateLimit, retryAfterMessage } from '@/lib/rateLimit'
import {
    DEFAULT_SLOT_DURATION,
    DEFAULT_SLOT_END,
    DEFAULT_SLOT_START,
    WEEKDAYS,
    toSlotMap,
    type Weekday,
} from '@/lib/schedule'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

/** Fields a patient sees when browsing or opening a doctor's profile. */
const PUBLIC_DOCTOR_FIELDS = {
    id: true,
    name: true,
    image: true,
    gender: true,
    speciality: true,
    degree: true,
    experience: true,
    about: true,
    languages: true,
    awards: true,
    hospital: true,
    city: true,
    registrationNo: true,
    consultationModes: true,
    availableDays: true,
    slotStartTime: true,
    slotEndTime: true,
    slotDuration: true,
    rating: true,
    totalReviews: true,
    available: true,
    fees: true,
    address: true,
    slots_booked: true,
} as const

/** Everything the doctor themselves can see and edit. */
const OWN_DOCTOR_FIELDS = {
    ...PUBLIC_DOCTOR_FIELDS,
    email: true,
    phone: true,
    profileCompleted: true,
} as const

function fail(message: string) {
    return { success: false as const, message }
}

/**
 * Server actions are a public HTTP surface, so an unexpected throw must not travel back
 * to the browser verbatim — a Prisma error carries table and column names. Log the real
 * error, return something the person can act on.
 */
function unexpected(scope: string, error: unknown) {
    console.error(`[${scope}]`, error)
    return fail('Something went wrong. Please try again.')
}

async function uploadImage(file: File): Promise<string | undefined> {
    if (!file || file.size === 0) return undefined
    if (!file.type.startsWith('image/')) throw new Error('Profile photo must be an image file')
    if (file.size > 5 * 1024 * 1024) throw new Error('Profile photo must be 5MB or smaller')

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await new Promise<{ secure_url?: string }>((resolve, reject) => {
        cloudinary.uploader
            .upload_stream({ resource_type: 'image' }, (error, uploaded) => {
                if (error || !uploaded) reject(error ?? new Error('Upload failed'))
                else resolve(uploaded)
            })
            .end(buffer)
    })
    return result.secure_url
}

function parseAddress(raw: string | null): { line1: string; line2: string } {
    if (!raw) return { line1: '', line2: '' }
    try {
        const parsed = JSON.parse(raw)
        return { line1: String(parsed?.line1 ?? ''), line2: String(parsed?.line2 ?? '') }
    } catch {
        return { line1: raw, line2: '' }
    }
}

/** Comma-separated form values (`"Mon,Wed,Fri"`) narrowed to real weekdays. */
function parseDayList(raw: string | null): Weekday[] {
    return (raw ?? '')
        .split(',')
        .map((d) => d.trim())
        .filter((d): d is Weekday => WEEKDAYS.includes(d as Weekday))
}

function parseClockField(raw: string | null, fallback: string): string {
    const value = (raw ?? '').trim()
    return /^\d{1,2}:\d{2}$/.test(value) ? value : fallback
}

function parseCsv(raw: string | null): string[] {
    return (raw ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function registerDoctor(formData: FormData) {
    try {
        const name = ((formData.get('name') as string) ?? '').trim()
        const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
        const password = (formData.get('password') as string) ?? ''

        if (!name || !email || !password) return fail('Missing Details')
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address')
        if (password.length < 8) return fail('Password must be at least 8 characters')

        const signupLimit = rateLimit(`signup:doctor:${email}`, 10, 60 * 60 * 1000)
        if (!signupLimit.allowed) {
            return fail(`Too many sign-up attempts. ${retryAfterMessage(signupLimit.retryAfterSeconds)}`)
        }

        const existing = await prisma.doctor.findUnique({ where: { email }, select: { id: true } })
        if (existing) return fail('An account with this email already exists')

        const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10))

        const doctor = await prisma.doctor.create({
            data: {
                name,
                email,
                password: hashedPassword,
                // Held back from the patient-facing listings until the onboarding form is
                // submitted — a doctor with no speciality, fee or consulting hours cannot
                // be meaningfully found or booked.
                profileCompleted: false,
                available: false,
            },
        })

        const token = await createSession('doctor', doctor.id)
        return { success: true as const, token, profileCompleted: false }
    } catch (error) {
        return unexpected('registerDoctor', error)
    }
}

export async function loginDoctor(formData: FormData) {
    try {
        const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
        const password = (formData.get('password') as string) ?? ''

        // Same 5-per-15-minutes budget as patient login. Keyed separately from the patient
        // namespace so the two account types cannot exhaust each other's allowance.
        const limitKey = `login:doctor:${email}`
        const limit = rateLimit(limitKey, 5, 15 * 60 * 1000)
        if (!limit.allowed) {
            return fail(`Too many login attempts. ${retryAfterMessage(limit.retryAfterSeconds)}`)
        }

        const doctor = await prisma.doctor.findUnique({ where: { email } })
        // One message for both branches so the form cannot be used to enumerate accounts.
        if (!doctor || !(await bcrypt.compare(password, doctor.password))) {
            return fail('Invalid email or password')
        }

        resetRateLimit(limitKey)

        const token = await createSession('doctor', doctor.id)
        return { success: true as const, token, profileCompleted: doctor.profileCompleted }
    } catch (error) {
        return unexpected('loginDoctor', error)
    }
}

export async function logoutDoctor() {
    await destroySession('doctor')
    return { success: true as const }
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

/**
 * The form a doctor must complete straight after signing up. It collects everything a
 * patient needs in order to choose them (speciality, qualifications, fee, clinic) plus
 * the consulting hours the booking calendar is generated from. Only on success does the
 * doctor become visible and bookable.
 */
export async function completeDoctorOnboarding(formData: FormData) {
    try {
        const doctorId = await getSessionId('doctor')
        if (!doctorId) return fail('Your session has expired. Please sign in again.')

        const speciality = ((formData.get('speciality') as string) ?? '').trim()
        const degree = ((formData.get('degree') as string) ?? '').trim()
        const experience = ((formData.get('experience') as string) ?? '').trim()
        const registrationNo = ((formData.get('registrationNo') as string) ?? '').trim()
        const about = ((formData.get('about') as string) ?? '').trim()
        const gender = ((formData.get('gender') as string) ?? '').trim() || 'Not Selected'
        const phone = ((formData.get('phone') as string) ?? '').trim()
        const hospital = ((formData.get('hospital') as string) ?? '').trim()
        const city = ((formData.get('city') as string) ?? '').trim()
        const languages = ((formData.get('languages') as string) ?? '').trim()
        const awards = ((formData.get('awards') as string) ?? '').trim()
        const fees = Number.parseInt((formData.get('fees') as string) ?? '', 10)
        const address = parseAddress(formData.get('address') as string | null)
        const consultationModes = parseCsv(formData.get('consultationModes') as string | null)
        const availableDays = parseDayList(formData.get('availableDays') as string | null)
        const slotStartTime = parseClockField(formData.get('slotStartTime') as string | null, DEFAULT_SLOT_START)
        const slotEndTime = parseClockField(formData.get('slotEndTime') as string | null, DEFAULT_SLOT_END)
        const parsedDuration = Number.parseInt((formData.get('slotDuration') as string) ?? '', 10)
        const slotDuration =
            Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : DEFAULT_SLOT_DURATION

        if (!speciality) return fail('Speciality is required')
        if (!degree) return fail('Qualification is required')
        if (!experience) return fail('Years of experience is required')
        if (!registrationNo) return fail('Medical registration number is required')
        if (!about) return fail('Please add a short bio for your patients')
        if (!address.line1) return fail('Clinic address is required')
        if (!Number.isFinite(fees) || fees < 0) return fail('Enter a valid consultation fee')
        if (consultationModes.length === 0) return fail('Select at least one consultation mode')
        if (availableDays.length === 0) return fail('Select at least one available day')

        // Compared as `HH:MM` strings, which order correctly because the time input always
        // zero-pads both to the same width.
        if (slotEndTime <= slotStartTime) return fail('Consulting end time must be after the start time')

        let imageUrl: string | undefined
        const imageFile = formData.get('image')
        if (imageFile instanceof File) {
            try {
                imageUrl = await uploadImage(imageFile)
            } catch (error) {
                console.error('[completeDoctorOnboarding] image upload failed', error)
                return fail(error instanceof Error ? error.message : 'Could not upload your photo')
            }
        }

        await prisma.doctor.update({
            where: { id: doctorId },
            data: {
                speciality,
                degree,
                experience,
                registrationNo,
                about,
                gender,
                phone,
                hospital,
                city,
                languages,
                awards,
                fees,
                address,
                consultationModes,
                availableDays,
                slotStartTime,
                slotEndTime,
                slotDuration,
                ...(imageUrl ? { image: imageUrl } : {}),
                profileCompleted: true,
                available: true,
            },
        })

        revalidatePath('/doctors')
        revalidatePath('/doctor-dashboard/profile')
        return { success: true as const, message: 'Profile completed' }
    } catch (error) {
        return unexpected('completeDoctorOnboarding', error)
    }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function appointmentsDoctor() {
    try {
        const doctorId = await getSessionId('doctor')
        if (!doctorId) return fail('Your session has expired. Please sign in again.')

        const appointments = await prisma.appointment.findMany({
            where: { docId: doctorId },
            // Without an explicit order Postgres returns rows in whatever order it likes,
            // so "latest" was arbitrary and shifted between reloads.
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { name: true, image: true, gender: true, dob: true, phone: true } },
            },
        })

        return { success: true as const, appointments }
    } catch (error) {
        return unexpected('appointmentsDoctor', error)
    }
}

export async function appointmentComplete(appointmentId: string) {
    try {
        const doctorId = await getSessionId('doctor')
        if (!doctorId) return fail('Your session has expired. Please sign in again.')

        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
        if (!appointment || appointment.docId !== doctorId) return fail('Appointment not found')
        if (appointment.cancelled) return fail('This appointment was cancelled')

        await prisma.appointment.update({ where: { id: appointmentId }, data: { isCompleted: true } })

        revalidatePath('/doctor-dashboard/appointments')
        return { success: true as const, message: 'Appointment Completed' }
    } catch (error) {
        return unexpected('appointmentComplete', error)
    }
}

export async function appointmentCancelDoctor(appointmentId: string) {
    try {
        const doctorId = await getSessionId('doctor')
        if (!doctorId) return fail('Your session has expired. Please sign in again.')

        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
        if (!appointment || appointment.docId !== doctorId) return fail('Appointment not found')
        if (appointment.cancelled) return { success: true as const, message: 'Appointment Cancelled' }

        await prisma.appointment.update({ where: { id: appointmentId }, data: { cancelled: true } })
        // Cancelling from the doctor's side used to leave the slot held, so nobody could
        // book that time again.
        await releaseSlot(appointment.docId, appointment.slotDate, appointment.slotTime)

        revalidatePath('/doctor-dashboard/appointments')
        return { success: true as const, message: 'Appointment Cancelled' }
    } catch (error) {
        return unexpected('appointmentCancelDoctor', error)
    }
}

/** Removes a time from a doctor's held slots. Shared by both cancel paths. */
async function releaseSlot(docId: string, slotDate: string, slotTime: string) {
    const doctor = await prisma.doctor.findUnique({
        where: { id: docId },
        select: { slots_booked: true },
    })
    if (!doctor) return

    const slots = toSlotMap(doctor.slots_booked)
    if (!slots[slotDate]) return

    slots[slotDate] = slots[slotDate].filter((time) => time !== slotTime)
    await prisma.doctor.update({ where: { id: docId }, data: { slots_booked: slots } })
}

export async function doctorDashboard() {
    try {
        const doctorId = await getSessionId('doctor')
        if (!doctorId) return fail('Your session has expired. Please sign in again.')

        const appointments = await prisma.appointment.findMany({
            where: { docId: doctorId },
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true, image: true, gender: true } } },
        })

        const earnings = appointments
            .filter((item) => !item.cancelled && (item.isCompleted || item.payment))
            .reduce((total, item) => total + item.amount, 0)

        const patients = new Set(appointments.map((item) => item.userId)).size

        return {
            success: true as const,
            dashData: {
                earnings,
                appointments: appointments.length,
                patients,
                // Already newest-first from the query. The old `.reverse()` mutated the
                // array in place and handed back the *oldest* five.
                latestAppointments: appointments.slice(0, 5),
            },
        }
    } catch (error) {
        return unexpected('doctorDashboard', error)
    }
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function doctorProfile() {
    try {
        const doctorId = await getSessionId('doctor')
        if (!doctorId) return fail('Your session has expired. Please sign in again.')

        const profileData = await prisma.doctor.findUnique({
            where: { id: doctorId },
            select: OWN_DOCTOR_FIELDS,
        })
        if (!profileData) return fail('Doctor not found')

        return { success: true as const, profileData }
    } catch (error) {
        return unexpected('doctorProfile', error)
    }
}

export async function updateDoctorProfile(formData: FormData) {
    try {
        const doctorId = await getSessionId('doctor')
        if (!doctorId) return fail('Your session has expired. Please sign in again.')

        const speciality = ((formData.get('speciality') as string) ?? '').trim()
        const degree = ((formData.get('degree') as string) ?? '').trim()
        const experience = ((formData.get('experience') as string) ?? '').trim()
        const about = ((formData.get('about') as string) ?? '').trim()
        const gender = ((formData.get('gender') as string) ?? '').trim() || 'Not Selected'
        const phone = ((formData.get('phone') as string) ?? '').trim()
        const hospital = ((formData.get('hospital') as string) ?? '').trim()
        const city = ((formData.get('city') as string) ?? '').trim()
        const languages = ((formData.get('languages') as string) ?? '').trim()
        const awards = ((formData.get('awards') as string) ?? '').trim()
        const registrationNo = ((formData.get('registrationNo') as string) ?? '').trim()
        const fees = Number.parseInt((formData.get('fees') as string) ?? '', 10)
        const address = parseAddress(formData.get('address') as string | null)
        const available = formData.get('available') === 'true'
        const consultationModes = parseCsv(formData.get('consultationModes') as string | null)
        const availableDays = parseDayList(formData.get('availableDays') as string | null)
        const slotStartTime = parseClockField(formData.get('slotStartTime') as string | null, DEFAULT_SLOT_START)
        const slotEndTime = parseClockField(formData.get('slotEndTime') as string | null, DEFAULT_SLOT_END)
        const parsedDuration = Number.parseInt((formData.get('slotDuration') as string) ?? '', 10)
        const slotDuration =
            Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : DEFAULT_SLOT_DURATION

        if (!speciality) return fail('Speciality is required')
        // `parseInt('')` is NaN — writing that straight to an Int column used to blow up
        // inside Prisma and surface to the doctor as a raw database error.
        if (!Number.isFinite(fees) || fees < 0) return fail('Enter a valid consultation fee')
        if (availableDays.length === 0) return fail('Select at least one available day')
        if (slotEndTime <= slotStartTime) return fail('Consulting end time must be after the start time')

        let imageUrl: string | undefined
        const imageFile = formData.get('image')
        if (imageFile instanceof File) {
            try {
                imageUrl = await uploadImage(imageFile)
            } catch (error) {
                console.error('[updateDoctorProfile] image upload failed', error)
                return fail(error instanceof Error ? error.message : 'Could not upload your photo')
            }
        }

        await prisma.doctor.update({
            where: { id: doctorId },
            data: {
                speciality,
                degree,
                experience,
                about,
                gender,
                phone,
                hospital,
                city,
                languages,
                awards,
                registrationNo,
                fees,
                address,
                available,
                consultationModes,
                availableDays,
                slotStartTime,
                slotEndTime,
                slotDuration,
                ...(imageUrl ? { image: imageUrl } : {}),
            },
        })

        revalidatePath('/doctors')
        revalidatePath('/doctor-dashboard/profile')
        return { success: true as const, message: 'Profile Updated' }
    } catch (error) {
        return unexpected('updateDoctorProfile', error)
    }
}

// ─── Public listing ──────────────────────────────────────────────────────────

export async function doctorList() {
    try {
        const doctors = await prisma.doctor.findMany({
            // Doctors who signed up but never finished onboarding have no speciality, fee
            // or consulting hours, so they are not bookable and must not be listed.
            where: { profileCompleted: true },
            orderBy: { name: 'asc' },
            // Note: no `email` — this list is fetched by every visitor to the site.
            select: PUBLIC_DOCTOR_FIELDS,
        })
        return { success: true as const, doctors }
    } catch (error) {
        return unexpected('doctorList', error)
    }
}

// ─── Video consultation ──────────────────────────────────────────────────────
//
// `startVideoCall` and `getMeetingId` used to live here, duplicating what
// `consultationActions` does. Two places minting `meetingId` meant a room could be opened
// without a `startTime`, which broke the call timer and the recorded duration. The
// consultation room is the single owner of that lifecycle now — see
// `src/app/actions/consultationActions.ts`.
