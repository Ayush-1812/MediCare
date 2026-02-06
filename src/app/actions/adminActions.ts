'use server'

import prisma from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

export async function loginAdmin(formData: FormData) {
    try {
        const email = formData.get('email') as string
        const password = formData.get('password') as string

        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign(email + password, process.env.JWT_SECRET!)
            const cookieStore = await cookies()
            cookieStore.set('adminToken', token, { httpOnly: true, secure: true })
            return { success: true, token }
        } else {
            return { success: false, message: "Invalid Credentials" }
        }
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
                fees,
                address: JSON.parse(address),
                image: uploadResponse.secure_url,
                slots_booked: {}
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
                awards: true
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
            include: {
                user: { select: { name: true, image: true } },
                doctor: { select: { name: true, image: true } }
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
                user: { select: { name: true, image: true } },
                doctor: { select: { name: true, image: true } }
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
