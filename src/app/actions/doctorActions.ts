'use server'

import prisma from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

export async function loginDoctor(formData: FormData) {
    try {
        const email = formData.get('email') as string
        const password = formData.get('password') as string

        const doctor = await prisma.doctor.findUnique({ where: { email } })
        if (!doctor) return { success: false, message: "Doctor not found" }

        const isMatch = await bcrypt.compare(password, doctor.password)
        if (isMatch) {
            const token = jwt.sign({ id: doctor.id }, process.env.JWT_SECRET!)
            const cookieStore = await cookies()
            cookieStore.set('docToken', token, { httpOnly: true, secure: true })
            return { success: true, token }
        } else {
            return { success: false, message: "Invalid Credentials" }
        }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function appointmentsDoctor() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('docToken')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
        const appointments = await prisma.appointment.findMany({
            where: { docId: decoded.id },
            include: { user: { select: { name: true, image: true, dob: true } } }
        })
        return { success: true, appointments }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function appointmentComplete(appointmentId: string) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('docToken')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })

        if (appointment && appointment.docId === decoded.id) {
            await prisma.appointment.update({
                where: { id: appointmentId },
                data: { isCompleted: true }
            })
            return { success: true, message: "Appointment Completed" }
        } else {
            return { success: false, message: "Unauthorized" }
        }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function appointmentCancelDoctor(appointmentId: string) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('docToken')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })

        if (appointment && appointment.docId === decoded.id) {
            await prisma.appointment.update({
                where: { id: appointmentId },
                data: { cancelled: true }
            })
            return { success: true, message: "Appointment Cancelled" }
        } else {
            return { success: false, message: "Unauthorized" }
        }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function doctorDashboard() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('docToken')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
        const appointments = await prisma.appointment.findMany({
            where: { docId: decoded.id },
            include: { user: { select: { name: true, image: true } } }
        })

        let earnings = 0
        appointments.map((item) => {
            if (item.isCompleted || item.payment) {
                earnings += item.amount
            }
        })

        let patients: string[] = []
        appointments.map((item) => {
            if (!patients.includes(item.userId)) {
                patients.push(item.userId)
            }
        })

        const dashData = {
            earnings,
            appointments: appointments.length,
            patients: patients.length,
            latestAppointments: appointments.reverse().slice(0, 5)
        }

        return { success: true, dashData }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function doctorProfile() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('docToken')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
        const profileData = await prisma.doctor.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                speciality: true,
                degree: true,
                experience: true,
                about: true,
                fees: true,
                address: true,
                available: true
            }
        })

        return { success: true, profileData }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function updateDoctorProfile(formData: FormData) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('docToken')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
        const speciality = formData.get('speciality') as string
        const degree = formData.get('degree') as string
        const experience = formData.get('experience') as string
        const about = formData.get('about') as string
        const fees = parseInt(formData.get('fees') as string)
        const address = formData.get('address') as string
        const available = formData.get('available') === 'true'

        await prisma.doctor.update({
            where: { id: decoded.id },
            data: {
                speciality,
                degree,
                experience,
                about,
                fees,
                address: JSON.parse(address),
                available
            }
        })

        return { success: true, message: "Profile Updated" }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function doctorList() {
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
                slots_booked: true
            }
        })
        return { success: true, doctors }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function registerDoctor(formData: FormData) {
    try {
        const name = formData.get('name') as string
        const email = formData.get('email') as string
        const password = formData.get('password') as string

        if (!name || !email || !password) {
            return { success: false, message: "Missing Details" }
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const doctor = await prisma.doctor.create({
            data: {
                name,
                email,
                password: hashedPassword,
                image: '', // Initialize with empty strings instead of null if preferred, or keep null
                speciality: '',
                degree: '',
                experience: '',
                about: '',
                fees: 0,
                address: { line1: '', line2: '' }
            }
        })

        const token = jwt.sign({ id: doctor.id }, process.env.JWT_SECRET!)
        const cookieStore = await cookies()
        cookieStore.set('docToken', token, { httpOnly: true, secure: true })

        return { success: true, token }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function startVideoCall(appointmentId: string) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('docToken')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })

        if (appointment && appointment.docId === decoded.id) {
            if (appointment.meetingId) {
                return { success: true, meetingId: appointment.meetingId }
            }
            const meetingId = `medicare-${appointmentId}-${Math.random().toString(36).substring(7)}`
            await prisma.appointment.update({
                where: { id: appointmentId },
                data: { meetingId }
            })
            return { success: true, meetingId }
        } else {
            return { success: false, message: "Unauthorized" }
        }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function getMeetingId(appointmentId: string) {
    try {
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            select: { meetingId: true }
        })
        return { success: true, meetingId: appointment?.meetingId }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}
