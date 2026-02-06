'use client'

import React, { useState } from 'react'
import { addDoctor } from '@/app/actions/adminActions'
import { toast } from 'react-toastify'
import { specialityData } from '@/lib/constants'

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
        <form onSubmit={onSubmitHandler} className='m-5 w-full'>
            <p className='mb-3 text-lg font-medium'>Add Doctor</p>
            <div className='bg-white px-8 py-8 border rounded w-full max-w-4xl max-h-[80vh] overflow-y-scroll'>
                <div className='flex items-center gap-4 mb-8 text-gray-500'>
                    <label htmlFor="doc-img">
                        <img className='w-16 bg-gray-100 rounded-full cursor-pointer' src={docImg ? URL.createObjectURL(docImg) : "/assets/upload_area.svg"} alt="" />
                    </label>
                    <input onChange={(e) => setDocImg(e.target.files?.[0] || null)} type="file" id="doc-img" hidden />
                    <p>Upload doctor <br /> picture</p>
                </div>

                <div className='flex flex-col lg:flex-row items-start gap-10 text-gray-600'>
                    <div className='w-full lg:flex-1 flex flex-col gap-4'>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Doctor Name</p>
                            <input onChange={(e) => setName(e.target.value)} value={name} className='border rounded px-3 py-2' type="text" placeholder='Name' required />
                        </div>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Doctor Email</p>
                            <input onChange={(e) => setEmail(e.target.value)} value={email} className='border rounded px-3 py-2' type="email" placeholder='Email' required />
                        </div>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Doctor Password</p>
                            <input onChange={(e) => setPassword(e.target.value)} value={password} className='border rounded px-3 py-2' type="password" placeholder='Password' required />
                        </div>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Experience</p>
                            <select onChange={(e) => setExperience(e.target.value)} value={experience} className='border rounded px-3 py-2'>
                                {[...Array(10)].map((_, i) => (
                                    <option key={i} value={`${i + 1} Year`}>{i + 1} Year</option>
                                ))}
                            </select>
                        </div>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Fees</p>
                            <input onChange={(e) => setFees(e.target.value)} value={fees} className='border rounded px-3 py-2' type="number" placeholder='fees' required />
                        </div>
                    </div>

                    <div className='w-full lg:flex-1 flex flex-col gap-4'>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Speciality</p>
                            <select onChange={(e) => setSpeciality(e.target.value)} value={speciality} className='border rounded px-3 py-2'>
                                {specialityData.map((item, index) => (
                                    <option key={index} value={item.speciality}>{item.speciality}</option>
                                ))}
                            </select>
                        </div>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Education</p>
                            <input onChange={(e) => setDegree(e.target.value)} value={degree} className='border rounded px-3 py-2' type="text" placeholder='Education' required />
                        </div>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Address</p>
                            <input onChange={(e) => setAddress1(e.target.value)} value={address1} className='border rounded px-3 py-2' type="text" placeholder='address 1' required />
                            <input onChange={(e) => setAddress2(e.target.value)} value={address2} className='border rounded px-3 py-2' type="text" placeholder='address 2' required />
                        </div>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Languages (Spoken)</p>
                            <input onChange={(e) => setLanguages(e.target.value)} value={languages} className='border rounded px-3 py-2' type="text" placeholder='e.g. English, Hindi' required />
                        </div>
                        <div className='flex-1 flex flex-col gap-1'>
                            <p>Awards & Recognition</p>
                            <input onChange={(e) => setAwards(e.target.value)} value={awards} className='border rounded px-3 py-2' type="text" placeholder='e.g. Best Doctor 2023' required />
                        </div>
                    </div>
                </div>

                <div className='mt-4'>
                    <p className='mt-4 mb-2'>About Doctor</p>
                    <textarea onChange={(e) => setAbout(e.target.value)} value={about} className='w-full border rounded px-4 pt-2' placeholder='write about doctor' rows={5} required />
                </div>

                <button type='submit' className='bg-primary px-10 py-3 mt-4 text-white rounded-full transition-all duration-300 hover:scale-105'>Add doctor</button>
            </div>
        </form>
    )
}

export default AddDoctor
