'use server'

import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { normalizeMedicineData } from '@/lib/ocrService'
import { revalidatePath } from 'next/cache'

export async function processPrescriptionText(rawText: string) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value
        if (!token) return { success: false, message: "Not authorized" }

        // Normalization
        const medicines = normalizeMedicineData(rawText)

        return { success: true, medicines }
    } catch (error: any) {
        console.error("Processing Error:", error)
        return { success: false, message: "Failed to process prescription text." }
    }
}

export async function savePrescription(data: {
    imageUrl: string
    medicines: any
    extractedData?: any
}) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }

        await prisma.prescription.create({
            data: {
                userId: decoded.id,
                imageUrl: data.imageUrl,
                medicines: data.medicines,
                extractedData: data.extractedData || {},
                isVerified: true
            }
        })

        revalidatePath('/my-profile/prescriptions')
        return { success: true, message: "Prescription saved successfully" }
    } catch (error: any) {
        console.error("Save Prescription Error:", error)
        return { success: false, message: error.message }
    }
}

export async function getPrescriptions() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value
        if (!token) return { success: false, message: "Not authorized" }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }

        const prescriptions = await prisma.prescription.findMany({
            where: { userId: decoded.id },
            orderBy: { createdAt: 'desc' }
        })

        // Serialize/Cast JSON fields
        const safePrescriptions = prescriptions.map((p: any) => ({
            ...p,
            medicines: p.medicines as any[],
            extractedData: p.extractedData as any
        }))

        return { success: true, prescriptions: safePrescriptions }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
