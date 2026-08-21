'use server'

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { v2 as cloudinary } from 'cloudinary'
import { createSession, destroySession, getSessionId } from '@/lib/auth'
import { toSlotMap } from '@/lib/schedule'
import { after } from 'next/server'
import { sendAppointmentBookedEmails } from '@/lib/mail/appointmentEmails'
import {
    BLOOD_GROUPS,
    DOB_UNSET,
    isValidPhone,
    normalizeGender,
    PHONE_UNSET,
} from '@/lib/profile'
import type { Prisma } from '@prisma/client'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

function fail(message: string) {
    return { success: false as const, message }
}

/** See the note in `doctorActions` — raw errors must not reach the browser. */
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

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function registerUser(formData: FormData) {
    try {
        const name = ((formData.get('name') as string) ?? '').trim()
        const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
        const password = (formData.get('password') as string) ?? ''
        const gender = ((formData.get('gender') as string) ?? '').trim()

        if (!name || !email || !password) return fail('Missing Details')
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address')
        if (password.length < 8) return fail('Password must be at least 8 characters')

        const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
        if (existing) return fail('An account with this email already exists')

        const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10))

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                // Captured at sign-up so we can show the right default avatar before the
                // patient uploads a photo. Normalised because the form's "unset" option
                // must land on the same string the profile page's <select> offers.
                gender: normalizeGender(gender),
            },
        })

        const token = await createSession('user', user.id)
        return { success: true as const, token }
    } catch (error) {
        return unexpected('registerUser', error)
    }
}

export async function loginUser(formData: FormData) {
    try {
        const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
        const password = (formData.get('password') as string) ?? ''

        const user = await prisma.user.findUnique({ where: { email } })
        // One message for both branches so the form cannot be used to enumerate accounts.
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return fail('Invalid email or password')
        }

        const token = await createSession('user', user.id)
        return { success: true as const, token }
    } catch (error) {
        return unexpected('loginUser', error)
    }
}

export async function logoutUser() {
    await destroySession('user')
    return { success: true as const }
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile() {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                address: true,
                gender: true,
                dob: true,
                phone: true,
                heightCm: true,
                weightKg: true,
                bloodGroup: true,
                allergies: true,
            },
        })
        if (!user) return fail('User not found')

        return { success: true as const, userData: user }
    } catch (error) {
        return unexpected('getProfile', error)
    }
}

export async function updateProfile(formData: FormData) {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        const name = ((formData.get('name') as string) ?? '').trim()
        const phone = ((formData.get('phone') as string) ?? '').trim()
        const gender = normalizeGender(formData.get('gender') as string | null)
        const dob = ((formData.get('dob') as string) ?? '').trim() || DOB_UNSET
        const rawAddress = formData.get('address') as string | null

        if (!name) return fail('Name is required')

        // A malformed address string used to throw out of JSON.parse and surface as a
        // "Unexpected token" toast.
        let address: { line1: string; line2: string } | undefined
        if (rawAddress) {
            try {
                const parsed = JSON.parse(rawAddress)
                address = { line1: String(parsed?.line1 ?? ''), line2: String(parsed?.line2 ?? '') }
            } catch {
                return fail('Could not save your address. Please re-enter it.')
            }
        }

        let imageUrl: string | undefined
        const imageFile = formData.get('image')
        if (imageFile instanceof File) {
            try {
                imageUrl = await uploadImage(imageFile)
            } catch (error) {
                console.error('[updateProfile] image upload failed', error)
                return fail(error instanceof Error ? error.message : 'Could not upload your photo')
            }
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                phone,
                gender,
                dob,
                ...(address ? { address } : {}),
                ...(imageUrl ? { image: imageUrl } : {}),
            },
        })

        revalidatePath('/my-profile')
        return { success: true as const, message: 'Profile Updated' }
    } catch (error) {
        return unexpected('updateProfile', error)
    }
}

// ─── Appointments ────────────────────────────────────────────────────────────

