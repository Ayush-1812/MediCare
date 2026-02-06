'use client'

import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '@/context/AppContext'
import { getProfile, updateProfile } from '@/app/actions/userActions'
import { toast } from 'react-toastify'

const MyProfile = () => {
    const { token, userData, setUserData } = useContext(AppContext)
    const [isEdit, setIsEdit] = useState(false)
    const [image, setImage] = useState<File | null>(null)

    const loadProfileData = async () => {
        const res = await getProfile()
        if (res.success) {
            setUserData(res.userData)
        }
    }

    const updateUserProfileData = async () => {
        try {
            const formData = new FormData()
            formData.append('name', userData.name)
            formData.append('phone', userData.phone)
            formData.append('address', JSON.stringify(userData.address))
            formData.append('gender', userData.gender)
            formData.append('dob', userData.dob)
            if (image) formData.append('image', image)

            const res = await updateProfile(formData)
            if (res.success) {
                toast.success(res.message)
                await loadProfileData()
                setIsEdit(false)
                setImage(null)
            } else {
                toast.error(res.message)
            }
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        if (token) {
            loadProfileData()
        }
    }, [token])

    if (!userData) return <div className='min-h-[60vh] flex items-center justify-center font-medium'>Loading...</div>

    return (
        <div className='max-w-lg flex flex-col gap-2 text-sm pt-5'>
            {isEdit ? (
                <label htmlFor="image">
                    <div className='inline-block relative cursor-pointer'>
                        {/* <img className='w-36 rounded opacity-75' src={image ? URL.createObjectURL(image) : userData.image || "/assets/upload_area.png"} alt="" /> */}
                        <img
                            className="w-36 rounded opacity-75"
                            src={
                                image
                                    ? URL.createObjectURL(image)
                                    : userData.image?.trim()
                                        ? userData.image
                                        : "/assets/upload_area.png"
                            }
                            alt="Profile"
                        />

                        {/* {!image && <img className='w-10 absolute bottom-12 right-12' src="/assets/upload_icon.png" alt="" />} */}
                        {!image && (
                            <img
                                className="w-10 absolute bottom-12 right-12"
                                src="/assets/upload_icon.png"
                                alt="Upload"
                            />
                        )}

                    </div>
                    <input onChange={(e) => setImage(e.target.files?.[0] || null)} type="file" id="image" hidden />
                </label>
            ) : (
                // <img className='w-36 rounded' src={userData.image || "/assets/profile_pic.png"} alt="" />
                <img
                    className="w-36 rounded"
                    src={userData.image?.trim() ? userData.image : "/assets/profile_pic.png"}
                    alt="Profile"
                />

            )}

            {isEdit ? (
                <input className='bg-gray-50 text-3xl font-medium max-w-60 mt-4' type='text' value={userData.name} onChange={(e) => setUserData((prev: any) => ({ ...prev, name: e.target.value }))} />
            ) : (
                <p className='font-medium text-3xl text-neutral-800 mt-4'>{userData.name}</p>
            )}

            <hr className='bg-zinc-400 h-[1px] border-none' />

            <div>
                <p className='text-neutral-500 underline mt-3 uppercase'>CONTACT INFORMATION</p>
                <div className='grid grid-cols-[1fr_3fr] gap-y-2.5 mt-3 text-neutral-700'>
                    <p className='font-medium'>Email id:</p>
                    <p className='text-blue-500 font-medium'>{userData.email}</p>
                    <p className='font-medium'>Phone:</p>
                    {isEdit ? (
                        <input className='bg-gray-100 max-w-52' type='text' value={userData.phone} onChange={(e) => setUserData((prev: any) => ({ ...prev, phone: e.target.value }))} />
                    ) : (
                        <p className='text-blue-400 font-medium'>{userData.phone}</p>
                    )}
                    <p className='font-medium'>Address:</p>
                    {isEdit ? (
                        <p>
                            <input className='bg-gray-100' type="text" value={userData.address.line1} onChange={(e) => setUserData((prev: any) => ({ ...prev, address: { ...prev.address, line1: e.target.value } }))} />
                            <br />
                            <input className='bg-gray-100' type="text" value={userData.address.line2} onChange={(e) => setUserData((prev: any) => ({ ...prev, address: { ...prev.address, line2: e.target.value } }))} />
                        </p>
                    ) : (
                        <p className='text-gray-500'>
                            {userData.address.line1}
                            <br />
                            {userData.address.line2}
                        </p>
                    )}
                </div>
            </div>

            <div>
                <p className='text-neutral-500 underline mt-3 uppercase'>BASIC INFORMATION</p>
                <div className='grid grid-cols-[1fr_3fr] gap-y-2.5 mt-3 text-neutral-700'>
                    <p className='font-medium'>Gender:</p>
                    {isEdit ? (
                        <select className='max-w-20 bg-gray-100' onChange={(e) => setUserData((prev: any) => ({ ...prev, gender: e.target.value }))} value={userData.gender}>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Not Selected">Not Selected</option>
                        </select>
                    ) : (
                        <p className='text-gray-400 font-medium'>{userData.gender}</p>
                    )}
                    <p className='font-medium'>Birthday:</p>
                    {isEdit ? (
                        <input className='max-w-28 bg-gray-100' type='date' value={userData.dob} onChange={(e) => setUserData((prev: any) => ({ ...prev, dob: e.target.value }))} />
                    ) : (
                        <p className='text-gray-400 font-medium'>{userData.dob}</p>
                    )}
                </div>
            </div>

            <div>
                <p className='text-neutral-500 underline mt-6 uppercase'>Digital Health Records</p>
                <div className='mt-3'>
                    <button
                        onClick={() => window.location.href = '/my-profile/prescriptions'}
                        className="bg-blue-50 text-primary border border-blue-200 px-6 py-3 rounded-xl font-medium flex items-center gap-3 hover:bg-blue-100 transition-colors w-full md:w-auto"
                    >
                        <div className="bg-white p-2 rounded-full text-primary">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold">My Prescriptions</p>
                            <p className="text-xs text-gray-500">Scan & Manage Handwritten Notes</p>
                        </div>
                        <svg className="w-5 h-5 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </div>

            <div className='mt-10'>
                {isEdit ? (
                    <button className='border border-primary px-8 py-2 rounded-full hover:bg-primary hover:text-white transition-all' onClick={updateUserProfileData}>Save Information</button>
                ) : (
                    <button className='border border-primary px-8 py-2 rounded-full hover:bg-primary hover:text-white transition-all' onClick={() => setIsEdit(true)}>Edit</button>
                )}
            </div>
        </div>
    )
}

export default MyProfile
