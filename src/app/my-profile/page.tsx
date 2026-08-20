'use client'

import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '@/context/AppContext'
import { getProfile, updateProfile } from '@/app/actions/userActions'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import { Mail, Phone, MapPin, FileText, ChevronRight, Bot } from 'lucide-react'
import { avatarFor } from '@/lib/avatar'
import ProfileDetailsCard from '@/components/ProfileDetailsCard'
import { formatAddress, formatPhone } from '@/lib/profile'

const MyProfile = () => {
    const { token, userData, setUserData } = useContext(AppContext)
    const router = useRouter()
    const [isEdit, setIsEdit] = useState(false)
    const [image, setImage] = useState<File | null>(null)
    const [saving, setSaving] = useState(false)

    const loadProfileData = async () => {
        const res = await getProfile()
        if (res.success) {
            setUserData(res.userData)
        }
    }

    /**
     * Only name and photo are edited here. Everything else (gender, birthday, phone,
     * address, health details) lives in the "Complete your profile" form so there is a
     * single writer per field — two editors for the same value is how the gender select
     * ended up silently saving stale data.
     */
    const saveIdentity = async () => {
        if (saving) return

        const formData = new FormData()
        formData.append('name', userData.name ?? '')
        // Resent unchanged so the action's existing validation still sees them.
        formData.append('phone', userData.phone ?? '')
        formData.append('address', JSON.stringify(userData.address ?? { line1: '', line2: '' }))
        formData.append('gender', userData.gender ?? '')
        formData.append('dob', userData.dob ?? '')
        if (image) formData.append('image', image)

        setSaving(true)
        let res
        try {
            res = await updateProfile(formData)
        } finally {
            setSaving(false)
        }

        if (!res.success) {
            toast.error(res.message)
            return
        }

        toast.success(res.message)
        await loadProfileData()
        setIsEdit(false)
        setImage(null)
    }

    useEffect(() => {
        if (token) {
            loadProfileData()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])

    if (!userData) {
        return (
            <div className='min-h-[60vh] flex items-center justify-center font-medium text-blue-600'>
                Loading Profile Data...
            </div>
        )
    }

    return (
        <div className='min-h-screen bg-blue-50/40 pb-20'>
            <div className='h-40 bg-gradient-to-r from-blue-600 to-blue-800 relative overflow-hidden'>
                <div
                    className='absolute inset-0 z-0 opacity-20 bg-cover bg-center mix-blend-overlay'
                    style={{ backgroundImage: "url('/assets/header_img.png')" }}
                />
            </div>

            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10'>
                <div className='flex flex-col lg:flex-row gap-8'>

                    {/* ── Left column ─────────────────────────────────────── */}
                    <div className='w-full lg:w-1/3 flex flex-col gap-6'>

                        <div className='bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm flex flex-col items-center text-center relative pt-12'>
                            <div className='absolute -top-16'>
                                <label htmlFor='image'>
                                    <div className={`relative w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-blue-50 flex items-center justify-center ${isEdit ? 'cursor-pointer group' : ''}`}>
                                        <img
                                            className={`w-full h-full object-cover transition-opacity ${isEdit ? 'group-hover:opacity-50' : ''}`}
                                            src={image ? URL.createObjectURL(image) : avatarFor(userData.image, userData.gender)}
                                            alt='Profile'
                                        />
                                        {isEdit && (
                                            <div className='absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40'>
                                                <img src='/assets/upload_icon.png' className='w-8 h-8 mb-1' alt='' />
                                                <span className='text-white text-xs font-bold'>Upload</span>
                                            </div>
                                        )}
                                    </div>
                                    <input disabled={!isEdit} onChange={(e) => setImage(e.target.files?.[0] || null)} type='file' id='image' hidden accept='image/*' />
                                </label>
                            </div>

                            <div className='mt-8 w-full'>
                                {isEdit ? (
                                    <input
                                        className='w-full text-center bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-2xl font-bold text-gray-900 rounded-xl px-4 py-2 transition-all outline-none'
                                        type='text'
                                        value={userData.name}
                                        onChange={(e) => setUserData((prev: any) => ({ ...prev, name: e.target.value }))}
                                        placeholder='Full Name'
                                    />
                                ) : (
                                    <h2 className='text-2xl font-bold text-gray-900'>{userData.name}</h2>
                                )}

                                <div className='mt-3 flex items-center justify-center gap-2'>
                                    <span className='px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200'>
                                        Patient
                                    </span>
                                </div>
                            </div>

                            <div className='w-full border-t border-gray-100 mt-6 pt-6'>
                                {isEdit ? (
                                    <div className='flex gap-2'>
                                        <button
                                            className='flex-1 bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl hover:bg-blue-700 hover:shadow-md transition-all shadow-sm'
                                            onClick={saveIdentity}
                                            disabled={saving}
                                        >
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            className='px-4 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors'
                                            onClick={() => { setIsEdit(false); setImage(null); loadProfileData() }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className='w-full bg-white border border-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all shadow-sm'
                                        onClick={() => setIsEdit(true)}
                                    >
                                        Edit name &amp; photo
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Contact — read-only; edited through "Complete your profile" */}
                        <div className='bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm'>
                            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2'>
                                <Mail className='w-4 h-4 text-blue-600' /> Contact
                            </h3>

                            <div className='flex flex-col gap-5'>
                                <div className='flex gap-4'>
                                    <div className='w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0'>
                                        <Mail className='w-5 h-5 text-blue-600' />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-xs text-gray-500 font-medium mb-1'>Email Address</p>
                                        <p className='text-sm font-medium text-gray-900 break-words'>{userData.email}</p>
                                    </div>
                                </div>

                                <div className='flex gap-4'>
                                    <div className='w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0'>
                                        <Phone className='w-5 h-5 text-blue-600' />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-xs text-gray-500 font-medium mb-1'>Phone Number</p>
                                        <p className='text-sm font-medium text-gray-900'>{formatPhone(userData.phone)}</p>
                                    </div>
                                </div>

                                <div className='flex gap-4'>
                                    <div className='w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0'>
                                        <MapPin className='w-5 h-5 text-blue-600' />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-xs text-gray-500 font-medium mb-1'>Address</p>
                                        <p className='text-sm font-medium text-gray-900 leading-relaxed'>
                                            {formatAddress(userData.address)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Right column ────────────────────────────────────── */}
                    <div className='w-full lg:w-2/3 flex flex-col gap-6 mt-8 lg:mt-0'>

                        {/* Real values only, entered by the patient */}
                        <ProfileDetailsCard profile={userData} onSaved={loadProfileData} />

                        <div className='bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm mt-2'>
                            <div className='flex justify-between items-center mb-5'>
                                <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
                                    <FileText className='w-4 h-4 text-blue-600' /> Digital Health Records
                                </h3>
                            </div>

                            <button
                                onClick={() => router.push('/my-profile/prescriptions')}
                                className='w-full relative overflow-hidden group bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 hover:shadow-md transition-all duration-300 text-left flex items-center gap-4'
                            >
                                <div className='w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform'>
                                    <FileText className='w-6 h-6 text-blue-600' />
                                </div>
                                <div className='flex-1'>
                                    <p className='text-lg font-bold text-gray-900 mb-1'>My Prescriptions</p>
                                    <p className='text-sm text-gray-500'>Scan &amp; manage handwritten notes using AI</p>
                                </div>
                                <div className='w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors'>
                                    <ChevronRight className='w-5 h-5' />
                                </div>
                            </button>
                        </div>

                        <div className='bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm'>
                            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2'>
                                <Bot className='w-4 h-4 text-blue-600' /> AI Health Assistant
                            </h3>

                            <div className='bg-gray-50 rounded-2xl p-5 border border-gray-100'>
                                <div className='flex gap-4'>
                                    <div className='w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1'>
                                        <Bot className='w-5 h-5 text-white' />
                                    </div>
                                    <div className='bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-4 shadow-sm text-sm text-gray-700 leading-relaxed'>
                                        <p className='mb-2'>
                                            <span className='font-bold text-gray-900'>Hi {String(userData.name ?? '').split(' ')[0]},</span>{' '}
                                            ask Aether AI about your appointments, prescriptions or symptoms.
                                        </p>
                                        <p>It reads your own records — nothing here is a diagnosis, so check anything important with your doctor.</p>
                                    </div>
                                </div>

                                <div className='flex gap-3 mt-4 ml-14'>
                                    <button onClick={() => router.push('/ai-assistant')} className='bg-blue-50 text-blue-600 border border-blue-100 px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors'>
                                        Open Aether AI
                                    </button>
                                    <button onClick={() => router.push('/doctors')} className='bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-50 transition-colors'>
                                        Find a Doctor
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}

export default MyProfile
