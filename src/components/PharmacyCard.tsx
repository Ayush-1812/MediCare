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
    }
}

const PharmacyCard: React.FC<PharmacyCardProps> = ({ pharmacy }) => {
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
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-gray-900 truncate">{pharmacy.name}</h3>
                    {/* {pharmacy.rating && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            {pharmacy.rating} ★ <span className='text-gray-500'>({pharmacy.reviews})</span>
                        </span>
                    )} */}
                    {pharmacy.rating !== null && pharmacy.rating !== undefined && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            {pharmacy.rating} ★
                            {pharmacy.reviews && (
                                <span className="text-gray-500">({pharmacy.reviews})</span>
                            )}
                        </span>
                    )}

                </div>
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
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pharmacy.name + ' ' + pharmacy.address)}`}
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
