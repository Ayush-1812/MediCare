'use client'

import React, { useEffect, useState } from 'react'
import { doctorProfile, updateDoctorProfile } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'

const Profile = () => {
    const [profileData, setProfileData] = useState<any>(null)
    const [isEdit, setIsEdit] = useState(false)

    const getProfileData = async () => {
        const res = await doctorProfile()
        if (res.success) {
            setProfileData(res.profileData)
        } else {
            toast.error(res.message)
        }
    }

    const handleUpdate = async () => {
        try {
            const formData = new FormData()
            formData.append('speciality', profileData.speciality || '')
            formData.append('degree', profileData.degree || '')
            formData.append('experience', profileData.experience || '')
            formData.append('about', profileData.about || '')
            formData.append('fees', profileData.fees || '0')
            formData.append('address', JSON.stringify(profileData.address || { line1: '', line2: '' }))
            formData.append('available', (profileData.available || false).toString())

            const res = await updateDoctorProfile(formData)
            if (res.success) {
                toast.success(res.message)
                setIsEdit(false)
                getProfileData()
            } else {
                toast.error(res.message)
            }
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        getProfileData()
    }, [])

    if (!profileData) return <div>Loading...</div>

    return (
        <div>
            <div className='flex flex-col gap-4 m-5'>
                <div>
                    <img className='bg-primary/80 w-full sm:max-w-64 rounded-lg' src={profileData.image || "/assets/profile_pic.png"} alt="" />
                </div>

                <div className='flex-1 border border-stone-100 rounded-lg p-8 py-7 bg-white'>
                    {/* ----- Doc Info : name, degree, experience ----- */}
                    <p className='flex items-center gap-2 text-3xl font-medium text-gray-700'>{profileData.name}</p>
                    <div className='flex items-center gap-2 mt-1 text-gray-600'>
                        <p>
                            {isEdit ? <input type='text' onChange={(e) => setProfileData((prev: any) => ({ ...prev, degree: e.target.value }))} value={profileData.degree || ''} placeholder='Degree' /> : (profileData.degree || 'Add Degree')}
                            -
                            {isEdit ? <input type='text' onChange={(e) => setProfileData((prev: any) => ({ ...prev, speciality: e.target.value }))} value={profileData.speciality || ''} placeholder='Speciality' /> : (profileData.speciality || 'Add Speciality')}
                        </p>
                        <button className='py-0.5 px-2 border text-xs rounded-full'>
                            {isEdit ? (
                                <select onChange={(e) => setProfileData((prev: any) => ({ ...prev, experience: e.target.value }))} value={profileData.experience || ''}>
                                    <option value="1 Year">1 Year</option>
                                    <option value="2 Years">2 Years</option>
                                    <option value="3 Years">3 Years</option>
                                    <option value="4 Years">4 Years</option>
                                    <option value="5+ Years">5+ Years</option>
                                </select>
                            ) : (profileData.experience || 'Add Experience')}
                        </button>
                    </div>

                    {/* ----- Doc About ----- */}
                    <div>
                        <p className='flex items-center gap-1 text-sm font-medium text-gray-800 mt-3'>About:</p>
                        <p className='text-sm text-gray-600 max-w-[700px] mt-1'>
                            {isEdit ? <textarea className='w-full border p-2' onChange={(e) => setProfileData((prev: any) => ({ ...prev, about: e.target.value }))} value={profileData.about || ''} placeholder='About me' /> : (profileData.about || 'Add background info')}
                        </p>
                    </div>

                    <p className='text-gray-600 font-medium mt-4'>
                        Appointment fee: <span className='text-gray-800'>$ {isEdit ? <input type='number' onChange={(e) => setProfileData((prev: any) => ({ ...prev, fees: e.target.value }))} value={profileData.fees || 0} /> : (profileData.fees || 0)}</span>
                    </p>

                    <div className='flex gap-2 py-2'>
                        <p>Address:</p>
                        <p className='text-sm'>
                            {isEdit ? <input type='text' onChange={(e) => setProfileData((prev: any) => ({ ...prev, address: { ...(prev.address || {}), line1: e.target.value } }))} value={profileData.address?.line1 || ''} /> : (profileData.address?.line1 || 'Add Line 1')}
                            <br />
                            {isEdit ? <input type='text' onChange={(e) => setProfileData((prev: any) => ({ ...prev, address: { ...(prev.address || {}), line2: e.target.value } }))} value={profileData.address?.line2 || ''} /> : (profileData.address?.line2 || 'Add Line 2')}
                        </p>
                    </div>

                    <div className='flex gap-1 pt-2'>
                        <input onChange={() => isEdit && setProfileData((prev: any) => ({ ...prev, available: !prev.available }))} checked={profileData.available || false} type="checkbox" name="" id="" />
                        <label htmlFor="">Available</label>
                    </div>

                    {isEdit ? (
                        <button onClick={handleUpdate} className='px-4 py-1 border border-primary text-sm rounded-full mt-5 hover:bg-primary hover:text-white transition-all'>Save</button>
                    ) : (
                        <button onClick={() => setIsEdit(true)} className='px-4 py-1 border border-primary text-sm rounded-full mt-5 hover:bg-primary hover:text-white transition-all'>Edit</button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Profile
