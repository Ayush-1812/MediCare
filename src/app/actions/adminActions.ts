'use server'

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { v2 as cloudinary } from 'cloudinary'
import { createSession, destroySession } from '@/lib/auth'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

export async function loginAdmin(formData: FormData) {
    try {
        const email = formData.get('email') as string
        const password = formData.get('password') as string

        const adminEmail = process.env.ADMIN_EMAIL
        const adminPassword = process.env.ADMIN_PASSWORD
        if (!adminEmail || !adminPassword) {
            console.error('[loginAdmin] ADMIN_EMAIL / ADMIN_PASSWORD are not configured')
            return { success: false, message: "Admin login is not configured" }
        }

        if (email !== adminEmail || password !== adminPassword) {
            return { success: false, message: "Invalid Credentials" }
        }

        // The old token signed `email + password` as its payload — a JWT payload is only
        // base64, so the admin password was readable straight out of the cookie.
        const token = await createSession('admin', 'admin')
        return { success: true, token }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function addDoctor(formData: FormData) {
    try {
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
        const uploadResponse = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
                if (error) reject(error)
                else resolve(result)
            }).end(buffer)
        }) as any

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

        return { success: true, message: "Doctor Added" }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function allDoctors() {
    try {
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
        return { success: true, doctors }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function changeAvailability(docId: string) {
    try {
        const doctor = await prisma.doctor.findUnique({ where: { id: docId } })
        if (!doctor) return { success: false, message: "Doctor not found" }

        await prisma.doctor.update({
            where: { id: docId },
            data: { available: !doctor.available }
        })
        return { success: true, message: "Availability Changed" }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function appointmentsAdmin() {
    try {
        const appointments = await prisma.appointment.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { name: true, image: true, gender: true } },
                doctor: { select: { name: true, image: true, gender: true } }
            }
        })
        return { success: true, appointments }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function adminDashboard() {
    try {
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
            success: true,
            dashData: {
                doctors,
                appointments,
                patients: users,
                latestAppointments
            }
        }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function logoutAdmin() {
    await destroySession('admin')
    return { success: true }
}
