'use client'

import React, { useState } from 'react'
import { addDoctor } from '@/app/actions/adminActions'
import { toast } from 'react-toastify'
import { specialityData } from '@/lib/constants'
import { Upload } from 'lucide-react'

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

    const onSubmitHandler = async (event: React.FormEvent) => {
        event.preventDefault()
        try {
            if (!docImg) return toast.error('Image Not Selected')

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
                            <label className={labelClass}>Fees</label>
                            <input onChange={(e) => setFees(e.target.value)} value={fees} className={inputClass} type="number" placeholder='e.g. 50' required />
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
