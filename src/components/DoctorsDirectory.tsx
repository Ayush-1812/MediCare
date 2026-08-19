'use client'

import React, { useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppContext } from '@/context/AppContext'
import { specialityData } from '@/lib/constants'
import DoctorCard from './DoctorCard'
import { Search } from 'lucide-react'

/**
 * Shared by `/doctors` and `/doctors/[speciality]` — the two pages were byte-for-byte
 * copies of each other, so a fix to one silently missed the other.
 */
const DoctorsDirectory = ({ speciality }: { speciality?: string }) => {
    const router = useRouter()
    const { doctors } = useContext(AppContext)
    const [showFilter, setShowFilter] = useState(false)
    const [query, setQuery] = useState('')

    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase()
        return (doctors as any[]).filter((doc) => {
            if (speciality && doc.speciality !== speciality) return false
            if (!term) return true
            // Searchable across the fields a patient would actually type.
            return [doc.name, doc.speciality, doc.degree, doc.hospital, doc.city, doc.languages]
                .filter(Boolean)
                .some((field: string) => field.toLowerCase().includes(term))
        })
    }, [doctors, speciality, query])

    return (
        <div>
            <p className='text-gray-600'>Browse through the doctors specialist.</p>

            <div className='mt-4 relative max-w-md'>
                <Search className='absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-gray-400' />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='Search by name, hospital, city or language'
                    className='w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'
                />
            </div>

            <div className='flex flex-col sm:flex-row items-start gap-5 mt-5'>
                <button
                    onClick={() => setShowFilter(!showFilter)}
                    className={`py-1 px-3 border rounded text-sm transition-all sm:hidden ${showFilter ? 'bg-primary text-white' : ''}`}
                >
                    Filters
                </button>

                <div className={`flex-col gap-4 text-sm text-gray-600 ${showFilter ? 'flex' : 'hidden sm:flex'}`}>
                    {specialityData.map((item) => (
                        <p
                            key={item.speciality}
                            onClick={() =>
                                speciality === item.speciality
                                    ? router.push('/doctors')
                                    : router.push(`/doctors/${encodeURIComponent(item.speciality)}`)
                            }
                            className={`w-[94vw] sm:w-auto pl-3 py-1.5 pr-16 border border-gray-300 rounded transition-all cursor-pointer ${speciality === item.speciality ? 'bg-indigo-100 text-black' : ''}`}
                        >
                            {item.speciality}
                        </p>
                    ))}
                </div>

                <div className='w-full'>
                    {filtered.length === 0 ? (
                        <p className='text-gray-500 text-sm py-16 text-center border border-dashed border-gray-200 rounded-xl'>
                            No doctors match this search yet.
                        </p>
                    ) : (
                        <div
                            className='w-full grid gap-4 gap-y-6'
                            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
                        >
                            {filtered.map((item) => (
                                <DoctorCard key={item.id} doctor={item} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default DoctorsDirectory
