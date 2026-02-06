'use server'

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { v2 as cloudinary } from 'cloudinary'

// Cloudinary config should be here or in a separate file
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

export async function registerUser(formData: FormData) {
    try {
        const name = formData.get('name') as string
        const email = formData.get('email') as string
        const password = formData.get('password') as string

        if (!name || !email || !password) {
            return { success: false, message: "Missing Details" }
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword
            }
        })

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!)
        const cookieStore = await cookies()
        cookieStore.set('token', token, { httpOnly: true, secure: true })

        return { success: true, token }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function loginUser(formData: FormData) {
    try {
        const email = formData.get('email') as string
        const password = formData.get('password') as string

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
            return { success: false, message: "User does not exist" }
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (isMatch) {
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!)
            const cookieStore = await cookies()
            cookieStore.set('token', token, { httpOnly: true, secure: true })
            return { success: true, token }
        } else {
            return { success: false, message: "Invalid credentials" }
        }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function getProfile() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                address: true,
                gender: true,
                dob: true,
                phone: true
            }
        })

        return { success: true, userData: user }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function updateProfile(formData: FormData) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }

        const name = formData.get('name') as string
        const phone = formData.get('phone') as string
        const address = formData.get('address') as string // Should be JSON string
        const gender = formData.get('gender') as string
        const dob = formData.get('dob') as string
        const imageFile = formData.get('image') as File | null

        let imageUrl = undefined
        if (imageFile && imageFile.size > 0) {
            // Handle image upload to cloudinary
            // In Server Actions, we need to convert File to Buffer
            const arrayBuffer = await imageFile.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            const uploadResponse = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
                    if (error) reject(error)
                    else resolve(result)
                }).end(buffer)
            }) as any

            imageUrl = uploadResponse.secure_url
        }

        await prisma.user.update({
            where: { id: decoded.id },
            data: {
                name,
                phone,
                address: address ? JSON.parse(address) : undefined,
                gender,
                dob,
                image: imageUrl
            }
        })

        return { success: true, message: "Profile Updated" }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function bookAppointment(docId: string, slotDate: string, slotTime: string) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }

        const docData = await prisma.doctor.findUnique({ where: { id: docId } })
        if (!docData || !docData.available) {
            return { success: false, message: "Doctor not available" }
        }

        let slots_booked = docData.slots_booked as any
        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return { success: false, message: "Slot not available" }
            }
            slots_booked[slotDate].push(slotTime)
        } else {
            slots_booked[slotDate] = []
            slots_booked[slotDate].push(slotTime)
        }

        const userData = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { name: true, email: true, image: true, address: true }
        })

        // Create appointment
        await prisma.appointment.create({
            data: {
                userId: decoded.id,
                docId,
                slotDate,
                slotTime,
                userData: userData as any,
                docData: {
                    name: docData.name,
                    image: docData.image,
                    speciality: docData.speciality,
                    address: docData.address
                },
                amount: docData.fees ?? 0,
                date: Math.floor(Date.now() / 1000)
            }
        })

        // Update doctor slots
        await prisma.doctor.update({
            where: { id: docId },
            data: { slots_booked }
        })

        return { success: true, message: "Appointment Booked" }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function listAppointments() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }

        const appointments = await prisma.appointment.findMany({
            where: { userId: decoded.id },
            include: { doctor: { select: { name: true, image: true, speciality: true, address: true } } }
        })

        return { success: true, appointments }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

export async function cancelAppointment(appointmentId: string) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }

        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
        if (appointment?.userId !== decoded.id) return { success: false, message: "Unauthorized" }

        const { docId, slotDate, slotTime } = appointment

        await prisma.appointment.update({
            where: { id: appointmentId },
            data: { cancelled: true }
        })

        // Release the slot
        const doctor = await prisma.doctor.findUnique({ where: { id: docId } })
        if (doctor) {
            let slots_booked = doctor.slots_booked as any
            slots_booked[slotDate] = slots_booked[slotDate].filter((time: string) => time !== slotTime)
            await prisma.doctor.update({
                where: { id: docId },
                data: { slots_booked }
            })
        }

        return { success: true, message: "Appointment Cancelled" }
    } catch (error: any) {
        console.error(error)
        return { success: false, message: error.message }
    }
}

