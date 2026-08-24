'use client'

/**
 * Loads Razorpay's checkout.js once per page load and opens the payment popup.
 *
 * Razorpay ships no npm package for the browser — checkout.js is a script tag that
 * attaches `window.Razorpay`. A fresh `<script>` per checkout both re-downloads the
 * library and risks a duplicate tag if the button is pressed twice, so the load is
 * cached the same way as the video-call page's Jitsi script.
 */

type RazorpayOptions = {
    key: string
    amount: number
    currency: string
    order_id: string
    name: string
    description?: string
    prefill?: { name?: string; email?: string; contact?: string }
    theme?: { color?: string }
    handler: (response: {
        razorpay_order_id: string
        razorpay_payment_id: string
        razorpay_signature: string
    }) => void
    modal?: { ondismiss?: () => void }
}

type RazorpayInstance = { open: () => void }
type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance

function razorpayGlobal(): RazorpayConstructor | undefined {
    return (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay
}

let scriptPromise: Promise<RazorpayConstructor> | null = null

function loadRazorpay(): Promise<RazorpayConstructor> {
    if (typeof window === 'undefined') return Promise.reject(new Error('Not in a browser'))

    const existing = razorpayGlobal()
    if (existing) return Promise.resolve(existing)
    if (scriptPromise) return scriptPromise

    scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.async = true
        script.onload = () => {
            const api = razorpayGlobal()
            if (api) resolve(api)
            else reject(new Error('Razorpay checkout loaded but did not initialise.'))
        }
        script.onerror = () => {
            scriptPromise = null // Let the next attempt retry instead of caching the rejection forever.
            reject(new Error('Could not reach Razorpay. Check your connection or any ad blocker.'))
        }
        document.body.appendChild(script)
    })

    return scriptPromise
}

export type OpenCheckoutArgs = {
    keyId: string
    orderId: string
    amount: number
    currency: string
    patientName?: string
    patientEmail?: string
    patientPhone?: string
    onSuccess: (response: {
        razorpay_order_id: string
        razorpay_payment_id: string
        razorpay_signature: string
    }) => void
    onDismiss?: () => void
}

export async function openRazorpayCheckout(args: OpenCheckoutArgs): Promise<void> {
    const Razorpay = await loadRazorpay()

    const instance = new Razorpay({
        key: args.keyId,
        amount: args.amount,
        currency: args.currency,
        order_id: args.orderId,
        name: 'MediCare',
        description: 'Consultation fee',
        prefill: {
            name: args.patientName,
            email: args.patientEmail,
            contact: args.patientPhone,
        },
        theme: { color: '#2563eb' },
        handler: args.onSuccess,
        modal: { ondismiss: args.onDismiss },
    })

    instance.open()
}
