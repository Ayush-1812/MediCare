'use client'

import React, { useState } from 'react'
import { addDoctor } from '@/app/actions/adminActions'
import { toast } from 'react-toastify'
import { specialityData } from '@/lib/constants'
import { Upload, Check } from 'lucide-react'
import { DEFAULT_AVAILABLE_DAYS, DEFAULT_SLOT_DURATION, DEFAULT_SLOT_END, DEFAULT_SLOT_START, WEEKDAYS, type Weekday } from '@/lib/schedule'

const CONSULTATION_MODES = ['Video Consultation', 'In-Person'] as const

const inputClass = 'w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 outline-none transition-all'
const labelClass = 'text-xs font-semibold text-gray-500 mb-1.5 block'

const AddDoctor = () => {
    const [docImg, setDocImg] = useState<File | null>(null)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [experience, setExperience] = useState('1 Year')
    const [fees, setFees] = useState('')
    const [about, setAbout] = useState('')
    const [speciality, setSpeciality] = useState('General physician')
    const [degree, setDegree] = useState('')
    const [address1, setAddress1] = useState('')
    const [address2, setAddress2] = useState('')
    const [languages, setLanguages] = useState('')
    const [awards, setAwards] = useState('')
    const [gender, setGender] = useState('Not Selected')
    const [phone, setPhone] = useState('')
    const [registrationNo, setRegistrationNo] = useState('')
    const [hospital, setHospital] = useState('')
    const [city, setCity] = useState('')
    const [modes, setModes] = useState<string[]>(['Video Consultation'])
    const [days, setDays] = useState<Weekday[]>(DEFAULT_AVAILABLE_DAYS)
    const [startTime, setStartTime] = useState(DEFAULT_SLOT_START)
    const [endTime, setEndTime] = useState(DEFAULT_SLOT_END)
    const [slotDuration, setSlotDuration] = useState(String(DEFAULT_SLOT_DURATION))

    const toggleDay = (day: Weekday) =>
        setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))

    const toggleMode = (mode: string) =>
        setModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]))

    const onSubmitHandler = async (event: React.FormEvent) => {
        event.preventDefault()
        try {
            if (!docImg) return toast.error('Image Not Selected')
            if (modes.length === 0) return toast.error('Select at least one consultation mode')
            if (days.length === 0) return toast.error('Select at least one consulting day')
            if (endTime <= startTime) return toast.error('Consulting end time must be after the start time')

            const formData = new FormData()
            formData.append('image', docImg)
            formData.append('name', name)
            formData.append('email', email)
            formData.append('password', password)
            formData.append('experience', experience)
            formData.append('fees', fees)
            formData.append('about', about)
            formData.append('speciality', speciality)
            formData.append('degree', degree)
            formData.append('languages', languages)
            formData.append('awards', awards)
            formData.append('address', JSON.stringify({ line1: address1, line2: address2 }))
            formData.append('gender', gender)
            formData.append('phone', phone)
            formData.append('registrationNo', registrationNo)
            formData.append('hospital', hospital)
            formData.append('city', city)
            formData.append('consultationModes', modes.join(','))
            formData.append('availableDays', [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)).join(','))
            formData.append('slotStartTime', startTime)
            formData.append('slotEndTime', endTime)
            formData.append('slotDuration', slotDuration)

            const res = await addDoctor(formData)
            if (res.success) {
                toast.success(res.message)
                setDocImg(null)
                setName('')
                setEmail('')
                setPassword('')
                setAddress1('')
                setAddress2('')
                setDegree('')
                setAbout('')
                setFees('')
                setLanguages('')
                setAwards('')
                setPhone('')
                setRegistrationNo('')
                setHospital('')
                setCity('')
                setGender('Not Selected')
            } else {
                toast.error(res.message)
            }
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    return (
        <form onSubmit={onSubmitHandler} className='w-full max-w-4xl'>
            <h1 className='text-2xl font-bold text-gray-900 mb-1'>Add Doctor</h1>
            <p className='text-gray-500 mb-6'>Onboard a new doctor onto the platform.</p>

            <div className='bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sm:p-8'>
                <div className='flex items-center gap-5 mb-8 pb-8 border-b border-gray-100'>
                    <label htmlFor="doc-img" className='cursor-pointer group relative'>
                        <div className='w-20 h-20 rounded-2xl bg-blue-50 border-2 border-dashed border-blue-200 overflow-hidden flex items-center justify-center group-hover:border-primary transition-colors'>
                            {docImg ? (
                                <img className='w-full h-full object-cover' src={URL.createObjectURL(docImg)} alt="" />
                            ) : (
                                <Upload className='w-6 h-6 text-blue-300 group-hover:text-primary transition-colors' />
                            )}
                        </div>
                    </label>
                    <input onChange={(e) => setDocImg(e.target.files?.[0] || null)} type="file" id="doc-img" hidden accept="image/*" />
                    <div>
                        <p className='font-semibold text-gray-800'>Doctor photo</p>
                        <p className='text-sm text-gray-400'>Click the box to upload a picture</p>
                    </div>
                </div>

                <div className='flex flex-col lg:flex-row items-start gap-8'>
                    <div className='w-full lg:flex-1 flex flex-col gap-4'>
                        <div>
                            <label className={labelClass}>Doctor Name</label>
                            <input onChange={(e) => setName(e.target.value)} value={name} className={inputClass} type="text" placeholder='Full name' required />
                        </div>
                        <div>
                            <label className={labelClass}>Doctor Email</label>
                            <input onChange={(e) => setEmail(e.target.value)} value={email} className={inputClass} type="email" placeholder='name@example.com' required />
                        </div>
                        <div>
                            <label className={labelClass}>Doctor Password</label>
                            <input onChange={(e) => setPassword(e.target.value)} value={password} className={inputClass} type="password" placeholder='••••••••' required />
                        </div>
                        <div>
                            <label className={labelClass}>Experience</label>
                            <select onChange={(e) => setExperience(e.target.value)} value={experience} className={`${inputClass} appearance-none`}>
                                {[...Array(10)].map((_, i) => (
                                    <option key={i} value={`${i + 1} Year`}>{i + 1} Year</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Consultation fee (₹)</label>
                            <input onChange={(e) => setFees(e.target.value)} value={fees} className={inputClass} type="number" min={0} placeholder='e.g. 600' required />
                        </div>
                        <div>
                            <label className={labelClass}>Gender</label>
                            <select onChange={(e) => setGender(e.target.value)} value={gender} className={`${inputClass} appearance-none`}>
                                <option value='Not Selected'>Prefer not to say</option>
                                <option value='Male'>Male</option>
                                <option value='Female'>Female</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Contact number</label>
                            <input onChange={(e) => setPhone(e.target.value)} value={phone} className={inputClass} type="tel" placeholder='e.g. 98765 43210' />
                        </div>
                    </div>

                    <div className='w-full lg:flex-1 flex flex-col gap-4'>
                        <div>
                            <label className={labelClass}>Speciality</label>
                            <select onChange={(e) => setSpeciality(e.target.value)} value={speciality} className={`${inputClass} appearance-none`}>
                                {specialityData.map((item, index) => (
                                    <option key={index} value={item.speciality}>{item.speciality}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Education</label>
                            <input onChange={(e) => setDegree(e.target.value)} value={degree} className={inputClass} type="text" placeholder='e.g. MBBS, MD' required />
                        </div>
                        <div>
                            <label className={labelClass}>Address</label>
                            <div className='flex flex-col gap-2'>
                                <input onChange={(e) => setAddress1(e.target.value)} value={address1} className={inputClass} type="text" placeholder='Address line 1' required />
                                <input onChange={(e) => setAddress2(e.target.value)} value={address2} className={inputClass} type="text" placeholder='Address line 2' required />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Languages (Spoken)</label>
                            <input onChange={(e) => setLanguages(e.target.value)} value={languages} className={inputClass} type="text" placeholder='e.g. English, Hindi' required />
                        </div>
                        <div>
                            <label className={labelClass}>Awards & Recognition</label>
                            <input onChange={(e) => setAwards(e.target.value)} value={awards} className={inputClass} type="text" placeholder='e.g. Best Doctor 2023' required />
                        </div>
                        <div>
                            <label className={labelClass}>Medical Registration No.</label>
                            <input onChange={(e) => setRegistrationNo(e.target.value)} value={registrationNo} className={inputClass} type="text" placeholder='State medical council reg. no.' required />
                        </div>
                        <div>
                            <label className={labelClass}>Hospital / Clinic</label>
                            <input onChange={(e) => setHospital(e.target.value)} value={hospital} className={inputClass} type="text" placeholder='e.g. Apollo Hospital' />
                        </div>
                        <div>
                            <label className={labelClass}>City</label>
                            <input onChange={(e) => setCity(e.target.value)} value={city} className={inputClass} type="text" placeholder='e.g. Mumbai' />
                        </div>
                    </div>
                </div>

                <div className='mt-8 pt-8 border-t border-gray-100'>
                    <p className='font-semibold text-gray-800 mb-1'>Consulting hours</p>
                    <p className='text-sm text-gray-400 mb-4'>The booking calendar patients see is generated from these.</p>

                    <label className={labelClass}>Consulting days</label>
                    <div className='flex flex-wrap gap-2 mb-5'>
                        {WEEKDAYS.map((day) => {
                            const active = days.includes(day)
                            return (
                                <button
                                    key={day}
                                    type='button'
                                    onClick={() => toggleDay(day)}
                                    aria-pressed={active}
                                    className={`w-14 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300'}`}
                                >
                                    {active && <Check className='w-3 h-3' />}
                                    {day}
                                </button>
                            )
                        })}
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                        <div>
                            <label className={labelClass}>Start time</label>
                            <input className={inputClass} type='time' value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelClass}>End time</label>
                            <input className={inputClass} type='time' value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelClass}>Slot length</label>
                            <select className={`${inputClass} appearance-none`} value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)}>
                                {[15, 20, 30, 45, 60].map((m) => (
                                    <option key={m} value={m}>{m} minutes</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className='mt-5'>
                        <label className={labelClass}>Consultation modes</label>
                        <div className='flex gap-2 max-w-md'>
                            {CONSULTATION_MODES.map((mode) => {
                                const active = modes.includes(mode)
                                return (
                                    <button
                                        key={mode}
                                        type='button'
                                        onClick={() => toggleMode(mode)}
                                        aria-pressed={active}
                                        className={`flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300'}`}
                                    >
                                        {mode}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className='mt-6'>
                    <label className={labelClass}>About Doctor</label>
                    <textarea onChange={(e) => setAbout(e.target.value)} value={about} className={`${inputClass} min-h-28`} placeholder='Write a short bio about the doctor...' rows={5} required />
                </div>

                <button type='submit' className='bg-primary px-10 py-3 mt-6 text-white font-semibold rounded-full shadow-sm hover:shadow-md hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0 transition-all'>
                    Add Doctor
                </button>
            </div>
        </form>
    )
}

export default AddDoctor
