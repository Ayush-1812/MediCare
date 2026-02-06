'use client'

import React, { useState } from 'react'
import PharmacyCard from '@/components/PharmacyCard'
import { toast } from 'react-toastify'

const Pharmacies = () => {
    const [pharmacies, setPharmacies] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [locationError, setLocationError] = useState<string | null>(null)

    const fetchPharmacies = async (lat: number, lng: number) => {
        setLoading(true)

        try {
            const response = await fetch(
                `/api/nearby-pharmacies?lat=${lat}&lng=${lng}`
            )

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`API failed: ${response.status} ${text}`)
            }

            const data = await response.json()

            if (Array.isArray(data.pharmacies)) {
                setPharmacies(data.pharmacies)
            } else {
                throw new Error(data.error || 'Invalid API response')
            }
        } catch (error: any) {
            console.error('Fetch pharmacies error:', error)
            toast.error('Failed to fetch nearby pharmacies')
            setPharmacies([])
        } finally {
            setLoading(false)
        }
    }

    const handleGetLocation = () => {
        setLocationError(null)
        setLoading(true)

        if (!navigator.geolocation) {
            const msg = 'Geolocation is not supported by your browser'
            setLocationError(msg)
            toast.error(msg)
            setLoading(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                fetchPharmacies(latitude, longitude)
            },
            (error) => {
                setLoading(false)

                let errorMsg = 'Unable to retrieve your location'
                if (error.code === error.PERMISSION_DENIED) {
                    errorMsg = 'Location permission denied. Please enable location access.'
                }

                setLocationError(errorMsg)
                toast.error(errorMsg)
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
            }
        )
    }

    return (
        <div className="mx-4 sm:mx-[10%] my-10">
            <h1 className="text-3xl font-medium text-gray-900 mb-4">
                Nearby Pharmacies
            </h1>
            <p className="text-gray-600 mb-8">
                Find trusted pharmacies near your location instantly.
            </p>

            {pharmacies.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 bg-gray-50">
                    <p className="text-gray-600 mb-4 text-center">
                        {locationError ||
                            'Allow location access to see pharmacies near you.'}
                    </p>
                    <button
                        onClick={handleGetLocation}
                        className="bg-primary text-white px-8 py-3 rounded-full hover:bg-blue-600 transition-all font-medium"
                    >
                        Find Nearby Pharmacies
                    </button>
                    {locationError && (
                        <p className="text-sm text-red-500 mt-2">
                            Note: Please check your browser&apos;s site settings if the prompt
                            doesn&apos;t appear.
                        </p>
                    )}
                </div>
            )}

            {loading && (
                <div
                    className="grid gap-4 gap-y-6 pt-5"
                    style={{
                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    }}
                >
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="border rounded-xl h-64 bg-gray-100 animate-pulse"
                        />
                    ))}
                </div>
            )}

            {!loading && pharmacies.length > 0 && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-gray-500">
                            Showing results for your current location
                        </p>
                        <button
                            onClick={handleGetLocation}
                            className="text-primary text-sm hover:underline"
                        >
                            Refresh Location
                        </button>
                    </div>

                    <div
                        className="grid gap-4 gap-y-6"
                        style={{
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        }}
                    >
                        {pharmacies.map((pharmacy, index) => (
                            <PharmacyCard key={index} pharmacy={pharmacy} />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default Pharmacies
