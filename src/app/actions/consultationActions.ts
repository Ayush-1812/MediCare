'use server'

import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { revalidatePath } from 'next/cache'

export async function startConsultation(appointmentId: string) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('docToken')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }

        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId }
        }) as any

        if (!appointment || appointment.docId !== decoded.id) {
            return { success: false, message: "Appointment not found or unauthorized" }
        }

        if (appointment.startTime) {
            return { success: true, message: "Consultation already started" }
        }

        // Initialize meeting ID if not present
        let meetingId = appointment.meetingId
        if (!meetingId) {
            meetingId = `medicare-${appointmentId}-${Math.random().toString(36).substring(7)}`
        }

        await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                startTime: new Date(),
                meetingId
            }
        })

        revalidatePath(`/video-call/${appointmentId}`)
        return { success: true, message: "Consultation started", meetingId }
    } catch (error: any) {
        console.error("Start Consultation Error:", error)
        return { success: false, message: error.message }
    }
}

export async function endConsultation(appointmentId: string, data: {
    diagnosis: string
    prescription: string
    notes: string
    followUpDate?: string
}) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('docToken')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId }
        }) as any

        if (!appointment || appointment.docId !== decoded.id) {
            return { success: false, message: "Unauthorized" }
        }

        const endTime = new Date()
        const startTime = appointment.startTime || new Date()
        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000) // Duration in seconds

        await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                endTime,
                duration,
                diagnosis: data.diagnosis,
                prescription: data.prescription,
                notes: data.notes,
                followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
                isCompleted: true
            }
        })

        revalidatePath(`/video-call/${appointmentId}`)
        return { success: true, message: "Consultation ended and saved" }
    } catch (error: any) {
        console.error("End Consultation Error:", error)
        return { success: false, message: error.message }
    }
}

export async function getConsultationDetails(appointmentId: string) {
    try {
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            select: {
                startTime: true,
                endTime: true,
                duration: true,
                diagnosis: true,
                prescription: true,
                notes: true,
                followUpDate: true,
                docId: true,
                userId: true,
                meetingId: true,
                cancelled: true,
                isCompleted: true
            }
        })
        return { success: true, appointment }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
