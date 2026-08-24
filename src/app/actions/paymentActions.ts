'use server'

import crypto from 'crypto'
import Razorpay from 'razorpay'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSessionId } from '@/lib/auth'

/**
 * Online payment for the doctor's consultation fee, via Razorpay.
 *
 * The flow is: this action creates a Razorpay Order for an existing appointment, the
 * client opens Razorpay's own checkout with that order, and Razorpay calls back with a
 * payment id and an HMAC signature. `verifyPayment` below recomputes that signature from
 * Razorpay's secret and only marks the appointment paid if it matches — the client-side
 * "success" callback is not itself trusted, since a forged one would let anyone mark any
 * appointment as paid for free.
 */

function fail(message: string) {
    return { success: false as const, message }
}

function unexpected(scope: string, error: unknown) {
    console.error(`[${scope}]`, error)
    return fail('Something went wrong. Please try again.')
}

function razorpayCredentials() {
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) return null
    return { keyId, keySecret }
}

export async function createPaymentOrder(appointmentId: string) {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
        if (!appointment || appointment.userId !== userId) return fail('Appointment not found')
        if (appointment.cancelled) return fail('This appointment was cancelled')
        if (appointment.isCompleted) return fail('This consultation has already been completed')
        if (appointment.payment) return fail('This appointment has already been paid for')
        if (appointment.amount <= 0) return fail('There is no fee to pay for this appointment')

        const credentials = razorpayCredentials()
        if (!credentials) {
            // Online payment is optional — the clinic still accepts cash. A missing key
            // must degrade to that, not break the booking flow.
            return fail('Online payment is not available right now. Please pay at the clinic instead.')
        }

        const razorpay = new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret })

        // `receipt` is capped at 40 characters by Razorpay; a cuid appointment id fits.
        const order = await razorpay.orders.create({
            amount: appointment.amount * 100, // Razorpay works in the smallest currency unit (paise).
            currency: 'INR',
            receipt: appointment.id,
            notes: { appointmentId: appointment.id, userId },
        })

        return {
            success: true as const,
            orderId: order.id,
            // Razorpay's SDK types this as `string | number` depending on API version —
            // the checkout widget needs a real number, so it is coerced once here rather
            // than leaking the ambiguity into every caller.
            amount: Number(order.amount),
            currency: order.currency,
            keyId: credentials.keyId,
        }
    } catch (error) {
        return unexpected('createPaymentOrder', error)
    }
}

export async function verifyPayment(
    appointmentId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
) {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
        if (!appointment || appointment.userId !== userId) return fail('Appointment not found')
        if (appointment.payment) return { success: true as const, message: 'Payment already recorded' }

        const credentials = razorpayCredentials()
        if (!credentials) return fail('Payment verification is not available right now')

        // Razorpay's documented signature scheme: HMAC-SHA256 of "order_id|payment_id",
        // keyed with the account's secret. This is the only server-side proof that the
        // payment Razorpay is reporting actually belongs to this order and was not typed
        // in by hand.
        const expectedSignature = crypto
            .createHmac('sha256', credentials.keySecret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex')

        if (expectedSignature !== razorpaySignature) {
            console.error(`[verifyPayment] signature mismatch for appointment ${appointmentId}`)
            return fail('Payment verification failed. If your card was charged, contact support.')
        }

        await prisma.appointment.update({
            where: { id: appointmentId },
            data: { payment: true },
        })

        revalidatePath('/my-appointments')
        revalidatePath('/doctor-dashboard/appointments')
        revalidatePath('/doctor-dashboard/dashboard')

        return { success: true as const, message: 'Payment successful' }
    } catch (error) {
        return unexpected('verifyPayment', error)
    }
}
