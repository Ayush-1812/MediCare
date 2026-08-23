import React from 'react'

interface PharmacyCardProps {
    pharmacy: {
        name: string
        address: string
        rating?: number
        reviews?: number
        open_state?: string
        phone?: string
        thumbnail?: string
        placeId?: string | null
        lat?: number | null
        lng?: number | null
        distanceKm?: number | null
    }
}

const PharmacyCard: React.FC<PharmacyCardProps> = ({ pharmacy }) => {
    // Precise coordinates route to the exact pharmacy; a place id pins it further still.
    // Falling back to a name+address text search only when neither is available — that
    // fuzzy match is what used to send patients to the wrong nearby location entirely.
    const directionsUrl =
        pharmacy.lat != null && pharmacy.lng != null
            ? `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}` +
              (pharmacy.placeId ? `&destination_place_id=${encodeURIComponent(pharmacy.placeId)}` : '')
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pharmacy.name + ' ' + pharmacy.address)}`

    return (
        <div className="border border-blue-200 rounded-xl overflow-hidden hover:translate-y-[-5px] transition-all duration-300 bg-white shadow-sm hover:shadow-md">
            {pharmacy.thumbnail && (
                <img
                    src={pharmacy.thumbnail}
                    alt={pharmacy.name}
                    className="w-full h-32 object-cover bg-blue-50"
                />
            )}
            <div className="p-4">
                <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-medium text-gray-900 truncate">{pharmacy.name}</h3>
                    {pharmacy.distanceKm != null && (
                        <span className="shrink-0 bg-blue-50 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                            {pharmacy.distanceKm < 1
                                ? `${Math.round(pharmacy.distanceKm * 1000)} m`
                                : `${pharmacy.distanceKm} km`}
                        </span>
                    )}
                </div>

                {pharmacy.rating !== null && pharmacy.rating !== undefined && (
                    <span className="inline-flex bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full items-center gap-1 mt-1.5">
                        {pharmacy.rating} ★
                        {pharmacy.reviews && (
                            <span className="text-gray-500">({pharmacy.reviews})</span>
                        )}
                    </span>
                )}

                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{pharmacy.address}</p>

                <div className="mt-3 flex flex-col gap-1 text-sm">
                    {pharmacy.open_state && (
                        <p className={`font-medium ${pharmacy.open_state.toLowerCase().includes('open') ? 'text-green-600' : 'text-red-500'}`}>
                            {pharmacy.open_state}
                        </p>
                    )}
                    {pharmacy.phone && (
                        <p className="text-gray-500">📞 {pharmacy.phone}</p>
                    )}
                </div>

                <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full mt-4 text-center bg-blue-50 text-primary py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                    Get Directions
                </a>
            </div>
        </div>
    )
}

export default PharmacyCard
