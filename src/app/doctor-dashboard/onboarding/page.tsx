'use client'

import React, { useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import {
    Stethoscope,
    Upload,
    GraduationCap,
    IndianRupee,
    MapPin,
    CalendarClock,
    BadgeCheck,
    Check,
} from 'lucide-react'
import { completeDoctorOnboarding } from '@/app/actions/doctorActions'
import { AppContext } from '@/context/AppContext'
import { specialityData } from '@/lib/constants'
import {
    DEFAULT_AVAILABLE_DAYS,
    DEFAULT_SLOT_DURATION,
    DEFAULT_SLOT_END,
    DEFAULT_SLOT_START,
    WEEKDAYS,
    type Weekday,
} from '@/lib/schedule'
import { defaultAvatar } from '@/lib/avatar'

const CONSULTATION_MODES = ['Video Consultation', 'In-Person'] as const

const inputClass =
    'w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 outline-none transition-all'
const labelClass = 'text-xs font-semibold text-gray-500 mb-1.5 block'
const sectionClass = 'bg-white border border-gray-100 rounded-3xl shadow-sm p-6 sm:p-8'
const sectionTitleClass =
    'text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center gap-2'

const DoctorOnboarding = () => {
    const router = useRouter()
    const context = useContext(AppContext)

    const [image, setImage] = useState<File | null>(null)
    const [gender, setGender] = useState('Not Selected')
    const [phone, setPhone] = useState('')
    const [speciality, setSpeciality] = useState(specialityData[0].speciality)
    const [degree, setDegree] = useState('')
    const [experience, setExperience] = useState('1 Year')
    const [registrationNo, setRegistrationNo] = useState('')
    const [hospital, setHospital] = useState('')
    const [city, setCity] = useState('')
    const [address1, setAddress1] = useState('')
    const [address2, setAddress2] = useState('')
    const [languages, setLanguages] = useState('')
    const [awards, setAwards] = useState('')
    const [fees, setFees] = useState('')
    const [about, setAbout] = useState('')
    const [modes, setModes] = useState<string[]>(['Video Consultation'])
    const [days, setDays] = useState<Weekday[]>(DEFAULT_AVAILABLE_DAYS)
    const [startTime, setStartTime] = useState(DEFAULT_SLOT_START)
    const [endTime, setEndTime] = useState(DEFAULT_SLOT_END)
    const [slotDuration, setSlotDuration] = useState(String(DEFAULT_SLOT_DURATION))
    const [submitting, setSubmitting] = useState(false)

    // Revoked implicitly when the component unmounts; recomputed only when the file
    // changes so the preview does not flicker on every keystroke.
    const imagePreview = useMemo(
        () => (image ? URL.createObjectURL(image) : defaultAvatar(gender)),
        [image, gender],
    )

    const toggleDay = (day: Weekday) => {
        setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
    }

    const toggleMode = (mode: string) => {
        setModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]))
    }

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (submitting) return

        if (modes.length === 0) return toast.error('Select at least one consultation mode')
        if (days.length === 0) return toast.error('Select at least one consulting day')
        if (endTime <= startTime) return toast.error('Consulting end time must be after the start time')

        const formData = new FormData()
        if (image) formData.append('image', image)
        formData.append('gender', gender)
        formData.append('phone', phone)
        formData.append('speciality', speciality)
        formData.append('degree', degree)
        formData.append('experience', experience)
        formData.append('registrationNo', registrationNo)
        formData.append('hospital', hospital)
        formData.append('city', city)
        formData.append('languages', languages)
        formData.append('awards', awards)
        formData.append('fees', fees)
        formData.append('about', about)
        formData.append('address', JSON.stringify({ line1: address1, line2: address2 }))
        formData.append('consultationModes', modes.join(','))
        // Sorted into calendar order so the profile reads "Mon, Wed, Fri", not the order
        // the checkboxes happened to be clicked in.
        formData.append(
            'availableDays',
            [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)).join(','),
        )
        formData.append('slotStartTime', startTime)
        formData.append('slotEndTime', endTime)
        formData.append('slotDuration', slotDuration)

        setSubmitting(true)
        let res
        try {
            res = await completeDoctorOnboarding(formData)
        } finally {
            setSubmitting(false)
        }

        if (!res.success) {
            toast.error(res.message)
            return
        }

        toast.success('Your profile is live — patients can now book with you')
        await context?.getDoctorProfileData?.()
        await context?.getDoctorsData?.()
        router.replace('/doctor-dashboard/dashboard')
    }

    return (
        <div className='min-h-screen bg-blue-50/40 py-10 px-4'>
            <div className='max-w-4xl mx-auto'>
                <div className='flex items-start gap-4 mb-8'>
                    <div className='w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center shadow-sm shrink-0'>
                        <Stethoscope className='w-6 h-6 text-white' />
                    </div>
                    <div>
                        <h1 className='text-2xl font-bold text-gray-900'>Complete your practice profile</h1>
                        <p className='text-gray-500 mt-1 text-sm max-w-2xl'>
                            Patients see this information when they search for a doctor, and your booking
                            calendar is built from the consulting hours you set here. Your profile stays
                            hidden until this form is submitted.
                        </p>
                    </div>
                </div>

                <form onSubmit={onSubmit} className='flex flex-col gap-6'>
                    {/* --- Identity --- */}
                    <div className={sectionClass}>
                        <h2 className={sectionTitleClass}>
                            <BadgeCheck className='w-4 h-4 text-blue-600' /> About you
                        </h2>

                        <div className='flex items-center gap-5 mb-6 pb-6 border-b border-gray-100'>
                            <label htmlFor='doc-photo' className='cursor-pointer group shrink-0'>
                                <div className='w-20 h-20 rounded-2xl overflow-hidden bg-blue-50 border-2 border-dashed border-blue-200 group-hover:border-primary transition-colors'>
                                    <img src={imagePreview} alt='' className='w-full h-full object-cover' />
                                </div>
                            </label>
                            <input
                                id='doc-photo'
                                type='file'
                                hidden
                                accept='image/*'
                                onChange={(e) => setImage(e.target.files?.[0] || null)}
                            />
                            <div>
                                <p className='font-semibold text-gray-800 flex items-center gap-1.5'>
                                    <Upload className='w-4 h-4 text-gray-400' /> Profile photo
                                </p>
                                <p className='text-sm text-gray-400'>
                                    Optional — until you upload one, patients see the avatar shown here.
                                </p>
                            </div>
                        </div>

                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                            <div>
                                <label className={labelClass}>Gender</label>
                                <select
                                    className={`${inputClass} appearance-none`}
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                >
                                    <option value='Not Selected'>Prefer not to say</option>
                                    <option value='Male'>Male</option>
                                    <option value='Female'>Female</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Contact number</label>
                                <input
                                    className={inputClass}
                                    type='tel'
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder='e.g. 98765 43210'
                                />
                            </div>
                        </div>
                    </div>

                    {/* --- Credentials --- */}
                    <div className={sectionClass}>
                        <h2 className={sectionTitleClass}>
                            <GraduationCap className='w-4 h-4 text-blue-600' /> Qualifications
                        </h2>

                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                            <div>
                                <label className={labelClass}>Speciality *</label>
                                <select
                                    className={`${inputClass} appearance-none`}
                                    value={speciality}
                                    onChange={(e) => setSpeciality(e.target.value)}
                                    required
                                >
                                    {specialityData.map((item) => (
                                        <option key={item.speciality} value={item.speciality}>
                                            {item.speciality}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Qualification *</label>
                                <input
                                    className={inputClass}
                                    type='text'
                                    value={degree}
                                    onChange={(e) => setDegree(e.target.value)}
                                    placeholder='e.g. MBBS, MD (Internal Medicine)'
                                    required
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Years of experience *</label>
                                <select
                                    className={`${inputClass} appearance-none`}
                                    value={experience}
                                    onChange={(e) => setExperience(e.target.value)}
                                >
                                    {Array.from({ length: 30 }, (_, i) => `${i + 1} Year${i === 0 ? '' : 's'}`).map(
                                        (label) => (
                                            <option key={label} value={label}>
                                                {label}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Medical registration number *</label>
                                <input
                                    className={inputClass}
                                    type='text'
                                    value={registrationNo}
                                    onChange={(e) => setRegistrationNo(e.target.value)}
                                    placeholder='State medical council reg. no.'
                                    required
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Languages spoken</label>
                                <input
                                    className={inputClass}
                                    type='text'
                                    value={languages}
                                    onChange={(e) => setLanguages(e.target.value)}
                                    placeholder='e.g. English, Hindi, Marathi'
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Awards &amp; recognition</label>
                                <input
                                    className={inputClass}
                                    type='text'
                                    value={awards}
                                    onChange={(e) => setAwards(e.target.value)}
                                    placeholder='e.g. Best Physician 2023'
                                />
                            </div>
                        </div>

                        <div className='mt-5'>
                            <label className={labelClass}>About you *</label>
                            <textarea
                                className={`${inputClass} min-h-28`}
                                value={about}
                                onChange={(e) => setAbout(e.target.value)}
                                placeholder='A short bio patients will read on your profile.'
                                required
                            />
                        </div>
                    </div>

                    {/* --- Practice --- */}
                    <div className={sectionClass}>
                        <h2 className={sectionTitleClass}>
                            <MapPin className='w-4 h-4 text-blue-600' /> Where you practise
                        </h2>

                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                            <div>
                                <label className={labelClass}>Hospital / clinic</label>
                                <input
                                    className={inputClass}
                                    type='text'
                                    value={hospital}
                                    onChange={(e) => setHospital(e.target.value)}
                                    placeholder='e.g. Apollo Hospital'
                                />
                            </div>
                            <div>
                                <label className={labelClass}>City</label>
                                <input
                                    className={inputClass}
                                    type='text'
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder='e.g. Mumbai'
                                />
                            </div>
                            <div className='sm:col-span-2'>
                                <label className={labelClass}>Clinic address *</label>
                                <div className='flex flex-col gap-2'>
                                    <input
                                        className={inputClass}
                                        type='text'
                                        value={address1}
                                        onChange={(e) => setAddress1(e.target.value)}
                                        placeholder='Address line 1'
                                        required
                                    />
                                    <input
                                        className={inputClass}
                                        type='text'
                                        value={address2}
                                        onChange={(e) => setAddress2(e.target.value)}
                                        placeholder='Address line 2'
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Consultation fee (₹) *</label>
                                <div className='relative'>
                                    <IndianRupee className='absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-gray-400' />
                                    <input
                                        className={`${inputClass} pl-9`}
                                        type='number'
                                        min={0}
                                        value={fees}
                                        onChange={(e) => setFees(e.target.value)}
                                        placeholder='e.g. 600'
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Consultation modes *</label>
                                <div className='flex gap-2'>
                                    {CONSULTATION_MODES.map((mode) => {
                                        const active = modes.includes(mode)
                                        return (
                                            <button
                                                key={mode}
                                                type='button'
                                                onClick={() => toggleMode(mode)}
                                                aria-pressed={active}
                                                className={`flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors ${
                                                    active
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300'
                                                }`}
                                            >
                                                {mode}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- Availability --- */}
                    <div className={sectionClass}>
                        <h2 className={sectionTitleClass}>
                            <CalendarClock className='w-4 h-4 text-blue-600' /> When you are free
                        </h2>

                        <label className={labelClass}>Consulting days *</label>
                        <div className='flex flex-wrap gap-2 mb-6'>
                            {WEEKDAYS.map((day) => {
                                const active = days.includes(day)
                                return (
                                    <button
                                        key={day}
                                        type='button'
                                        onClick={() => toggleDay(day)}
                                        aria-pressed={active}
                                        className={`w-14 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                                            active
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300'
                                        }`}
                                    >
                                        {active && <Check className='w-3 h-3' />}
                                        {day}
                                    </button>
                                )
                            })}
                        </div>

                        <div className='grid grid-cols-1 sm:grid-cols-3 gap-5'>
                            <div>
                                <label className={labelClass}>Start time *</label>
                                <input
                                    className={inputClass}
                                    type='time'
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className={labelClass}>End time *</label>
                                <input
                                    className={inputClass}
                                    type='time'
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Slot length</label>
                                <select
                                    className={`${inputClass} appearance-none`}
                                    value={slotDuration}
                                    onChange={(e) => setSlotDuration(e.target.value)}
                                >
                                    {[15, 20, 30, 45, 60].map((minutes) => (
                                        <option key={minutes} value={minutes}>
                                            {minutes} minutes
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <p className='text-xs text-gray-400 mt-4'>
                            Patients will be offered {slotDuration}-minute slots between {startTime} and{' '}
                            {endTime} on the days you selected.
                        </p>
                    </div>

                    <button
                        type='submit'
                        disabled={submitting}
                        className='self-start bg-primary hover:bg-primary/90 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold px-10 py-3.5 rounded-full shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all'
                    >
                        {submitting ? 'Saving your profile...' : 'Finish and go to dashboard'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default DoctorOnboarding
