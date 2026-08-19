'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import DoctorsDirectory from '@/components/DoctorsDirectory'

const DoctorsBySpeciality = () => {
    const { speciality } = useParams<{ speciality: string }>()
    return <DoctorsDirectory speciality={decodeURIComponent(speciality)} />
}

export default DoctorsBySpeciality
