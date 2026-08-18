'use client'

import React, { useContext, useEffect, useState } from 'react'
import { doctorProfile, updateDoctorProfile } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'
import { AppContext } from '@/context/AppContext'
import { MapPin, Briefcase, GraduationCap, DollarSign, FileText, ToggleLeft, ToggleRight } from 'lucide-react'

const Profile = () => {
    const context = useContext(AppContext)
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
                context?.getDoctorProfileData?.()
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

    if (!profileData) {
        return (
            <div className='flex items-center justify-center min-h-[60vh]'>
                <div className='flex items-center gap-2 text-primary font-medium'>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce'></span>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce' style={{ animationDelay: '0.15s' }}></span>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce' style={{ animationDelay: '0.3s' }}></span>
                </div>
            </div>
        )
    }

    return (
        <div className='max-w-5xl'>
            <div className='flex flex-col lg:flex-row gap-6'>
                {/* Left: Avatar & Status */}
                <div className='w-full lg:w-1/3'>
                    <div className='bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center'>
                        <img className='w-32 h-32 rounded-full object-cover bg-blue-50 ring-4 ring-blue-50 shadow-sm' src={profileData.image || "/assets/profile_pic.png"} alt="" />
                        <h2 className='text-xl font-bold text-gray-900 mt-4'>Dr. {profileData.name}</h2>
                        <p className='text-sm text-gray-500'>{profileData.speciality || 'Add Speciality'}</p>

                        <div className='w-full border-t border-gray-100 mt-5 pt-5'>
                            <button
                                type='button'
                                disabled={!isEdit}
                                onClick={() => isEdit && setProfileData((prev: any) => ({ ...prev, available: !prev.available }))}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${profileData.available ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'} ${isEdit ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                <span className={`text-sm font-semibold ${profileData.available ? 'text-emerald-700' : 'text-gray-500'}`}>
                                    {profileData.available ? 'Available for bookings' : 'Not accepting bookings'}
                                </span>
                                {profileData.available ? <ToggleRight className='w-8 h-8 text-emerald-500' /> : <ToggleLeft className='w-8 h-8 text-gray-400' />}
                            </button>
                        </div>

                        <div className='w-full mt-4'>
                            {isEdit ? (
                                <button onClick={handleUpdate} className='w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 hover:shadow-md transition-all shadow-sm'>
                                    Save Changes
                                </button>
                            ) : (
                                <button onClick={() => setIsEdit(true)} className='w-full bg-white border border-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all shadow-sm'>
                                    Edit Profile
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Details */}
                <div className='w-full lg:w-2/3 flex flex-col gap-6'>
                    <div className='bg-white border border-gray-100 rounded-3xl p-6 shadow-sm'>
                        <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2'>
                            <Briefcase className='w-4 h-4 text-blue-600' /> Professional Details
                        </h3>

                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                            <div>
                                <label className='text-xs text-gray-500 font-medium mb-1.5 flex items-center gap-1.5'><GraduationCap className='w-3.5 h-3.5' /> Degree</label>
                                {isEdit ? (
                                    <input className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-2 outline-none' type='text' value={profileData.degree || ''} onChange={(e) => setProfileData((prev: any) => ({ ...prev, degree: e.target.value }))} placeholder='Degree' />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.degree || 'Not set'}</p>
                                )}
                            </div>

                            <div>
                                <label className='text-xs text-gray-500 font-medium mb-1.5 block'>Speciality</label>
                                {isEdit ? (
                                    <input className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-2 outline-none' type='text' value={profileData.speciality || ''} onChange={(e) => setProfileData((prev: any) => ({ ...prev, speciality: e.target.value }))} placeholder='Speciality' />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.speciality || 'Not set'}</p>
                                )}
                            </div>

                            <div>
                                <label className='text-xs text-gray-500 font-medium mb-1.5 block'>Experience</label>
                                {isEdit ? (
                                    <select className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-2 outline-none appearance-none' value={profileData.experience || ''} onChange={(e) => setProfileData((prev: any) => ({ ...prev, experience: e.target.value }))}>
                                        <option value="1 Year">1 Year</option>
                                        <option value="2 Years">2 Years</option>
                                        <option value="3 Years">3 Years</option>
                                        <option value="4 Years">4 Years</option>
                                        <option value="5+ Years">5+ Years</option>
                                    </select>
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.experience || 'Not set'}</p>
                                )}
                            </div>

                            <div>
                                <label className='text-xs text-gray-500 font-medium mb-1.5 flex items-center gap-1.5'><DollarSign className='w-3.5 h-3.5' /> Appointment Fee</label>
                                {isEdit ? (
                                    <input className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-2 outline-none' type='number' value={profileData.fees || 0} onChange={(e) => setProfileData((prev: any) => ({ ...prev, fees: e.target.value }))} />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>${profileData.fees || 0}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className='bg-white border border-gray-100 rounded-3xl p-6 shadow-sm'>
                        <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2'>
                            <FileText className='w-4 h-4 text-blue-600' /> About
                        </h3>
                        {isEdit ? (
                            <textarea className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-800 rounded-xl px-4 py-3 outline-none min-h-28' value={profileData.about || ''} onChange={(e) => setProfileData((prev: any) => ({ ...prev, about: e.target.value }))} placeholder='Tell patients about your background...' />
                        ) : (
                            <p className='text-sm text-gray-600 leading-relaxed'>{profileData.about || 'No bio added yet.'}</p>
                        )}
                    </div>

                    <div className='bg-white border border-gray-100 rounded-3xl p-6 shadow-sm'>
                        <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2'>
                            <MapPin className='w-4 h-4 text-blue-600' /> Clinic Address
                        </h3>
                        {isEdit ? (
                            <div className='flex flex-col gap-3'>
                                <input className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-2 outline-none' type='text' placeholder='Line 1' value={profileData.address?.line1 || ''} onChange={(e) => setProfileData((prev: any) => ({ ...prev, address: { ...(prev.address || {}), line1: e.target.value } }))} />
                                <input className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-2 outline-none' type='text' placeholder='Line 2' value={profileData.address?.line2 || ''} onChange={(e) => setProfileData((prev: any) => ({ ...prev, address: { ...(prev.address || {}), line2: e.target.value } }))} />
                            </div>
                        ) : (
                            <p className='text-sm font-medium text-gray-900 leading-relaxed'>
                                {profileData.address?.line1 || profileData.address?.line2 ? (
                                    <span>{profileData.address?.line1}<br />{profileData.address?.line2}</span>
                                ) : 'Not provided'}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Profile
