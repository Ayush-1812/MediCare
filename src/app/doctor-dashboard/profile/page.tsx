'use client'

import React, { useContext, useEffect, useMemo, useState } from 'react'
import { doctorProfile, updateDoctorProfile } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'
import { AppContext } from '@/context/AppContext'
import {
    MapPin,
    Briefcase,
    GraduationCap,
    IndianRupee,
    FileText,
    ToggleLeft,
    ToggleRight,
    CalendarClock,
    Building2,
    Upload,
    Check,
} from 'lucide-react'
import { avatarFor } from '@/lib/avatar'
import { formatINR } from '@/lib/currency'
import { parseAvailableDays, WEEKDAYS, type Weekday } from '@/lib/schedule'
import { specialityData } from '@/lib/constants'

const CONSULTATION_MODES = ['Video Consultation', 'In-Person'] as const

const inputClass =
    'w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-2 outline-none'
const cardClass = 'bg-white border border-gray-100 rounded-3xl p-6 shadow-sm'
const cardTitleClass = 'text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2'
const fieldLabelClass = 'text-xs text-gray-500 font-medium mb-1.5 block'

const Profile = () => {
    const context = useContext(AppContext)
    const [profileData, setProfileData] = useState<any>(null)
    const [isEdit, setIsEdit] = useState(false)
    const [image, setImage] = useState<File | null>(null)
    const [saving, setSaving] = useState(false)

    const getProfileData = async () => {
        const res = await doctorProfile()
        if (res.success) {
            setProfileData(res.profileData)
        } else {
            toast.error(res.message)
        }
    }

    useEffect(() => {
        getProfileData()
    }, [])

    const avatarSrc = useMemo(() => {
        if (image) return URL.createObjectURL(image)
        return avatarFor(profileData?.image, profileData?.gender)
    }, [image, profileData?.image, profileData?.gender])

    const set = (patch: Record<string, unknown>) =>
        setProfileData((prev: any) => ({ ...prev, ...patch }))

    const days: Weekday[] = parseAvailableDays(profileData?.availableDays)
    const modes: string[] = Array.isArray(profileData?.consultationModes)
        ? profileData.consultationModes
        : []

    const toggleDay = (day: Weekday) =>
        set({ availableDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] })

    const toggleMode = (mode: string) =>
        set({
            consultationModes: modes.includes(mode) ? modes.filter((m) => m !== mode) : [...modes, mode],
        })

    const handleUpdate = async () => {
        if (saving) return

        const formData = new FormData()
        if (image) formData.append('image', image)
        formData.append('speciality', profileData.speciality || '')
        formData.append('degree', profileData.degree || '')
        formData.append('experience', profileData.experience || '')
        formData.append('registrationNo', profileData.registrationNo || '')
        formData.append('about', profileData.about || '')
        formData.append('gender', profileData.gender || 'Not Selected')
        formData.append('phone', profileData.phone || '')
        formData.append('hospital', profileData.hospital || '')
        formData.append('city', profileData.city || '')
        formData.append('languages', profileData.languages || '')
        formData.append('awards', profileData.awards || '')
        formData.append('fees', String(profileData.fees ?? 0))
        formData.append('address', JSON.stringify(profileData.address || { line1: '', line2: '' }))
        formData.append('available', String(Boolean(profileData.available)))
        formData.append('consultationModes', modes.join(','))
        formData.append(
            'availableDays',
            [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)).join(','),
        )
        formData.append('slotStartTime', profileData.slotStartTime || '10:00')
        formData.append('slotEndTime', profileData.slotEndTime || '17:00')
        formData.append('slotDuration', String(profileData.slotDuration ?? 30))

        setSaving(true)
        let res
        try {
            res = await updateDoctorProfile(formData)
        } finally {
            setSaving(false)
        }

        if (!res.success) {
            toast.error(res.message)
            return
        }

        toast.success(res.message)
        setIsEdit(false)
        setImage(null)
        await getProfileData()
        await context?.getDoctorProfileData?.()
        await context?.getDoctorsData?.()
    }

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
                {/* ── Avatar & status ─────────────────────────────────────── */}
                <div className='w-full lg:w-1/3'>
                    <div className={`${cardClass} flex flex-col items-center text-center`}>
                        <label htmlFor='doc-photo' className={isEdit ? 'cursor-pointer group' : ''}>
                            <div className='relative w-32 h-32 rounded-full overflow-hidden bg-blue-50 ring-4 ring-blue-50 shadow-sm'>
                                <img className='w-full h-full object-cover' src={avatarSrc} alt='' />
                                {isEdit && (
                                    <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity'>
                                        <Upload className='w-6 h-6 text-white mb-1' />
                                        <span className='text-white text-xs font-bold'>Upload</span>
                                    </div>
                                )}
                            </div>
                        </label>
                        <input
                            id='doc-photo'
                            type='file'
                            hidden
                            accept='image/*'
                            disabled={!isEdit}
                            onChange={(e) => setImage(e.target.files?.[0] || null)}
                        />

                        <h2 className='text-xl font-bold text-gray-900 mt-4'>Dr. {profileData.name}</h2>
                        <p className='text-sm text-gray-500'>{profileData.speciality || 'Add Speciality'}</p>
                        <p className='text-xs text-gray-400 mt-1'>{profileData.email}</p>

                        {isEdit && (
                            <div className='w-full mt-5 text-left'>
                                <label className={fieldLabelClass}>Gender</label>
                                <select
                                    className={`${inputClass} appearance-none`}
                                    value={profileData.gender || 'Not Selected'}
                                    onChange={(e) => set({ gender: e.target.value })}
                                >
                                    <option value='Not Selected'>Prefer not to say</option>
                                    <option value='Male'>Male</option>
                                    <option value='Female'>Female</option>
                                </select>
                                <p className='text-[11px] text-gray-400 mt-1.5'>
                                    Used to pick your default avatar until you upload a photo.
                                </p>
                            </div>
                        )}

                        <div className='w-full border-t border-gray-100 mt-5 pt-5'>
                            <button
                                type='button'
                                disabled={!isEdit}
                                onClick={() => isEdit && set({ available: !profileData.available })}
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
                                <button
                                    onClick={handleUpdate}
                                    disabled={saving}
                                    className='w-full bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl hover:bg-blue-700 hover:shadow-md transition-all shadow-sm'
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsEdit(true)}
                                    className='w-full bg-white border border-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all shadow-sm'
                                >
                                    Edit Profile
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Details ─────────────────────────────────────────────── */}
                <div className='w-full lg:w-2/3 flex flex-col gap-6'>
                    <div className={cardClass}>
                        <h3 className={cardTitleClass}>
                            <Briefcase className='w-4 h-4 text-blue-600' /> Professional Details
                        </h3>

                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                            <div>
                                <label className={`${fieldLabelClass} flex items-center gap-1.5`}>
                                    <GraduationCap className='w-3.5 h-3.5' /> Qualification
                                </label>
                                {isEdit ? (
                                    <input className={inputClass} type='text' value={profileData.degree || ''} onChange={(e) => set({ degree: e.target.value })} placeholder='e.g. MBBS, MD' />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.degree || 'Not set'}</p>
                                )}
                            </div>

                            <div>
                                <label className={fieldLabelClass}>Speciality</label>
                                {isEdit ? (
                                    <select className={`${inputClass} appearance-none`} value={profileData.speciality || ''} onChange={(e) => set({ speciality: e.target.value })}>
                                        <option value=''>Select a speciality</option>
                                        {specialityData.map((item) => (
                                            <option key={item.speciality} value={item.speciality}>{item.speciality}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.speciality || 'Not set'}</p>
                                )}
                            </div>

                            <div>
                                <label className={fieldLabelClass}>Experience</label>
                                {isEdit ? (
                                    <select className={`${inputClass} appearance-none`} value={profileData.experience || ''} onChange={(e) => set({ experience: e.target.value })}>
                                        <option value=''>Select experience</option>
                                        {Array.from({ length: 30 }, (_, i) => `${i + 1} Year${i === 0 ? '' : 's'}`).map((label) => (
                                            <option key={label} value={label}>{label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.experience || 'Not set'}</p>
                                )}
                            </div>

                            <div>
                                <label className={`${fieldLabelClass} flex items-center gap-1.5`}>
                                    <IndianRupee className='w-3.5 h-3.5' /> Consultation Fee
                                </label>
                                {isEdit ? (
                                    <input className={inputClass} type='number' min={0} value={profileData.fees ?? 0} onChange={(e) => set({ fees: e.target.value })} />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{formatINR(profileData.fees)}</p>
                                )}
                            </div>

                            <div>
                                <label className={fieldLabelClass}>Medical registration no.</label>
                                {isEdit ? (
                                    <input className={inputClass} type='text' value={profileData.registrationNo || ''} onChange={(e) => set({ registrationNo: e.target.value })} />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.registrationNo || 'Not set'}</p>
                                )}
                            </div>

                            <div>
                                <label className={fieldLabelClass}>Contact number</label>
                                {isEdit ? (
                                    <input className={inputClass} type='tel' value={profileData.phone || ''} onChange={(e) => set({ phone: e.target.value })} />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.phone || 'Not set'}</p>
                                )}
                            </div>

                            <div>
                                <label className={fieldLabelClass}>Languages spoken</label>
                                {isEdit ? (
                                    <input className={inputClass} type='text' value={profileData.languages || ''} onChange={(e) => set({ languages: e.target.value })} placeholder='e.g. English, Hindi' />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.languages || 'Not set'}</p>
                                )}
                            </div>

                            <div>
                                <label className={fieldLabelClass}>Awards &amp; recognition</label>
                                {isEdit ? (
                                    <input className={inputClass} type='text' value={profileData.awards || ''} onChange={(e) => set({ awards: e.target.value })} />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.awards || 'Not set'}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Consulting hours ────────────────────────────────── */}
                    <div className={cardClass}>
                        <h3 className={cardTitleClass}>
                            <CalendarClock className='w-4 h-4 text-blue-600' /> Consulting Hours
                        </h3>

                        <label className={fieldLabelClass}>Days you consult</label>
                        <div className='flex flex-wrap gap-2 mb-5'>
                            {WEEKDAYS.map((day) => {
                                const active = days.includes(day)
                                return (
                                    <button
                                        key={day}
                                        type='button'
                                        disabled={!isEdit}
                                        onClick={() => toggleDay(day)}
                                        aria-pressed={active}
                                        className={`w-14 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                                            active
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-gray-50 border-gray-200 text-gray-400'
                                        } ${isEdit ? 'cursor-pointer' : 'cursor-default'}`}
                                    >
                                        {active && <Check className='w-3 h-3' />}
                                        {day}
                                    </button>
                                )
                            })}
                        </div>

                        <div className='grid grid-cols-1 sm:grid-cols-3 gap-5'>
                            <div>
                                <label className={fieldLabelClass}>Start time</label>
                                {isEdit ? (
                                    <input className={inputClass} type='time' value={profileData.slotStartTime || '10:00'} onChange={(e) => set({ slotStartTime: e.target.value })} />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.slotStartTime}</p>
                                )}
                            </div>
                            <div>
                                <label className={fieldLabelClass}>End time</label>
                                {isEdit ? (
                                    <input className={inputClass} type='time' value={profileData.slotEndTime || '17:00'} onChange={(e) => set({ slotEndTime: e.target.value })} />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.slotEndTime}</p>
                                )}
                            </div>
                            <div>
                                <label className={fieldLabelClass}>Slot length</label>
                                {isEdit ? (
                                    <select className={`${inputClass} appearance-none`} value={String(profileData.slotDuration ?? 30)} onChange={(e) => set({ slotDuration: e.target.value })}>
                                        {[15, 20, 30, 45, 60].map((m) => (
                                            <option key={m} value={m}>{m} minutes</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.slotDuration} minutes</p>
                                )}
                            </div>
                        </div>

                        <div className='mt-5'>
                            <label className={fieldLabelClass}>Consultation modes</label>
                            <div className='flex gap-2'>
                                {CONSULTATION_MODES.map((mode) => {
                                    const active = modes.includes(mode)
                                    return (
                                        <button
                                            key={mode}
                                            type='button'
                                            disabled={!isEdit}
                                            onClick={() => toggleMode(mode)}
                                            aria-pressed={active}
                                            className={`flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors ${
                                                active
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-gray-50 border-gray-200 text-gray-500'
                                            } ${isEdit ? 'cursor-pointer' : 'cursor-default'}`}
                                        >
                                            {mode}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className={cardClass}>
                        <h3 className={cardTitleClass}>
                            <FileText className='w-4 h-4 text-blue-600' /> About
                        </h3>
                        {isEdit ? (
                            <textarea className={`${inputClass} min-h-28 font-normal`} value={profileData.about || ''} onChange={(e) => set({ about: e.target.value })} placeholder='Tell patients about your background...' />
                        ) : (
                            <p className='text-sm text-gray-600 leading-relaxed'>{profileData.about || 'No bio added yet.'}</p>
                        )}
                    </div>

                    <div className={cardClass}>
                        <h3 className={cardTitleClass}>
                            <MapPin className='w-4 h-4 text-blue-600' /> Clinic
                        </h3>

                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5'>
                            <div>
                                <label className={`${fieldLabelClass} flex items-center gap-1.5`}>
                                    <Building2 className='w-3.5 h-3.5' /> Hospital / clinic
                                </label>
                                {isEdit ? (
                                    <input className={inputClass} type='text' value={profileData.hospital || ''} onChange={(e) => set({ hospital: e.target.value })} />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.hospital || 'Not set'}</p>
                                )}
                            </div>
                            <div>
                                <label className={fieldLabelClass}>City</label>
                                {isEdit ? (
                                    <input className={inputClass} type='text' value={profileData.city || ''} onChange={(e) => set({ city: e.target.value })} />
                                ) : (
                                    <p className='text-sm font-semibold text-gray-900'>{profileData.city || 'Not set'}</p>
                                )}
                            </div>
                        </div>

                        {isEdit ? (
                            <div className='flex flex-col gap-3'>
                                <input className={inputClass} type='text' placeholder='Address line 1' value={profileData.address?.line1 || ''} onChange={(e) => set({ address: { ...(profileData.address || {}), line1: e.target.value } })} />
                                <input className={inputClass} type='text' placeholder='Address line 2' value={profileData.address?.line2 || ''} onChange={(e) => set({ address: { ...(profileData.address || {}), line2: e.target.value } })} />
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