export async function bookAppointment(docId: string, slotDate: string, slotTime: string) {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        if (!docId || !slotDate || !slotTime) return fail('Please pick a date and time slot')

        const doctor = await prisma.doctor.findUnique({ where: { id: docId } })
        if (!doctor || !doctor.available || !doctor.profileCompleted) {
            return fail('Doctor not available')
        }

        const userData = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true, image: true, gender: true, dob: true, phone: true, address: true },
        })
        if (!userData) return fail('User not found')

        // Read-modify-write on `slots_booked` is not safe on its own: two patients booking
        // the same slot at once both read it as free and both write their own version of
        // the JSON, so one booking silently overwrites the other's hold. Doing the check
        // and both writes inside one transaction keeps the slot list consistent.
        const booking = await prisma.$transaction(async (tx) => {
            const current = await tx.doctor.findUnique({
                where: { id: docId },
                select: {
                    slots_booked: true,
                    fees: true,
                    name: true,
                    image: true,
                    speciality: true,
                    address: true,
                    // Only needed to address the confirmation email to the doctor.
                    email: true,
                    degree: true,
                    experience: true,
                    hospital: true,
                    city: true,
                    phone: true,
                },
            })
            if (!current) throw new Error('DOCTOR_NOT_FOUND')

            const slots = toSlotMap(current.slots_booked)
            const existing = slots[slotDate] ?? []
            if (existing.includes(slotTime)) throw new Error('SLOT_TAKEN')

            const appointment = await tx.appointment.create({
                data: {
                    userId,
                    docId,
                    slotDate,
                    slotTime,
                    userData: userData as Prisma.InputJsonObject,
                    docData: {
                        name: current.name,
                        image: current.image,
                        speciality: current.speciality,
                        address: current.address,
                    } as Prisma.InputJsonObject,
                    amount: current.fees ?? 0,
                    date: Math.floor(Date.now() / 1000),
                },
                select: { id: true, amount: true },
            })

            await tx.doctor.update({
                where: { id: docId },
                data: { slots_booked: { ...slots, [slotDate]: [...existing, slotTime] } },
            })

            return { appointment, doctor: current }
        })

        // Confirmation emails are handed to `after()`, which runs them once the response has
        // already been sent. Awaiting them inline made every booking wait on Gmail — roughly
        // 2.5s just to open and authenticate the connection — for a result the patient never
        // sees. `after()` is the serverless-safe way to do this: a bare floating promise can
        // be killed the moment the function returns, whereas the platform keeps the
        // invocation alive for work registered here.
        //
        // Their result is never allowed to change the outcome of the booking either — a dead
        // SMTP host must not surface as "booking failed" for a slot that is already held.
        after(async () => {
            try {
                await sendAppointmentBookedEmails({
                    appointmentId: booking.appointment.id,
                    slotDate,
                    slotTime,
                    amount: booking.appointment.amount,
                    patient: {
                        name: userData.name,
                        email: userData.email,
                        phone: userData.phone,
                        gender: userData.gender,
                        dob: userData.dob,
                    },
                    doctor: {
                        name: booking.doctor.name,
                        email: booking.doctor.email,
                        speciality: booking.doctor.speciality,
                        degree: booking.doctor.degree,
                        experience: booking.doctor.experience,
                        hospital: booking.doctor.hospital,
                        city: booking.doctor.city,
                        phone: booking.doctor.phone,
                        address: booking.doctor.address as { line1?: string; line2?: string } | null,
                    },
                })
            } catch (error) {
                console.error(
                    `[mail] [appointment ${booking.appointment.id}] confirmation emails threw`,
                    error,
                )
            }
        })

        revalidatePath('/my-appointments')
        revalidatePath('/doctor-dashboard/appointments')
        revalidatePath('/doctor-dashboard/dashboard')
        return { success: true as const, message: 'Appointment Booked' }
    } catch (error) {
        if (error instanceof Error && error.message === 'SLOT_TAKEN') {
            return fail('That slot has just been taken. Please choose another time.')
        }
        if (error instanceof Error && error.message === 'DOCTOR_NOT_FOUND') {
            return fail('Doctor not available')
        }
        return unexpected('bookAppointment', error)
    }
}

export async function listAppointments() {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        const appointments = await prisma.appointment.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        gender: true,
                        speciality: true,
                        address: true,
                        hospital: true,
                        city: true,
                    },
                },
            },
        })

        return { success: true as const, appointments }
    } catch (error) {
        return unexpected('listAppointments', error)
    }
}

export async function cancelAppointment(appointmentId: string) {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
        if (!appointment || appointment.userId !== userId) return fail('Appointment not found')
        if (appointment.cancelled) return { success: true as const, message: 'Appointment Cancelled' }

        const { docId, slotDate, slotTime } = appointment

        await prisma.appointment.update({ where: { id: appointmentId }, data: { cancelled: true } })

        const doctor = await prisma.doctor.findUnique({
            where: { id: docId },
            select: { slots_booked: true },
        })
        if (doctor) {
            const slots = toSlotMap(doctor.slots_booked)
            // Guarded: this used to call `.filter` straight on the lookup, which threw a
            // TypeError whenever the date key was missing from the JSON.
            if (slots[slotDate]) {
                slots[slotDate] = slots[slotDate].filter((time) => time !== slotTime)
                await prisma.doctor.update({ where: { id: docId }, data: { slots_booked: slots } })
            }
        }

        revalidatePath('/my-appointments')
        revalidatePath('/doctor-dashboard/appointments')
        return { success: true as const, message: 'Appointment Cancelled' }
    } catch (error) {
        return unexpected('cancelAppointment', error)
    }
}

// ─── Complete your profile ───────────────────────────────────────────────────

/**
 * Saves everything behind the "Complete your profile" form: date of birth, phone,
 * address and gender alongside the health details.
 *
 * Every field is optional and clears to null / the unset sentinel rather than to 0 or an
 * empty string, so the dashboard can tell "not provided yet" apart from a real value and
 * hide the card instead of rendering a placeholder.
 */
export async function updateProfileDetails(formData: FormData) {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        const gender = normalizeGender(formData.get('gender') as string | null)
        const rawDob = ((formData.get('dob') as string) ?? '').trim()
        const rawPhone = ((formData.get('phone') as string) ?? '').trim()
        const line1 = ((formData.get('addressLine1') as string) ?? '').trim()
        const line2 = ((formData.get('addressLine2') as string) ?? '').trim()
        const rawHeight = ((formData.get('heightCm') as string) ?? '').trim()
        const rawWeight = ((formData.get('weightKg') as string) ?? '').trim()
        const bloodGroup = ((formData.get('bloodGroup') as string) ?? '').trim()
        const allergies = ((formData.get('allergies') as string) ?? '').trim()

        let dob = DOB_UNSET
        if (rawDob) {
            const parsed = new Date(rawDob)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDob) || Number.isNaN(parsed.getTime())) {
                return fail('Enter a valid date of birth')
            }
            // A birth date in the future, or implausibly far back, is a typo.
            const now = new Date()
            if (parsed.getTime() > now.getTime()) return fail('Date of birth cannot be in the future')
            if (now.getFullYear() - parsed.getFullYear() > 120) return fail('Enter a valid date of birth')
            dob = rawDob
        }

        if (rawPhone && !isValidPhone(rawPhone)) {
            return fail('Enter a valid phone number')
        }

        let heightCm: number | null = null
        if (rawHeight) {
            heightCm = Number.parseInt(rawHeight, 10)
            if (!Number.isFinite(heightCm) || heightCm < 30 || heightCm > 275) {
                return fail('Enter a height between 30 and 275 cm')
            }
        }

        let weightKg: number | null = null
        if (rawWeight) {
            weightKg = Number.parseFloat(rawWeight)
            if (!Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500) {
                return fail('Enter a weight between 1 and 500 kg')
            }
        }

        if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup as (typeof BLOOD_GROUPS)[number])) {
            return fail('Select a valid blood group')
        }

        if (allergies.length > 500) {
            return fail('Please keep allergies under 500 characters')
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                gender,
                dob,
                phone: rawPhone || PHONE_UNSET,
                address: { line1, line2 },
                heightCm,
                weightKg,
                bloodGroup: bloodGroup || null,
                allergies: allergies || null,
            },
        })

        revalidatePath('/my-profile')
        return { success: true as const, message: 'Profile saved' }
    } catch (error) {
        return unexpected('updateProfileDetails', error)
    }
}
